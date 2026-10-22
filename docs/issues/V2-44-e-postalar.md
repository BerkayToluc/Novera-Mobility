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
- [ ] Kendi adrese dört e-posta türü de geldi (ekran görüntüleri, kişisel veri karartılmış).
- [ ] Tercihi kapalı kullanıcıya hatırlatma gitmez; aynı rezervasyona iki kez gitmez (test).
- [ ] E-posta servisi kapalıyken akışlar bozulmaz (test).
- [ ] KVKK metni e-posta bildirimlerini anlatıyor.

## Etiketler
`faz-12` `ozellik` `P2` `api`
