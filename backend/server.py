# -*- coding: utf-8 -*-
import http.server
import http.cookies
import json
import os
import sys
import time
import secrets
import hashlib

import urllib.parse

import db

PORT = int(os.environ.get("PORT", 8000))
DIRECTORY = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
USERS_PATH = os.path.join(DIRECTORY, "data", "users.json")

# Bật cờ này (biến môi trường SECURE_COOKIE=1) khi server đã chạy sau HTTPS
# (vd sau Caddy/nginx làm reverse proxy với SSL). Khi bật, cookie chỉ được
# gửi qua kết nối HTTPS.
SECURE_COOKIE = os.environ.get("SECURE_COOKIE", "0") == "1"

SESSION_DURATION = 8 * 60 * 60  # 8 tiếng
PBKDF2_ITERATIONS = 200_000

MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_WINDOW_SECONDS = 15 * 60  # 15 phút

# ── State lưu trong bộ nhớ ──────────────────────────────────────────────────
SESSIONS = {}          # token -> {username, name, role, expires}

SESSION_FILE = os.path.join(DIRECTORY, "data", "sessions.json")


def _load_sessions():
    global SESSIONS
    if os.path.exists(SESSION_FILE):
        try:
            with open(SESSION_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                now = time.time()
                SESSIONS = {t: s for t, s in data.items() if s.get("expires", 0) > now}
                print(f"[SESSION Persist] Nạp thành công {len(SESSIONS)} phiên làm việc từ đĩa.")
        except Exception as e:
            print(f"[SESSION Persist] Lỗi nạp phiên: {e}")
            SESSIONS = {}


def _save_sessions():
    try:
        now = time.time()
        valid = {t: s for t, s in SESSIONS.items() if s.get("expires", 0) > now}
        with open(SESSION_FILE, "w", encoding="utf-8") as f:
            json.dump(valid, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[SESSION Persist] Lỗi lưu phiên: {e}")

LOGIN_ATTEMPTS = {}    # key -> [timestamp, ...] các lần đăng nhập sai gần đây

# Các đường dẫn không cần đăng nhập vẫn xem được (trang login và tài nguyên của nó)
# Các đường dẫn không cần đăng nhập vẫn xem được (trang login, index shell và tài nguyên tĩnh)
PUBLIC_PATHS = {
    "/", "/frontend/login.html", "/frontend/login.js", "/frontend/styles.css",
    "/frontend/index.html", "/frontend/app.js", "/favicon.ico"
}

# Các phần mở rộng và thư mục nhạy cảm tuyệt đối không phục vụ tĩnh
BLOCKED_EXTENSIONS = ('.py', '.pyc', '.db', '.json', '.csv', '.bat', '.sh', '.env', '.git', '.md', '.bak', '.sqlite')
# Luôn dùng lowercase vì sẽ so sánh với norm_path (đã lowercase)
ALWAYS_BLOCKED_PREFIXES = ("/backend/", "/.git/", "/data/")

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')


def hash_password(password: str, salt: bytes) -> str:
    return hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, PBKDF2_ITERATIONS).hex()


def _purge_expired_sessions():
    """Tự động dọn dẹp các session và các lần thử sai đã hết hạn trong bộ nhớ."""
    now = time.time()
    expired = [t for t, s in SESSIONS.items() if s.get('expires', 0) < now]
    if expired:
        for t in expired:
            SESSIONS.pop(t, None)
        _save_sessions()

    for k in list(LOGIN_ATTEMPTS.keys()):
        attempts = [t for t in LOGIN_ATTEMPTS[k] if now - t < LOCKOUT_WINDOW_SECONDS]
        if attempts:
            LOGIN_ATTEMPTS[k] = attempts
        else:
            LOGIN_ATTEMPTS.pop(k, None)


class DashboardHandler(http.server.SimpleHTTPRequestHandler):
    server_version = "EduMetrics-Server"
    sys_version = ""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        """Bổ sung các HTTP Security Headers chuẩn bảo mật cao."""
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "SAMEORIGIN")
        self.send_header("X-XSS-Protection", "1; mode=block")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self';"
        )
        self.send_header("Cache-Control", "no-cache, must-revalidate")
        if SECURE_COOKIE:
            self.send_header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        super().end_headers()

    # ── Helpers dùng chung ───────────────────────────────────────────────
    def _client_ip(self):
        forwarded = self.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return self.client_address[0]

    def _send_json(self, status, obj, extra_headers=None):
        body = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        if extra_headers:
            for k, v in extra_headers.items():
                self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def _read_json_body(self):
        length = int(self.headers.get('Content-Length', 0) or 0)
        raw = self.rfile.read(length) if length else b""
        if not raw:
            return {}
        return json.loads(raw.decode('utf-8'))

    def _load_users(self):
        if not os.path.exists(USERS_PATH):
            return {"users": []}
        with open(USERS_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)

    def _get_session(self):
        _purge_expired_sessions()
        token = None

        # 1. Kiểm tra header Authorization (Bearer <token>)
        auth_header = self.headers.get('Authorization') or ''
        if auth_header.startswith('Bearer '):
            token = auth_header[7:].strip()

        # 2. Kiểm tra header X-Session-Token
        if not token:
            token = self.headers.get('X-Session-Token')

        # 3. Kiểm tra Cookie header (dùng regex bóc tách an toàn tuyệt đối)
        if not token:
            cookie_header = self.headers.get('Cookie') or ''
            if cookie_header:
                import re
                match = re.search(r'(?:^|;\s*)session_id=([a-zA-Z0-9_-]+)', cookie_header)
                if match:
                    token = match.group(1)
                else:
                    try:
                        cookies = http.cookies.SimpleCookie()
                        cookies.load(cookie_header)
                        morsel = cookies.get('session_id')
                        if morsel:
                            token = morsel.value
                    except Exception:
                        pass

        if not token:
            # print(f"[SESSION] No token found for {self.command} {self.path} | Auth={auth_header[:20] if auth_header else 'none'}")
            return None

        session = SESSIONS.get(token)
        if not session:
            # print(f"[SESSION] Token not in SESSIONS (server may have restarted) for {self.command} {self.path} | token={token[:12]}...")
            return None
        if session.get('expires', 0) < time.time():
            SESSIONS.pop(token, None)
            # print(f"[SESSION] Token expired for {self.command} {self.path}")
            return None

        return session

    def _clean_path(self):
        """Lấy path từ URL, giải mã URL encoding và chuẩn hóa (resolve '..')."""
        raw = self.path.split('?')[0]
        decoded = urllib.parse.unquote(raw)          # giải mã %2e%2e -> ..
        # Chuẩn hóa: loại bỏ các đoạn '..' và '.' trong đường dẫn
        parts = decoded.replace('\\', '/').split('/')
        normalized_parts = []
        for p in parts:
            if p == '..':                            # Path traversal -> bỏ qua
                normalized_parts = normalized_parts[:-1] if normalized_parts else []
            elif p and p != '.':
                normalized_parts.append(p)
        return '/' + '/'.join(normalized_parts)

    def _is_blocked(self, clean_path):
        """Trả về True nếu đường dẫn bị chặn (file nhạy cảm hoặc path traversal)."""
        # Đã được chuẩn hóa và giải mã bởi _clean_path
        norm_path = clean_path.lower()               # lowercase để so sánh case-insensitive

        # 1. Chặn các file ẩn (.git, .env, .htaccess,...)
        parts = norm_path.split('/')
        if any(p.startswith('.') and p not in ('', '.') for p in parts):
            return True

        # 2. Chặn thư mục nhạy cảm (backend, data, .git)
        if any(norm_path.startswith(prefix) for prefix in ALWAYS_BLOCKED_PREFIXES):
            return True

        # 3. Chặn tải trực tiếp các file mã nguồn và dữ liệu nhạy cảm
        if any(norm_path.endswith(ext) for ext in BLOCKED_EXTENSIONS):
            return True

        # 4. Kiểm tra realpath để đảm bảo file luôn nằm trong thư mục dự án
        try:
            target_path = os.path.realpath(os.path.join(DIRECTORY, clean_path.lstrip('/')))
            if not target_path.lower().startswith(os.path.realpath(DIRECTORY).lower()):
                return True
        except Exception:
            return True

        return False

    def _is_public(self, clean_path):
        norm_path = clean_path.replace('\\', '/').lower()
        return norm_path in PUBLIC_PATHS or norm_path.startswith('/frontend/login')

    def _cookie_header(self, token, max_age):
        parts = [f"session_id={token}", "HttpOnly", "Path=/", f"Max-Age={max_age}", "SameSite=Lax"]
        if SECURE_COOKIE:
            parts.append("Secure")
        return "; ".join(parts)

    def _clear_cookie_header(self):
        parts = ["session_id=", "HttpOnly", "Path=/", "Max-Age=0", "SameSite=Lax"]
        if SECURE_COOKIE:
            parts.append("Secure")
        return "; ".join(parts)

    # ── GET: phục vụ file tĩnh + route API GET ──────────────────────────────
    def do_GET(self):
        clean_path = self._clean_path()

        if self._is_blocked(clean_path):
            self._send_json(403, {"ok": False, "error": "forbidden"})
            return

        if clean_path == "/api/me":
            session = self._get_session()
            if not session:
                self._send_json(401, {"ok": False})
                return
            self._send_json(200, {
                "ok": True,
                "name": session["name"],
                "role": session["role"],
                "read_only": session.get("read_only", False)
            })
            return

        if clean_path in ("/", "/index", "/index.html"):
            session = self._get_session()
            self.send_response(302)
            self.send_header("Location", "/frontend/index.html" if session else "/frontend/login.html")
            self.end_headers()
            return

        if clean_path in ("/login", "/login.html"):
            session = self._get_session()
            self.send_response(302)
            self.send_header("Location", "/frontend/index.html" if session else "/frontend/login.html")
            self.end_headers()
            return

        if not self._is_public(clean_path):
            session = self._get_session()
            if not session:
                if clean_path.startswith('/api/'):
                    self._send_json(401, {"ok": False, "error": "unauthorized"})
                else:
                    self.send_response(302)
                    self.send_header("Location", "/frontend/login.html")
                    self.end_headers()
                return

        # ── Route dữ liệu (đọc) ────────────────────────────────────────────
        if clean_path.startswith("/api/data/"):
            key = clean_path.rsplit("/", 1)[-1]
            if key in db.SIMPLE_TABLE_CONFIG:
                self._send_json(200, db.get_simple_data(key))
                return

        if clean_path == "/api/data/csvc":
            self._send_json(200, db.get_csvc_data())
            return

        super().do_GET()

    # ── POST: đăng nhập / đăng xuất / lưu-sửa-xoá dữ liệu theo từng dòng ───
    def do_POST(self):
        clean_path = self._clean_path()

        if clean_path == "/api/login":
            self._handle_login()
            return

        if clean_path == "/api/logout":
            self._handle_logout()
            return

        # Mọi route /api/ còn lại đều yêu cầu đã đăng nhập
        if clean_path.startswith("/api/"):
            session = self._get_session()
            if not session:
                self._send_json(401, {"ok": False, "error": "unauthorized"})
                return

            if session.get("read_only", False):
                self._send_json(403, {"ok": False, "error": "Tài khoản demo chỉ có quyền xem, không có quyền chỉnh sửa."})
                return

        if clean_path.startswith("/api/row/"):
            parts = clean_path.split("/")
            # Route: /api/row/{key}/delete
            if len(parts) == 5 and parts[4] == "delete" and parts[3] in db.SIMPLE_TABLE_CONFIG:
                self._handle_delete_simple_row(parts[3])
                return
            # Route: /api/row/{key}
            if len(parts) == 4 and parts[3] in db.SIMPLE_TABLE_CONFIG:
                self._handle_save_simple_row(parts[3])
                return

        if clean_path == "/api/csvc/floor":
            self._handle_csvc_floor_save()
            return
        if clean_path == "/api/csvc/floor/delete":
            self._handle_csvc_floor_delete()
            return
        if clean_path == "/api/csvc/room":
            self._handle_csvc_room_save()
            return
        if clean_path == "/api/csvc/room/delete":
            self._handle_csvc_room_delete()
            return
        if clean_path == "/api/csvc/item":
            self._handle_csvc_item_save()
            return
        if clean_path == "/api/csvc/item/delete":
            self._handle_csvc_item_delete()
            return

        super().do_POST()

    # ── Đăng nhập ──────────────────────────────────────────────────────────
    def _handle_login(self):
        client_ip = self._client_ip()
        now = time.time()

        # Kiểm tra lockout theo IP (ngăn tấn công brute-force từ cùng một địa chỉ IP)
        ip_attempts = [t for t in LOGIN_ATTEMPTS.get(client_ip, []) if now - t < LOCKOUT_WINDOW_SECONDS]
        if len(ip_attempts) >= MAX_LOGIN_ATTEMPTS:
            self._send_json(429, {"ok": False, "error": "Quá nhiều lần thử sai. Vui lòng thử lại sau 15 phút."})
            return

        try:
            body = self._read_json_body()
            username = (body.get("username") or "").strip()[:128]  # giới hạn độ dài input
            password = (body.get("password") or "")[:256]

            if not username or not password:
                self._send_json(400, {"ok": False, "error": "Thiếu tên đăng nhập hoặc mật khẩu."})
                return

            # Kiểm tra lockout theo IP+username (ngăn tấn công brute-force nhắm vào tài khoản cụ thể)
            user_key = f"{client_ip}:{username}"
            user_attempts = [t for t in LOGIN_ATTEMPTS.get(user_key, []) if now - t < LOCKOUT_WINDOW_SECONDS]
            if len(user_attempts) >= MAX_LOGIN_ATTEMPTS:
                self._send_json(429, {"ok": False, "error": "Tài khoản tạm thời bị khoá. Vui lòng thử lại sau 15 phút."})
                return

            users_data = self._load_users()
            user = next((u for u in users_data.get("users", []) if u["username"].strip().lower() == username.lower()), None)

            valid = False
            if user:
                salt = bytes.fromhex(user["salt"])
                check_hash = hash_password(password, salt)
                valid = secrets.compare_digest(check_hash, user["password_hash"])
            else:
                # Vẫn hash để tránh timing attack dò tài khoản tồn tại hay không
                _dummy_salt = secrets.token_bytes(16)
                hash_password(password, _dummy_salt)

            if not valid:
                ip_attempts.append(now)
                LOGIN_ATTEMPTS[client_ip] = ip_attempts
                user_attempts.append(now)
                LOGIN_ATTEMPTS[user_key] = user_attempts
                self._send_json(401, {"ok": False, "error": "Tên đăng nhập hoặc mật khẩu không chính xác."})
                print(f"[AUTH] Đăng nhập thất bại cho '{username}' từ {client_ip}")
                return

            # Đăng nhập thành công — xoá lockout và tạo session mới
            LOGIN_ATTEMPTS.pop(client_ip, None)
            LOGIN_ATTEMPTS.pop(user_key, None)

            token = secrets.token_hex(32)
            SESSIONS[token] = {
                "username": user["username"],
                "name": user["name"],
                "role": user["role"],
                "read_only": bool(user.get("read_only", user.get("username") == "demo")),
                "expires": now + SESSION_DURATION,
            }
            _save_sessions()

            self._send_json(
                200,
                {
                    "ok": True,
                    "token": token,
                    "name": user["name"],
                    "role": user["role"],
                    "read_only": bool(user.get("read_only", user.get("username") == "demo"))
                },
                extra_headers={"Set-Cookie": self._cookie_header(token, SESSION_DURATION)},
            )
            print(f"[AUTH] '{username}' đăng nhập thành công từ {client_ip}")

        except Exception as e:
            self._send_json(500, {"ok": False, "error": str(e)})
            print(f"[AUTH ERROR] {str(e)}")

    def _handle_logout(self):
        session = self._get_session()
        if session:
            for t, s in list(SESSIONS.items()):
                if s == session:
                    SESSIONS.pop(t, None)
            _save_sessions()
        self._send_json(200, {"ok": True}, extra_headers={"Set-Cookie": self._clear_cookie_header()})

    # ── Bảng đơn giản: khoa (SV) / nhansu ──────────────────────────────────
    def _handle_save_simple_row(self, dataset_key):
        try:
            data = self._read_json_body()
            row_id = data.get("id")
            name = data.get("name")
            b_val = int(data.get("b", 0) or 0)
            c_val = int(data.get("c", 0) or 0)
            version = data.get("version")

            result = db.save_simple_row(dataset_key, row_id, name, b_val, c_val, version)

            if result.get("ok"):
                status = 200
            elif result.get("error") == "conflict":
                status = 409
            else:
                status = 400
            self._send_json(status, result)
        except Exception as e:
            self._send_json(500, {"ok": False, "error": str(e)})
            print(f"[API ERROR] save_simple_row({dataset_key}): {e}")

    def _handle_delete_simple_row(self, dataset_key):
        try:
            data = self._read_json_body()
            row_id = data.get("id")
            version = data.get("version")
            result = db.delete_simple_row(dataset_key, row_id, version)
            status = 200 if result.get("ok") else 409
            self._send_json(status, result)
        except Exception as e:
            self._send_json(500, {"ok": False, "error": str(e)})
            print(f"[API ERROR] delete_simple_row({dataset_key}): {e}")

    # ── Cơ sở vật chất ──────────────────────────────────────────────────────
    def _handle_csvc_floor_save(self):
        try:
            data = self._read_json_body()
            result = db.save_csvc_floor(data.get("id"), data.get("name"), data.get("version"))
            status = 200 if result.get("ok") else (409 if result.get("error") == "conflict" else 400)
            self._send_json(status, result)
        except Exception as e:
            self._send_json(500, {"ok": False, "error": str(e)})

    def _handle_csvc_floor_delete(self):
        try:
            data = self._read_json_body()
            result = db.delete_csvc_floor(data.get("id"), data.get("version"))
            status = 200 if result.get("ok") else 409
            self._send_json(status, result)
        except Exception as e:
            self._send_json(500, {"ok": False, "error": str(e)})

    def _handle_csvc_room_save(self):
        try:
            data = self._read_json_body()
            result = db.save_csvc_room(data.get("id"), data.get("floor_id"), data.get("room_name"), data.get("version"))
            status = 200 if result.get("ok") else (409 if result.get("error") == "conflict" else 400)
            self._send_json(status, result)
        except Exception as e:
            self._send_json(500, {"ok": False, "error": str(e)})

    def _handle_csvc_room_delete(self):
        try:
            data = self._read_json_body()
            result = db.delete_csvc_room(data.get("id"), data.get("version"))
            status = 200 if result.get("ok") else 409
            self._send_json(status, result)
        except Exception as e:
            self._send_json(500, {"ok": False, "error": str(e)})

    def _handle_csvc_item_save(self):
        try:
            data = self._read_json_body()
            result = db.save_csvc_item(
                data.get("id"), data.get("room_id"), data.get("name"), data.get("model", ""),
                int(data.get("quantity", 0) or 0), data.get("unit", "Cái"), data.get("notes", ""),
                data.get("version"),
            )
            status = 200 if result.get("ok") else (409 if result.get("error") == "conflict" else 400)
            self._send_json(status, result)
        except Exception as e:
            self._send_json(500, {"ok": False, "error": str(e)})

    def _handle_csvc_item_delete(self):
        try:
            data = self._read_json_body()
            result = db.delete_csvc_item(data.get("id"), data.get("version"))
            status = 200 if result.get("ok") else 409
            self._send_json(status, result)
        except Exception as e:
            self._send_json(500, {"ok": False, "error": str(e)})


