# -*- coding: utf-8 -*-
"""
Lớp truy cập dữ liệu SQLite cho EduMetrics Dashboard.

Vì sao đổi từ CSV/JSON sang SQLite:
- Nhiều người dùng trong LAN cùng nhập liệu -> cần lưu/khoá theo TỪNG DÒNG
  thay vì ghi đè cả file mỗi lần lưu (cách cũ dễ làm mất dữ liệu người khác
  vừa thêm nếu 2 người submit gần như cùng lúc).
- Mỗi dòng có cột `version`. Khi client gửi sửa 1 dòng, server so version
  client đang có với version hiện tại trong DB:
    - Khớp   -> cho ghi, version + 1.
    - Không khớp -> báo "conflict" (đã có người khác sửa dòng này), KHÔNG ghi
      đè, để client tải lại dữ liệu mới nhất thay vì mất dữ liệu âm thầm.
- Vẫn là 1 file duy nhất (data/school.db), không cần cài đặt server DB rời,
  không đổi cách khởi động qua start.bat / khoi_dong.bat.

Lần chạy đầu tiên (chưa có data/school.db), module sẽ tự động nhập dữ liệu
từ các file JSON cũ (student_statistics.json, staff_statistics.json,
facilities_statistics.json) nếu có, để không mất dữ liệu khi nâng cấp.
"""
import os
import json
import sqlite3
import time

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
SEED_DIR = os.path.join(BASE_DIR, "seed_data")
DB_PATH = os.path.join(DATA_DIR, "school.db")

def _get_json_path(filename):
    data_path = os.path.join(DATA_DIR, filename)
    if os.path.exists(data_path):
        return data_path
    seed_path = os.path.join(SEED_DIR, filename)
    if os.path.exists(seed_path):
        return seed_path
    return None

LEGACY_KHOA_JSON = _get_json_path("student_statistics.json")
LEGACY_NHANSU_JSON = _get_json_path("staff_statistics.json")
LEGACY_CSVC_JSON = _get_json_path("facilities_statistics.json")

SCHEMA = """
CREATE TABLE IF NOT EXISTS khoa_departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    registered INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS nhansu_departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    male INTEGER NOT NULL DEFAULT 0,
    female INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS csvc_floors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    floor_key TEXT,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS csvc_rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    floor_id INTEGER NOT NULL REFERENCES csvc_floors(id) ON DELETE CASCADE,
    room_name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS csvc_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL REFERENCES csvc_rooms(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT '',
    model TEXT NOT NULL DEFAULT '',
    quantity INTEGER NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT 'Cái',
    notes TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hoc_sinh_9plus_departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    registered INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_khoa_sort ON khoa_departments(sort_order);
CREATE INDEX IF NOT EXISTS idx_hoc_sinh_9plus_sort ON hoc_sinh_9plus_departments(sort_order);
CREATE INDEX IF NOT EXISTS idx_nhansu_sort ON nhansu_departments(sort_order);
CREATE INDEX IF NOT EXISTS idx_csvc_rooms_floor ON csvc_rooms(floor_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_csvc_items_room ON csvc_items(room_id, sort_order);
"""

# ── Registry cho các bảng "đơn giản" (tên + 2 cột số) ─────────────────────
SIMPLE_TABLE_CONFIG = {
    "khoa": {
        "table": "khoa_departments",
        "field_b": "registered",
        "field_c": "active",
        "mode": "ratio",
        "title": "Sinh viên Cao đẳng",
    },
    "hoc_sinh_9plus": {
        "table": "hoc_sinh_9plus_departments",
        "field_b": "registered",
        "field_c": "active",
        "mode": "ratio",
        "title": "Học sinh 9+",
    },
    "nhansu": {
        "table": "nhansu_departments",
        "field_b": "male",
        "field_c": "female",
        "mode": "sum",
        "title": "Nhân sự theo khoa",
    },
}


def _now():
    return time.strftime("%Y-%m-%dT%H:%M:%S")


