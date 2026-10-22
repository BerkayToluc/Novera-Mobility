# V2-22 · Son güvenlik turu ve SECURITY.md v2 (Faz 2 kapısı)

**Faz:** 2 · Temel · **Öncelik:** P0 · **Boyut:** M · **Bağımlı:** V2-02 – V2-21

## Amaç
Faz 2'yi kapatmadan önce sağlamlaştırılmış kod tabanını baştan uca bir kez daha güvenlik açısından gözden geçirmek. Panel bu temelin üstüne kurulacak.

## Kapsam
- **OWASP ASVS L1 listesi:** QUALITY.md §3.1 madde madde işaretlenir. Her madde için kanıt yazılır (dosya, test ya da "uygulanmaz" gerekçesi).
- **Otomatik incelemeler:**
  - Claude Code `/security-review`, `main` ile son v1 etiketi arasındaki fark üzerinde;
  - `security-audit` becerisi ile tam tur. Bulgular QUALITY'ye yeni G-xx satırı olarak girer.
- **Elle deneme (yerel ya da önizleme):**
  - anahtarsız API isteği;
  - başkasının rezervasyonu (IDOR);
  - geçmiş tarih;
  - tavan;
  - kod tahmini;
  - büyük gövde;
  - JSON dışı içerik;
  - `429`.
- **SECURITY.md v2:**
  - S1–S11 ve Google bölümü korunur;
  - V2'de düzeltilenler tablosu;
  - hız sınırı tablosu (V2-09);
  - veri saklama (V2-12);
  - kalan "Karar bekleyenler".
- **Kapı:** QUALITY'de Kritik ve Yüksek seviyede açık bulgu kalmaz. Orta seviyedekiler ya kapalıdır ya gerekçeyle "kabul edildi" olarak işaretlidir.

## Kabul kriterleri
- [ ] ASVS listesi işaretli ve kanıtlı.
- [ ] `/security-review` ve tam tur çıktılarının özeti PR'da; yeni bulgular işlendi.
- [ ] Elle deneme tablosu PR'da.
- [ ] SECURITY.md v2 birleşti.
- [ ] G Faz 2 kapısını işaretledi (ROADMAP §3), `main`'e `v2.0.0-faz2` etiketi atıldı.

## Etiketler
`faz-2` `guvenlik` `P0` `api` `web`
