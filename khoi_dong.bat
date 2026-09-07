@echo off
chcp 65001 >nul
title EduMetrics Dashboard - Khoi dong

:: ── Chuyen den thu muc du an ─────────────────────────────────────────────
cd /d "%~dp0"

echo.
echo  =========================================================
echo   EDUMETRICS DASHBOARD - HE THONG QUAN LY TRUONG HOC
echo  =========================================================
echo.

:: ── Kiem tra Python ───────────────────────────────────────────────────────
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  [LOI] Khong tim thay Python!
    echo  Vui long cai tai: https://www.python.org/downloads/
    echo.
    pause
    exit /b 1
)
echo  [OK] Tim thay Python.

:: ── Kiem tra file users.json - neu chua co thi tao admin mac dinh ────────
if not exist data\users.json (
    echo.
    echo  [CANH BAO] Chua co tai khoan - Dang tao tai khoan admin mac dinh...
    python -c "
import json, os, secrets, hashlib
USERS_PATH = os.path.join('data', 'users.json')
os.makedirs('data', exist_ok=True)
salt = secrets.token_bytes(16)
pwd_hash = hashlib.pbkdf2_hmac('sha256', b'12345678', salt, 200000)
data = {'users': [{'username': 'admin', 'name': 'Quan tri vien', 'role': 'Truong phong', 'salt': salt.hex(), 'password_hash': pwd_hash.hex()}]}
with open(USERS_PATH, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print('Da tao tai khoan admin / mat khau: 12345678')
"
    echo.
)

echo  [OK] Tai khoan da san sang.
echo.

:: ── Mo trinh duyet sau 2 giay ─────────────────────────────────────────────
echo  [1/2] Dang mo trinh duyet...
start "" powershell -WindowStyle Hidden -Command "Start-Sleep 2; Start-Process 'http://localhost:8000'"

:: ── Khoi dong may chu ─────────────────────────────────────────────────────
echo  [2/2] Khoi dong may chu tai cong 8000...
echo.
echo  =========================================================
echo   DANG CHAY - KHONG DONG CUA SO NAY!
echo   De dung: nhan Ctrl+C
echo.
echo   Dang nhap:  http://localhost:8000
echo   Username :  admin
echo   Mat khau :  12345678
echo  =========================================================
echo.

python backend\server.py

echo.
echo  [INFO] May chu da dung.
pause