def get_conn():
    os.makedirs(DATA_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    # An toàn khi đi cùng WAL (không mất dữ liệu nếu mất điện/crash), nhưng
    # nhanh hơn hẳn "FULL" mặc định - quan trọng khi nhiều người autosave
    # liên tục (mỗi 500ms) qua LAN.
    conn.execute("PRAGMA synchronous=NORMAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn


def init_db():
    """Tạo bảng nếu chưa có. Nếu DB hoàn toàn mới, nhập dữ liệu cũ (JSON) vào."""
    is_new_db = not os.path.exists(DB_PATH)
    conn = get_conn()
    try:
        conn.executescript(SCHEMA)
        conn.commit()

        # Kiểm tra và tự động khởi tạo dữ liệu mẫu cho Học sinh 9+ nếu bảng trống
        count_9plus = conn.execute("SELECT COUNT(*) FROM hoc_sinh_9plus_departments").fetchone()[0]
        if count_9plus == 0:
            now = _now()
            default_9plus = [
                ("Công nghệ thông tin 9+", 45, 42),
                ("Điện - Điện tử 9+", 38, 35),
                ("Thiết kế đồ họa 9+", 30, 28),
                ("Quản trị khách sạn 9+", 25, 23),
                ("Chế biến món ăn 9+", 20, 19),
            ]
            for idx, (name, reg, act) in enumerate(default_9plus):
                conn.execute(
                    "INSERT INTO hoc_sinh_9plus_departments (name, registered, active, sort_order, version, updated_at) "
                    "VALUES (?, ?, ?, ?, 1, ?)",
                    (name, reg, act, idx, now)
                )
            conn.commit()
            print("[DB] Khởi tạo thành công dữ liệu mẫu cho Học sinh 9+")
    finally:
        conn.close()
    if is_new_db:
        _migrate_legacy_json()


def _migrate_legacy_json():
    conn = get_conn()
    try:
        now = _now()
        khoa_json = _get_json_path("student_statistics.json")
        nhansu_json = _get_json_path("staff_statistics.json")
        csvc_json = _get_json_path("facilities_statistics.json")

        if khoa_json and os.path.exists(khoa_json):
            with open(khoa_json, encoding="utf-8") as f:
                data = json.load(f)
            for i, d in enumerate(data.get("departments", [])):
                conn.execute(
                    "INSERT INTO khoa_departments (name, registered, active, sort_order, version, updated_at) "
                    "VALUES (?, ?, ?, ?, 1, ?)",
                    (d.get("name", ""), int(d.get("registered", 0) or 0), int(d.get("active", 0) or 0), i, now),
                )

        if nhansu_json and os.path.exists(nhansu_json):
            with open(nhansu_json, encoding="utf-8") as f:
                data = json.load(f)
            for i, d in enumerate(data.get("departments", [])):
                conn.execute(
                    "INSERT INTO nhansu_departments (name, male, female, sort_order, version, updated_at) "
                    "VALUES (?, ?, ?, ?, 1, ?)",
                    (d.get("name", ""), int(d.get("male", 0) or 0), int(d.get("female", 0) or 0), i, now),
                )

        if csvc_json and os.path.exists(csvc_json):
            with open(csvc_json, encoding="utf-8") as f:
                data = json.load(f)
            for fi, floor in enumerate(data.get("floors", [])):
                fcur = conn.execute(
                    "INSERT INTO csvc_floors (floor_key, name, sort_order, version, updated_at) "
                    "VALUES (?, ?, ?, 1, ?)",
                    (floor.get("id", ""), floor.get("name", ""), fi, now),
                )
                floor_id = fcur.lastrowid
                for ri, room in enumerate(floor.get("rooms", [])):
                    rcur = conn.execute(
                        "INSERT INTO csvc_rooms (floor_id, room_name, sort_order, version, updated_at) "
                        "VALUES (?, ?, ?, 1, ?)",
                        (floor_id, room.get("room_name", ""), ri, now),
                    )
                    room_id = rcur.lastrowid
                    for ii, item in enumerate(room.get("items", [])):
                        conn.execute(
                            "INSERT INTO csvc_items "
                            "(room_id, name, model, quantity, unit, notes, sort_order, version, updated_at) "
                            "VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)",
                            (
                                room_id,
                                item.get("name", ""),
                                item.get("model", ""),
                                int(item.get("quantity", 0) or 0),
                                item.get("unit", "Cái"),
                                item.get("notes", ""),
                                ii,
                                now,
                            ),
                        )

        conn.commit()
        print("[DB] Lần đầu khởi tạo: đã nhập dữ liệu cũ (JSON) vào data/school.db")
    finally:
        conn.close()


# ── Bảng đơn giản: khoa (SV), nhansu ───────────────────────────────────────
def get_simple_data(dataset_key):
    cfg = SIMPLE_TABLE_CONFIG[dataset_key]
    table, field_b, field_c = cfg["table"], cfg["field_b"], cfg["field_c"]
    conn = get_conn()
    try:
        rows = conn.execute(f"SELECT * FROM {table} ORDER BY sort_order, id").fetchall()
        departments = []
        total_b = total_c = 0
        for r in rows:
            b_val, c_val = r[field_b], r[field_c]
            dept = {"id": r["id"], "name": r["name"], field_b: b_val, field_c: c_val, "version": r["version"]}
            if cfg["mode"] == "ratio":
                dept["dropped"] = max(0, b_val - c_val)
            departments.append(dept)
            total_b += b_val
            total_c += c_val

        summary = {"title": cfg["title"], field_b: total_b, field_c: total_c}
        if cfg["mode"] == "ratio":
            summary["dropped"] = max(0, total_b - total_c)
        else:
            summary["total"] = total_b + total_c

        return {"summary": summary, "departments": departments}
    finally:
        conn.close()


def save_simple_row(dataset_key, row_id, name, b_val, c_val, version):
    if dataset_key not in SIMPLE_TABLE_CONFIG:
        return {"ok": False, "error": "invalid_dataset"}
    cfg = SIMPLE_TABLE_CONFIG[dataset_key]
    table, field_b, field_c = cfg["table"], cfg["field_b"], cfg["field_c"]

    name = (name or "").strip()
    if not name:
        return {"ok": False, "error": "empty_name"}

    if cfg["mode"] == "ratio" and c_val > b_val:
        c_val = b_val  # an toàn: "còn học" không được lớn hơn "đăng ký"

    conn = get_conn()
    try:
        now = _now()

        if row_id is None:
            cur = conn.execute(
                f"INSERT INTO {table} (name, {field_b}, {field_c}, sort_order, version, updated_at) "
                f"VALUES (?, ?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM {table}), 1, ?)",
                (name, b_val, c_val, now),
            )
            conn.commit()
            row = {"id": cur.lastrowid, "name": name, field_b: b_val, field_c: c_val, "version": 1}
            if cfg["mode"] == "ratio":
                row["dropped"] = max(0, b_val - c_val)
            return {"ok": True, "row": row}

        existing = conn.execute(f"SELECT * FROM {table} WHERE id = ?", (row_id,)).fetchone()
        if existing is None:
            return {"ok": False, "error": "not_found"}

        if existing["version"] != version:
            server_row = {
                "id": existing["id"], "name": existing["name"],
                field_b: existing[field_b], field_c: existing[field_c],
                "version": existing["version"],
            }
            return {"ok": False, "error": "conflict", "server_row": server_row}

        new_version = version + 1
        conn.execute(
            f"UPDATE {table} SET name = ?, {field_b} = ?, {field_c} = ?, version = ?, updated_at = ? "
            f"WHERE id = ? AND version = ?",
            (name, b_val, c_val, new_version, now, row_id, version),
        )
        conn.commit()
        row = {"id": row_id, "name": name, field_b: b_val, field_c: c_val, "version": new_version}
        if cfg["mode"] == "ratio":
            row["dropped"] = max(0, b_val - c_val)
        return {"ok": True, "row": row}
    finally:
        conn.close()


def delete_simple_row(dataset_key, row_id, version):
    if dataset_key not in SIMPLE_TABLE_CONFIG:
        return {"ok": False, "error": "invalid_dataset"}
    table = SIMPLE_TABLE_CONFIG[dataset_key]["table"]
    conn = get_conn()
    try:
        existing = conn.execute(f"SELECT version FROM {table} WHERE id = ?", (row_id,)).fetchone()
        if existing is None:
            return {"ok": True}  # đã bị xoá từ trước, coi như thành công
        if existing["version"] != version:
            return {"ok": False, "error": "conflict"}
        conn.execute(f"DELETE FROM {table} WHERE id = ? AND version = ?", (row_id, version))
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


# ── Cơ sở vật chất (floors -> rooms -> items) ──────────────────────────────
def get_csvc_data():
    # Trước đây: 1 query lấy tầng + 1 query/tầng để lấy phòng + 1 query/phòng
    # để lấy thiết bị (N+1). Với vài chục phòng, mỗi lần tải tab CSVC tốn
    # vài chục lượt round-trip tới SQLite. Gộp lại thành 1 JOIN duy nhất,
    # rồi dựng lại cấu trúc lồng nhau (floors -> rooms -> items) ngay trong
    # Python. Kết quả trả về giữ nguyên 100% so với bản trước.
    conn = get_conn()
    try:
        rows = conn.execute(
            """
            SELECT
                f.id AS floor_id, f.name AS floor_name, f.version AS floor_version,
                r.id AS room_id, r.room_name AS room_name, r.version AS room_version,
                i.id AS item_id, i.name AS item_name, i.model AS item_model,
                i.quantity AS item_quantity, i.unit AS item_unit, i.notes AS item_notes,
                i.version AS item_version
            FROM csvc_floors f
            LEFT JOIN csvc_rooms r ON r.floor_id = f.id
            LEFT JOIN csvc_items i ON i.room_id = r.id
            ORDER BY f.sort_order, f.id, r.sort_order, r.id, i.sort_order, i.id
            """
        ).fetchall()

        floors_by_id = {}
        floor_order = []
        rooms_by_id = {}
        total_qty = 0
        seen_room_ids = set()

        for row in rows:
            fid = row["floor_id"]
            if fid not in floors_by_id:
                floors_by_id[fid] = {
                    "id": fid, "name": row["floor_name"], "version": row["floor_version"], "rooms": []
                }
                floor_order.append(fid)

            rid = row["room_id"]
            if rid is None:
                continue  # tầng chưa có phòng nào

            if rid not in rooms_by_id:
                room_obj = {"id": rid, "room_name": row["room_name"], "version": row["room_version"], "items": []}
                rooms_by_id[rid] = room_obj
                floors_by_id[fid]["rooms"].append(room_obj)

            if rid not in seen_room_ids:
                seen_room_ids.add(rid)

            iid = row["item_id"]
            if iid is None:
                continue  # phòng chưa có thiết bị nào

            rooms_by_id[rid]["items"].append({
                "id": iid, "name": row["item_name"], "model": row["item_model"],
                "quantity": row["item_quantity"], "unit": row["item_unit"],
                "notes": row["item_notes"], "version": row["item_version"],
            })
            total_qty += row["item_quantity"]

        result_floors = [floors_by_id[fid] for fid in floor_order]
        total_rooms = len(rooms_by_id)

        summary = {
            "title": "Cơ sở vật chất trường học",
            "total_quantity": total_qty,
            "total_rooms": total_rooms,
            "total_areas": len(result_floors),
        }
        return {"summary": summary, "floors": result_floors}
    finally:
        conn.close()


def save_csvc_floor(row_id, name, version):
    name = (name or "").strip() or "Khu vực mới"
    conn = get_conn()
    try:
        now = _now()
        if row_id is None:
            cur = conn.execute(
                "INSERT INTO csvc_floors (name, sort_order, version, updated_at) "
                "VALUES (?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM csvc_floors), 1, ?)",
                (name, now),
            )
            conn.commit()
            return {"ok": True, "row": {"id": cur.lastrowid, "name": name, "version": 1}}

        existing = conn.execute("SELECT * FROM csvc_floors WHERE id = ?", (row_id,)).fetchone()
        if existing is None:
            return {"ok": False, "error": "not_found"}
        if existing["version"] != version:
            return {"ok": False, "error": "conflict",
                     "server_row": {"id": existing["id"], "name": existing["name"], "version": existing["version"]}}
        new_version = version + 1
        conn.execute("UPDATE csvc_floors SET name = ?, version = ?, updated_at = ? WHERE id = ? AND version = ?",
                     (name, new_version, now, row_id, version))
        conn.commit()
        return {"ok": True, "row": {"id": row_id, "name": name, "version": new_version}}
    finally:
        conn.close()


def delete_csvc_floor(row_id, version):
    conn = get_conn()
    try:
        existing = conn.execute("SELECT version FROM csvc_floors WHERE id = ?", (row_id,)).fetchone()
        if existing is None:
            return {"ok": True}
        if existing["version"] != version:
            return {"ok": False, "error": "conflict"}
        conn.execute("DELETE FROM csvc_floors WHERE id = ? AND version = ?", (row_id, version))
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


def save_csvc_room(row_id, floor_id, room_name, version):
    room_name = (room_name or "").strip() or "Phòng mới"
    conn = get_conn()
    try:
        now = _now()
        if row_id is None:
            cur = conn.execute(
                "INSERT INTO csvc_rooms (floor_id, room_name, sort_order, version, updated_at) "
                "VALUES (?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM csvc_rooms WHERE floor_id = ?), 1, ?)",
                (floor_id, room_name, floor_id, now),
            )
            conn.commit()
            return {"ok": True, "row": {"id": cur.lastrowid, "room_name": room_name, "version": 1}}

        existing = conn.execute("SELECT * FROM csvc_rooms WHERE id = ?", (row_id,)).fetchone()
        if existing is None:
            return {"ok": False, "error": "not_found"}
        if existing["version"] != version:
            return {"ok": False, "error": "conflict",
                     "server_row": {"id": existing["id"], "room_name": existing["room_name"],
                                    "version": existing["version"]}}
        new_version = version + 1
        conn.execute(
            "UPDATE csvc_rooms SET room_name = ?, version = ?, updated_at = ? WHERE id = ? AND version = ?",
            (room_name, new_version, now, row_id, version),
        )
        conn.commit()
        return {"ok": True, "row": {"id": row_id, "room_name": room_name, "version": new_version}}
    finally:
        conn.close()


def delete_csvc_room(row_id, version):
    conn = get_conn()
    try:
        existing = conn.execute("SELECT version FROM csvc_rooms WHERE id = ?", (row_id,)).fetchone()
        if existing is None:
            return {"ok": True}
        if existing["version"] != version:
            return {"ok": False, "error": "conflict"}
        conn.execute("DELETE FROM csvc_rooms WHERE id = ? AND version = ?", (row_id, version))
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


def save_csvc_item(row_id, room_id, name, model, quantity, unit, notes, version):
    name = (name or "").strip()
    conn = get_conn()
    try:
        now = _now()
        if row_id is None:
            cur = conn.execute(
                "INSERT INTO csvc_items (room_id, name, model, quantity, unit, notes, sort_order, version, updated_at) "
                "VALUES (?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM csvc_items WHERE room_id = ?), 1, ?)",
                (room_id, name, model, quantity, unit, notes, room_id, now),
            )
            conn.commit()
            return {"ok": True, "row": {
                "id": cur.lastrowid, "name": name, "model": model, "quantity": quantity,
                "unit": unit, "notes": notes, "version": 1,
            }}

        existing = conn.execute("SELECT * FROM csvc_items WHERE id = ?", (row_id,)).fetchone()
        if existing is None:
            return {"ok": False, "error": "not_found"}
        if existing["version"] != version:
            return {"ok": False, "error": "conflict", "server_row": {
                "id": existing["id"], "name": existing["name"], "model": existing["model"],
                "quantity": existing["quantity"], "unit": existing["unit"], "notes": existing["notes"],
                "version": existing["version"],
            }}
        new_version = version + 1
        conn.execute(
            "UPDATE csvc_items SET name=?, model=?, quantity=?, unit=?, notes=?, version=?, updated_at=? "
            "WHERE id=? AND version=?",
            (name, model, quantity, unit, notes, new_version, now, row_id, version),
        )
        conn.commit()
        return {"ok": True, "row": {
            "id": row_id, "name": name, "model": model, "quantity": quantity,
            "unit": unit, "notes": notes, "version": new_version,
        }}
    finally:
        conn.close()


def delete_csvc_item(row_id, version):
    conn = get_conn()
    try:
        existing = conn.execute("SELECT version FROM csvc_items WHERE id = ?", (row_id,)).fetchone()
        if existing is None:
            return {"ok": True}
        if existing["version"] != version:
            return {"ok": False, "error": "conflict"}
        conn.execute("DELETE FROM csvc_items WHERE id = ? AND version = ?", (row_id, version))
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()