def ensure_default_users():
    _load_sessions()
    os.makedirs(os.path.dirname(USERS_PATH), exist_ok=True)
    users_data = {"users": []}
    if os.path.exists(USERS_PATH):
        try:
            with open(USERS_PATH, "r", encoding="utf-8") as f:
                users_data = json.load(f)
        except Exception:
            users_data = {"users": []}

    users = users_data.get("users", [])
    updated = False

    admin_user = next((u for u in users if u.get("username") == "admin"), None)
    if not admin_user:
        salt = secrets.token_bytes(16)
        pwd_hash = hashlib.pbkdf2_hmac('sha256', "12345678".encode('utf-8'), salt, PBKDF2_ITERATIONS).hex()
        users.append({
            "username": "admin",
            "name": "Quản trị viên",
            "role": "Admin",
            "read_only": False,
            "salt": salt.hex(),
            "password_hash": pwd_hash
        })
        updated = True
    else:
        if "read_only" not in admin_user:
            admin_user["read_only"] = False
            updated = True

    demo_user = next((u for u in users if u.get("username") == "demo"), None)
    if not demo_user:
        salt = secrets.token_bytes(16)
        pwd_hash = hashlib.pbkdf2_hmac('sha256', "12345678".encode('utf-8'), salt, PBKDF2_ITERATIONS).hex()
        users.append({
            "username": "demo",
            "name": "Tài khoản Demo",
            "role": "Khách (Chỉ đọc)",
            "read_only": True,
            "salt": salt.hex(),
            "password_hash": pwd_hash
        })
        updated = True
    else:
        if "read_only" not in demo_user:
            demo_user["read_only"] = True
            updated = True

    if updated:
        users_data["users"] = users
        with open(USERS_PATH, "w", encoding="utf-8") as f:
            json.dump(users_data, f, ensure_ascii=False, indent=2)
        print("[AUTH] Đã tự động tạo/cập nhật tài khoản mặc định ('admin' & 'demo').")


if __name__ == "__main__":
    ensure_default_users()
    db.init_db()
    print(f"[DB] Đang dùng SQLite tại: {db.DB_PATH}")

    server_address = ('', PORT)
    httpd = http.server.ThreadingHTTPServer(server_address, DashboardHandler)
    print(f"Starting EduMetrics Web Server on port {PORT}...")
    print(f"SECURE_COOKIE={'ON' if SECURE_COOKIE else 'OFF (bật bằng env SECURE_COOKIE=1 khi đã có HTTPS)'}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server.")
        sys.exit(0)