# -*- coding: utf-8 -*-
"""
Script tạo / đặt lại tài khoản admin mặc định cho EduMetrics Dashboard.
Chạy: python tao_tai_khoan.py
"""
import json, os, sys, secrets, hashlib, getpass

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
USERS_PATH = os.path.join(SCRIPT_DIR, 'data', 'users.json')
PBKDF2_ITERATIONS = 200_000

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')


def hash_password(password: str):
    salt = secrets.token_bytes(16)
    pwd_hash = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, PBKDF2_ITERATIONS)
    return salt.hex(), pwd_hash.hex()


def load_users():
    if os.path.exists(USERS_PATH):
        with open(USERS_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {"users": []}


def save_users(data):
    os.makedirs(os.path.dirname(USERS_PATH), exist_ok=True)
    with open(USERS_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def main():
    print("=" * 55)
    print("  QUẢN LÝ TÀI KHOẢN - EDUMETRICS DASHBOARD")
    print("=" * 55)

    data = load_users()

    print("\nTài khoản hiện có:")
    if data["users"]:
        for u in data["users"]:
            ro_str = " [Chỉ đọc]" if u.get("read_only") else ""
            print(f"  - {u['username']}  ({u['name']}, {u['role']}){ro_str}")
    else:
        print("  (chưa có tài khoản nào)")

    print("\n1) Tạo tài khoản mới / đặt lại mật khẩu")
    print("2) Xoá một tài khoản")
    print("3) Thoát")
    choice = input("\nChọn (1/2/3): ").strip()

    if choice == "1":
        username = input("Username: ").strip()
        if not username:
            print("Username không được để trống.")
            return
        name = input("Họ tên hiển thị (Enter để dùng username): ").strip() or username
        role = input("Chức vụ (Enter để dùng 'Quản trị viên'): ").strip() or "Quản trị viên"
        is_ro_input = input("Tài khoản chỉ đọc (chỉ xem, không sửa)? (y/n, Enter để dùng n): ").strip().lower()
        is_read_only = (is_ro_input == 'y') or (username == 'demo')

        while True:
            password = getpass.getpass("Mật khẩu (ít nhất 8 ký tự): ")
            if len(password) < 8:
                print("Mật khẩu phải từ 8 ký tự trở lên.")
                continue
            confirm = getpass.getpass("Nhập lại mật khẩu: ")
            if password != confirm:
                print("Mật khẩu không khớp, thử lại.")
                continue
            break

        salt_hex, hash_hex = hash_password(password)
        existing = next((u for u in data["users"] if u["username"] == username), None)
        if existing:
            existing.update({"name": name, "role": role, "read_only": is_read_only, "salt": salt_hex, "password_hash": hash_hex})
            print(f"\n✔ Đã cập nhật tài khoản '{username}'.")
        else:
            data["users"].append({
                "username": username, "name": name, "role": role, "read_only": is_read_only,
                "salt": salt_hex, "password_hash": hash_hex,
            })
            print(f"\n✔ Đã tạo tài khoản '{username}'.")

        save_users(data)
        print(f"Đã lưu vào: {os.path.abspath(USERS_PATH)}")

    elif choice == "2":
        username = input("Username cần xoá: ").strip()
        before = len(data["users"])
        data["users"] = [u for u in data["users"] if u["username"] != username]
        if len(data["users"]) < before:
            save_users(data)
            print(f"✔ Đã xoá tài khoản '{username}'.")
        else:
            print("Không tìm thấy username này.")
    else:
        print("Thoát.")


if __name__ == '__main__':
    main()
