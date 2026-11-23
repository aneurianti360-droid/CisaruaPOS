@echo off
title Hentikan CisaruaPOS
echo Menghentikan server CisaruaPOS...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":3000" ^| findstr LISTENING') do (
  echo   PID %%p
  taskkill /PID %%p /F >nul 2>nul
)
echo Selesai.
timeout /t 2 >nul
