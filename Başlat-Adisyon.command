#!/bin/bash

# Adisyon POS Başlatıcı - macOS
# Bu dosyayı çift tıklayarak Adisyon sistemini başlatabilirsiniz

echo "🚀 Adisyon POS Başlatılıyor..."
echo ""

# Proje klasörüne git
cd "$(dirname "$0")"

# Eğer node_modules yoksa npm install çalıştır
if [ ! -d "node_modules" ]; then
    echo "📦 İlk kurulum yapılıyor... (Bu sadece bir kez olacak)"
    npm install
    echo ""
fi

# Node.js kontrolü
if ! command -v node &> /dev/null; then
    echo "❌ HATA: Node.js bulunamadı!"
    echo ""
    echo "Lütfen Node.js'i şuradan indirin:"
    echo "https://nodejs.org/"
    echo ""
    read -p "Devam etmek için Enter'a basın..."
    exit 1
fi

# Server'ı başlat
echo "✅ Server başlatılıyor..."
echo ""
echo "─────────────────────────────────────────"
echo "📱 LOKAL AĞ İÇİN BİLGİLENDİRME:"
echo "─────────────────────────────────────────"
echo ""

# Arka planda sunucuyu başlat ve PID'yi kaydet
npm run dev &
SERVER_PID=$!

# Server'ın başlamasını bekle (Port 3000)
echo "⏳ Server'ın başlaması bekleniyor..."
while ! nc -z localhost 3000; do   
  sleep 1 # 1 saniye bekle
done

echo "🎉 Server hazır! Tarayıcı açılıyor..."
echo ""
# Tarayıcıyı aç
open "http://localhost:3000/dashboard"

# Server process'ini ön plana al ve bekle
wait $SERVER_PID


# Server durdurulduğunda
echo ""
echo "Server kapatıldı. Pencereyi kapatabilirsiniz."
read -p "Çıkmak için Enter'a basın..."
