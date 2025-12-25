@echo off
setlocal
chcp 65001 >nul
title Adisyon POS Baslatici

echo 🚀 Adisyon POS Baslatiliyor...
echo.

cd /d "%~dp0"

:: Node.js Kontrolü
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ HATA: Node.js bulunamadi!
    echo Lutfen Node.js'i indirin: https://nodejs.org/
    pause
    exit /b 1
)

:: Bağımlılıkları Yükle
if not exist "node_modules" (
    echo 📦 Ilk kurulum yapiliyor...
    call npm install
    echo.
)

echo ✅ Server baslatiliyor...
echo Sayfayi otomatik acmak icin bekliyoruz...

:: Server'ı yeni pencerede başlat (Kullanıcı logları görsün ama ana akış devam etsin)
start "Adisyon Server Loglari" npm run dev

:: Server'ın ayağa kalkmasını bekle (Port 3000 kontrolü)
echo ⏳ Server bekleniyor...
:WAIT_LOOP
timeout /t 2 /nobreak >nul
curl -s http://localhost:3000 >nul 2>&1
if %errorlevel% neq 0 goto WAIT_LOOP

echo 🎉 Server hazir! Tarayici aciliyor...
start http://localhost:3000/dashboard

echo.
echo Sistemi kapatmak icin acilan diger pencereyi kapatabilirsiniz.
pause
