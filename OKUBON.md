# Adisyon POS Hızlı Başlangıç

## 🚀 Hızlı Başlat (macOS)

### Çift Tıkla Başlat
1. **`Başlat-Adisyon.command`** dosyasına çift tıkla
2. İlk seferinde "Güvenlik" uyarısı gelirse:
   - Sistem Ayarları → Güvenlik → "Yine de Aç"
3. Terminal açılacak ve server başlayacak

### Tarayıcıda Aç
```
http://localhost:3000
```

---

## 📱 iPad/iPhone Kullanımı

### Adımlar:
1. **Mac'te** server'ı başlat (`Başlat-Adisyon.command`)
2. Terminal'de gösterilen **IP adresini** not al:
   ```
   http://192.168.x.x:3000
   ```
3. **iPad/iPhone'da:**
   - Aynı WiFi'ye bağlan
   - Safari'de IP adresini aç
   - Paylaş → **"Ana Ekrana Ekle"**

---

## ⚠️ iPadOS Sınırlaması

**iPadOS'ta server çalıştıramazsınız!**

iPad sadece **istemci** olarak kullanılır:
- ✅ PWA olarak kullanabilirsiniz
- ✅ Mac/PC'den server'a bağlanır
- ❌ iPad'de server çalıştıramazsınız

---

## 🆘 Sorun mu Var?

**Server başlamıyor?**
```bash
# Terminal'de:
cd "/Users/darklost_tr/Library/Mobile Documents/com~apple~CloudDocs/Software Development /billing_system"
npm install
npm run dev
```

**iPad bağlanamıyor?**
- Aynı WiFi'de olduğunuzdan emin olun
- Mac'te Firewall'u kontrol edin

---

Detaylı kılavuz: **KURULUM-KILAVUZU.md**
