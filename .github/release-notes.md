## İndirme

Bilgisayarınıza uygun dosyayı aşağıdaki **Assets** bölümünden indirin:

| Bilgisayar | Dosya |
|---|---|
| Windows | `DigiTab-POS-…-win-x64.exe` |
| Mac (Apple M1/M2/M3/M4) | `DigiTab-POS-…-mac-arm64.dmg` |
| Mac (Intel işlemcili, 2020 ve öncesi) | `DigiTab-POS-…-mac-x64.dmg` |

> Mac'inizin hangisi olduğunu öğrenmek için: sol üstteki Apple menüsü → **Bu Mac Hakkında**. "Çip: Apple …" yazıyorsa arm64, "İşlemci: Intel" yazıyorsa x64 dosyasını indirin.

## Kurulum

**Windows**
1. `.exe` dosyasını çift tıklayın.
2. "Windows bilgisayarınızı korudu" uyarısı çıkarsa **Ek bilgi** → **Yine de çalıştır**'a tıklayın.
3. Kurulum kendiliğinden tamamlanır ve masaüstüne **DigiTab POS** kısayolu eklenir.

**Mac**
1. `.dmg` dosyasını açın ve **DigiTab POS** simgesini **Applications** (Uygulamalar) klasörüne sürükleyin.
2. Uygulamayı Uygulamalar klasöründen açın.
3. "Apple, DigiTab POS'un kötü amaçlı yazılım içermediğini doğrulayamadı" uyarısı çıkarsa **Bitti**'ye tıklayın. Ardından **Sistem Ayarları** → **Gizlilik ve Güvenlik**'e gidin, sayfanın altındaki **Yine de Aç** düğmesine tıklayın.

Bu uyarılar uygulamanın ücretli bir geliştirici sertifikasıyla imzalanmamış olmasından kaynaklanır. Yalnızca ilk açılışta görünür.

## Yenilikler (1.1.0)

- **İstasyonlar:** Siparişler ocak, içecek, tatlı gibi istasyonlara otomatik düşer. Her istasyonun kendi ekranı vardır; masa no, adet, not ve geçen süre görünür.
- **Hazır bildirimi:** İstasyon "Hazır" deyince garson telefonu ses ve titreşimle uyarır, garson "Teslim Aldım" ile onaylar.
- **Kasa ve günlük satışlar:** Masa kapatılırken alınan tutar ve ödeme türü (nakit/kart) girilir. Satışlar sayfasında günlük tahsilat ve ürün bazlı satışlar görünür.
- **İstasyon fişi yazdırma:** 80 mm termal yazıcıdan fiş basılır. Fiş tasarımı Ayarlar > Fiş sekmesinden düzenlenir.
- **Yeni görünüm:** Daha sade renkler ve ikonlar.

## İlk kullanım

1. İlk açılışta güvenlik duvarı "gelen bağlantılara izin verilsin mi?" diye sorarsa **İzin Ver**'i seçin. Bu izin olmadan garson telefonları ve istasyon ekranları bağlanamaz.
2. **Ayarlar** sayfasında restoran adınızı ve masa sayınızı girin.
3. **Menü** sayfasında ürünlerinizi ve fiyatlarını ekleyin. Menü boş gelir.
4. İsterseniz **İstasyonlar** sayfasında istasyonları oluşturun ve menüde kategorilere atayın.
5. Fiş yazıcısı kullanacaksanız **Ayarlar > Fiş** sekmesinden yazıcıyı seçip test fişi basın.
6. Garsonlar aynı Wi-Fi ağındaki telefonlarıyla Ayarlar sayfasındaki **QR kodu** okutarak bağlanır.

Verileriniz yalnızca bu bilgisayarda saklanır. Ayarlar sayfasındaki **Şimdi Yedekle** düğmesiyle düzenli yedek almanız önerilir.
