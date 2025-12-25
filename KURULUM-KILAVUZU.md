# 🚀 Adisyon POS - Kurulum ve Kullanım Kılavuzu

## 📋 İçindekiler
1. [macOS Kurulum](#macos-kurulum)
2. [iPadOS Kurulum](#ipados-kurulum)
3. [İlk Kullanım](#ilk-kullanım)

---

## 🍎 macOS Kurulum

### Gereksinimler
- macOS 10.15 veya üstü
- [Node.js](https://nodejs.org/) (v18 veya üstü)

### Kurulum Adımları

#### 1️⃣ İlk Kurulum (Tek seferlik)

**Node.js Kurulumu:**
1. [nodejs.org](https://nodejs.org/) sitesine git
2. "LTS" (Önerilen) versiyonu indir
3. İndirilen `.pkg` dosyasını çift tıkla ve kurulumu tamamla

**Bağımlılıkları Yükle:**
```bash
# Terminal'i aç (⌘+Space → "Terminal" yaz)
# Proje klasörüne git:
cd "/Users/darklost_tr/Library/Mobile Documents/com~apple~CloudDocs/Software Development /billing_system"

# Bağımlılıkları yükle:
npm install
```

#### 2️⃣ Server Başlatma

**Kolay Yol (Çift Tıkla):**
1. `Başlat-Adisyon.command` dosyasını bul
2. Çift tıkla
3. "Güvenlik uyarısı" gelirse:
   - Sistem Ayarları → Güvenlik ve Gizlilik
   - "Yine de Aç" butonuna tıkla

**Terminal'den:**
```bash
cd "/Users/darklost_tr/Library/Mobile Documents/com~apple~CloudDocs/Software Development /billing_system"
npm run dev
```

#### 3️⃣ Uygulamayı Aç
Server başladıktan sonra terminal'de göreceksin:
```
> Ready on http://localhost:3000

📱 Lokal ağ üzerinden erişim:
   http://192.168.x.x:3000
```

**Tarayıcıda aç:**
- Lokal kullanım: `http://localhost:3000`
- PWA olarak yükle: Chrome → Adres çubuğu → ⊕ Yükle

---

## 📱 iPadOS Kurulum

### ⚠️ Önemli Bilgi
iPadOS'ta **Node.js server çalıştıramazsınız**. Ama걱정 yok! PWA olarak kullanabilirsiniz.

### Kullanım Senaryoları

#### Senaryo 1: Mac'te Server + iPad'de Kullanım (Önerilen)
1. **Mac'te:**
   - `Başlat-Adisyon.command` ile server'ı başlat
   - Terminal'de gösterilen IP adresini not al (örn: `192.168.1.100`)

2. **iPad'de:**
   - Aynı WiFi ağına bağlan
   - Safari'de aç: `http://192.168.1.100:3000`
   - Paylaş butonu (□↑) → **"Ana Ekrana Ekle"**
   - İsim: "Adisyon"
   - Ekle

3. **Kullanım:**
   - Ana ekranda "Adisyon" ikonuna dokun
   - Tam ekran uygulama gibi açılır!

#### Senaryo 2: Cloud Server (Her Yerden Erişim)
Eğer iPadOS'tan bağımsız kullanmak istersen:
1. Sistemi bir cloud servera deploy et (Heroku, Railway, vb.)
2. iPad'den cloud adresine bağlan
3. Ana ekrana ekle

**Not:** Bu seçenek ücretli olabilir ve internet gerektirir.

---

## 🎯 İlk Kullanım

### 1. Kayıt Ol
- Tarayıcıda: `http://localhost:3000/register`
- İlk kasiyer hesabını oluştur
- Otomatik giriş yapılacak

### 2. Garson Hesapları Ekle
- Dashboard → Ayarlar (⚙️)
- "Staff" sekmesi
- "Add Waiter" ile garson ekle

### 3. Garson Girişi
- iPad/Telefon: Aynı WiFi'ye bağlan
- `http://192.168.x.x:3000/login` aç
- Garson bilgileriyle giriş yap

### 4. Sipariş Ver
- Garson hesabıyla: `/waiter` → Masa seç → Sipariş ver
- Kasiyer Dashboard'da: Masaya tıkla → Siparişi gör

---

## 🛠️ Sorun Giderme

### macOS'ta "Açılamıyor" Hatası
**Çözüm:**
```bash
# Terminal'de:
chmod +x "/Users/darklost_tr/Library/Mobile Documents/com~apple~CloudDocs/Software Development /billing_system/Başlat-Adisyon.command"
```

### Port 3000 Zaten Kullanılıyor
**Çözüm:**
```bash
# Eski server'ı kapat:
lsof -ti:3000 | xargs kill -9

# Sonra tekrar başlat
npm run dev
```

### iPad'de Bağlanamıyor
**Kontrol Et:**
1. ✅ Mac ve iPad aynı WiFi'de mi?
2. ✅ Mac'te server çalışıyor mu?
3. ✅ IP adresi doğru mu?
4. ✅ Mac'te Firewall kapalı mı? (veya Node.js'e izin verildi mi?)

**Firewall İzni Ver:**
- Sistem Ayarları → Güvenlik → Firewall
- "Node" veya "npm"'e izin ver

---

## 📝 Notlar

### Mac Sleep Mode
- Mac uyku moduna geçerse server durur
- Enerji tasarrufu ayarlarından "Ekran kapandığında uyuma"yı kapat

### iPad Kısıtlamaları
- iPadOS'ta push notifications kısıtlı
- Offline cache 50MB ile sınırlı
- Background sync desteklenmiyor

### Performans İpuçları
- Veritabanı: SQLite (lokal dosya)
- Çok büyük restoranlarda (100+ masa) yavaşlayabilir
- Gerekirse PostgreSQL'e geç

---

## 🚀 Gelişmiş Kullanım

### Otomatik Başlatma (macOS)

**Sistem açılışında server başlasın:**

1. Automator'ı aç
2. "Application" seç
3. "Run Shell Script" ekle
4. Script:
```bash
cd "/Users/darklost_tr/Library/Mobile Documents/com~apple~CloudDocs/Software Development /billing_system"
npm run dev
```
5. Kaydet: "Adisyon Server"
6. Sistem Ayarları → Kullanıcılar → Giriş Öğeleri → "Adisyon Server" ekle

### Production Build

**Performans için:**
```bash
npm run build
npm start
```

---

**İyi Kullanımlar! 🎉**
