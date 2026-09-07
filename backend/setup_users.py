# -*- coding: utf-8 -*-
"""
Script tạo / cập nhật tài khoản đăng nhập cho EduMetrics Dashboard.

Chạy trực tiếp trên máy chủ (sau khi đã deploy) hoặc trên máy local rồi copy
file data/users.json lên server. KHÔNG commit file data/users.json lên Git
public — dù mật khẩu đã được hash, không nên để lộ salt/hash ra ngoài.

Cách dùng:
    python backend/setup_users.py
"""
import json
import os
import sys
import secrets
import hashlib
import getpass

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
USERS_PATH = os.path.join(SCRIPT_DIR, '..', 'data', 'users.json')
PBKDF2_ITERATIONS = 200_000

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')


def hash_password(password: str, salt: bytes = None):
    if salt is None:
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


def list_users(data):
    if not data["users"]:
        print("  (chưa có tài khoản nào)")
        return
    for u in data["users"]:
        ro_str = " [Chỉ đọc]" if u.get("read_only") else ""
        print(f"  - {u['username']}  ({u['name']}, {u['role']}){ro_str}")


def main():
    print("=" * 60)
    print(" QUẢN LÝ TÀI KHOẢN ĐĂNG NHẬP - EDUMETRICS")
    print("=" * 60)

    data = load_users()
    print("\nTài khoản hiện có:")
    list_users(data)

    print("\n1) Tạo tài khoản mới / cập nhật mật khẩu")
    print("2) Xoá một tài khoản")
    print("3) Thoát")
    choice = input("\nChọn (1/2/3): ").strip()

    if choice == "1":
        username = input("Username: ").strip()
        if not username:
            print("Username không được để trống.")
            return
        name = input("Họ tên hiển thị: ").strip()
        role = input("Chức vụ (vd: Trưởng phòng Đào tạo): ").strip()
        is_ro_input = input("Tài khoản chỉ đọc (chỉ xem, không sửa)? (y/n, Enter để dùng n): ").strip().lower()
        is_read_only = (is_ro_input == 'y') or (username == 'demo')

        while True:
            password = getpass.getpass("Mật khẩu (ít nhất 8 ký tự): ")
            if len(password) < 8:
                print("Mật khẩu quá ngắn, nhập lại.")
                continue
            confirm = getpass.getpass("Nhập lại mật khẩu: ")
            if password != confirm:
                print("Mật khẩu không khớp, nhập lại.")
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
        print(f"Đã lưu vào {os.path.abspath(USERS_PATH)}")

    elif choice == "2":
        username = input("Username cần xoá: ").strip()
        before = len(data["users"])
        data["users"] = [u for u in data["users"] if u["username"] != username]
        if len(data["users"]) < before:
            save_users(data)
            print(f"✔ Đã xoá '{username}'.")
        else:
            print("Không tìm thấy username này.")

    else:
        print("Thoát.")


if __name__ == '__main__':
    main()