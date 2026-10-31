# V2-44 · E-postalar: rezervasyon, hatırlatma, talep durumu

**Faz:** 12 · Yayın · **Öncelik:** P2 · **Boyut:** M · **Bağımlı:** V2-31, V2-41 · **Karar:** SPEC §7 gönderen alan adı

## Amaç
Kullanıcıyı önemli olaylardan haberdar etmek. Bugün yalnızca şifre sıfırlama ve davet e-postası var.

## Kapsam
- **Şablonlar (TR/EN, kullanıcının dil tercihine göre):**
  - rezervasyon onayı (numara, araç, bayiler, tarih, toplam, iptal koşulu bağlantısı);
  - rezervasyon iptali (kullanıcı ya da Novera tarafından; neden metni gönderilmez);
  - seyahat hatırlatma: alıştan 24 saat önce, `notifyReminders` açıksa; saatlik görev, aynı rezervasyona bir kez;
  - talep durum değişikliği (talebi açan kişiye).
- **Gönderim kuralları:**
  - mevcut Resend altyapısı (`reset-link-notifier` deseni);
  - gönderim yanıtı beklemez ve hata fırlatmaz;
  - günlüğe e-posta adresi yazılmaz.
- **Şablon tasarımı:** sade HTML + düz metin; marka renkleri (`BRAND_COLORS`); kişisel veri en az.
- **Görev güvenliği:** hatırlatma görevi Render yeniden başlasa da tekrar göndermez (`reminderSentAt` alanı).

## Kabul kriterleri
- [ ] Kendi adrese dört e-posta türü de geldi (ekran görüntüleri, kişisel veri karartılmış). _**Yapılamadı:** bu ortamda Resend hesabı ve anahtarı yok, gerçek bir e-posta gönderilemedi. Yerine: dört türün içeriği (konu, gövde, dil, kaçışlama, kişisel veri) `email-templates.spec.ts`'te, Resend'e giden isteğin biçimi (anahtar, gönderen, alıcı, iki gövde) `mail.service.spec.ts`'te, uçtan uca akışlar (rezervasyon, iptal, yönetici iptali, talep durumu, hatırlatma) sahte bir gönderici ile `notifications.integration.spec.ts`'te sınandı. Gerçek e-postayı Berkay canlıda kendi adresine alıp işaretler (docs/DEPLOY.md §3 ve §9b); ekran görüntüsü artık istenmiyor._
- [x] Tercihi kapalı kullanıcıya hatırlatma gitmez; aynı rezervasyona iki kez gitmez (test). _`notifications.integration.spec.ts`: `notifyReminders: false` ve kapatılmış hesap için e-posta yok ve işaret konmaz; aynı çalışma tekrarlanınca ve üç çalışma aynı anda başlayınca bir e-posta; sağlayıcı hata verirse işaret geri alınır ve sonraki çalışma gönderir; 24 saatten uzak, başlamış ya da iptal edilmiş rezervasyona gitmez._
- [x] E-posta servisi kapalıyken akışlar bozulmaz (test). _Aynı dosya: ayarsız (anahtar yok), sağlayıcı 503 verirken ve bağlantı koparken müşteri iptali, yönetici iptali ve talep durumu aynı cevabı verir, hiçbir şey fırlatmaz; `mail.service.spec.ts`: hiçbir durumda adres ya da anahtar günlüğe yazılmaz. Rezervasyon yapmak da gerçek `ReservationsService.create` ile sınandı._
- [x] KVKK metni e-posta bildirimlerini anlatıyor. _`messages/*/legal.json` → `LegalPrivacy`: "E-posta bildirimleri" bölümü (hangi e-postalar, hatırlatmanın kapatılması, Resend'e aktarım, içerikte neyin olmadığı), TR ve EN._

## Etiketler
`faz-12` `ozellik` `P2` `api`
