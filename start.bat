@echo off
chcp 65001 >nul
title EduMetrics Dashboard - Khởi Động Hệ Thống

echo.
echo  ==================================================
echo   EDUMETRICS DASHBOARD - HE THONG QUAN LY TRUONG HOC
echo  ==================================================
echo.

:: Navigate to project directory
cd /d D:\school-dashboard

:: Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  [LOI] Khong tim thay Python tren may tinh!
    echo  Vui long cai dat Python tai: https://www.python.org/downloads/
    pause
    exit /b 1
)

echo  [1/2] Chuan bi du lieu Dashboard...

:: Optionally run data import if CSV exists
if exist data\import_data.csv (
    echo       Phat hien file import_data.csv - Dang xu ly du lieu...
    python backend\manage_data.py
    if %errorlevel% neq 0 (
        echo  [CANH BAO] Co loi khi chay manage_data.py, su dung du lieu cu.
    ) else (
        echo       Du lieu da duoc cap nhat thanh cong!
    )
) else (
    echo       Khong co file import_data.csv - Su dung du lieu san co.
)

echo.
echo  [2/2] Khoi dong may chu Web tai cong 8000...
echo.
echo  ==================================================
echo   TRUONG BROWSER SE TU MO - DUNG DONG CUA SO NAY!
echo   Nhan Ctrl+C de dung he thong.
echo  ==================================================
echo.

:: Open browser after short delay to let server start
powershell -Command "Start-Sleep -Seconds 2; Start-Process 'http://localhost:8000/frontend/login.html'"

:: Start Python HTTP server (blocks until Ctrl+C)
python backend\server.py

pause
