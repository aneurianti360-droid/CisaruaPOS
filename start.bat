@echo off
title CisaruaPOS Server
cd /d "%~dp0"
echo ============================================
echo   CisaruaPOS - Kantin ^& Koperasi Sekolah
echo ============================================
echo.
echo Menjalankan server di http://localhost:3000
echo JANGAN tutup jendela ini selama memakai aplikasi.
echo Tekan Ctrl+C untuk menghentikan server.
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js tidak ditemukan. Install dulu dari https://nodejs.org
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Memasang dependensi (sekali saja, butuh internet)...
  call npm install
)

start "" http://localhost:3000
node server.js

echo.
echo Server berhenti.
pause
