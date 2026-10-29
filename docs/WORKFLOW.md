# Çalışma süreci (WORKFLOW)

> Durum: **v2.0** · 22 Ekim 2026. G (Product/Project Manager) ile Berkay (full stack, Claude Code ile) arasındaki iş akışı.
> Kurallar repo kökündeki `CLAUDE.md`'de de özetlenir; Claude Code her oturumda onu okur.

## 1. Roller

| | G (PM) | Berkay (geliştirici) |
|---|---|---|
| Kapsam ve sıra | Karar verir (SPEC, BACKLOG, ROADMAP) | Öneri getirir, belirsizlikte sorar |
| Issue | Açar, etiketler, atar | Okur; başlamadan önce soruları issue'ya yorum olarak yazar |
| Kod | — | API, web, veritabanı, CI; hepsi |
| PR | İnceler, önizlemede dener, birleştirir | Açar, CI'ı yeşile getirir, geri bildirimi uygular |
| Canlı ortam | Vercel ayarları ve kararlar (analytics, alan adı) | Cloud Run, Neon, Resend, Blob, seed, yedek |
| Faz kapısı | Faz turunu yapar, işaretler | Tur için örnek veriyi hazırlar |

## 2. Issue açma (G)

1. Sıradaki işin dosyasını aç: `docs/issues/V2-xx-*.md`.
2. GitHub → **New issue** → şablon **Görev** → başlık dosyanın ilk satırındaki başlık (ör. `V2-02 · Geçmiş tarihli rezervasyonu engelle`), gövde dosyanın geri kalanı.
3. **Etiketler:** dosyanın sonundaki "Etiketler" satırı. Etiket seti (bir kez oluşturulur):
   - faz: `faz-0` … `faz-12`;
   - tür: `guvenlik`, `temel`, `ozellik`, `refactor`, `test`, `belge`;
   - öncelik: `P0`, `P1`, `P2`, `P3`;
   - alan: `api`, `web`, `veritabani`, `ci`.
4. **Milestone:** fazın adı (`Faz 1 · Acil güvenlik` ...).
5. **Assignee:** Berkay.
6. Açılan numarayı [BACKLOG.md](BACKLOG.md)'deki eşleme tablosuna yaz (toplu açtıysan tek bir PR'da).

Toplu açmak istersen `scripts/create-issues.ps1` betiği vardır. Varsayılan olarak yalnızca ne açacağını gösterir; GitHub token'ını yalnızca ortam değişkeni olarak verirsin, betik onu hiçbir yere yazmaz:

```powershell
.\scripts\create-issues.ps1                       # kuru çalıştırma: listeyi gösterir
$env:GITHUB_TOKEN = '<token>'; .\scripts\create-issues.ps1 -Apply; Remove-Item Env:GITHUB_TOKEN
```

**Hazır sayılma (Definition of Ready):** issue'da kabul kriterleri var, bağımlı işler `main`'de, gereken karar (SPEC §7) verilmiş.

## 3. Geliştirme (Berkay)

1. Güncel `main`'den dal aç: `feat/V2-xx-kisa-ad` (güvenlik işi `fix/`, refactor `refactor/`, belge `docs/`).
2. Claude Code'a issue dosyasını ver: *"docs/issues/V2-xx-....md işini yap; CLAUDE.md ve ilgili belge bölümlerine uy."* Claude Code önce dosyadaki "Teknik notlar"daki belgeleri okur.
3. Belirsizlik varsa kodlamadan önce issue'ya yorum yaz ve G'yi etiketle. Belgeyle çelişen bir istek geldiğinde taraf seçilmez, sorulur.
4. Kapsam dışına çıkma: işin sırasında bulunan başka bir sorun yeni bir bulgu olarak [QUALITY.md](QUALITY.md)'ye ya da yeni bir issue önerisi olarak G'ye gider; aynı PR'a eklenmez.
5. Commit'ler Conventional Commits ve İngilizce: `fix(api): reject reservations that start in the past`.
6. PR'ı aç: şablonu doldur, `Closes #<GitHub numarası>` (kısmi işte `Refs #N`).

## 4. PR ve kabul

**PR'da olması gerekenler** (şablonda kontrol listesi var):
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` çıktıları (son satırlar yeterli);
- arayüz değiştiyse 375 ve 1280 px ekran görüntüsü (panel ekranında 768 de);
- kabul kriterlerinin her biri ve nasıl doğrulandığı;
- yeni uçta `openapi.yaml` değişikliği ve SECURITY.md hız sınırı tablosu;
- kapanan QUALITY bulgusunun durumu.

**G'nin kabulü:**
1. CI yeşil mi?
2. Vercel'in PR'a eklediği **önizleme adresinde** kabul kriterlerini tek tek dene. Önizleme canlı API'ye bağlıdır: veri değiştiren denemeleri kendi test hesabınla yap.
3. Sorun varsa PR'a "Changes requested" ve maddeli yorum yaz; yoksa **Create a merge commit** ile birleştir.
4. Birleştirdikten sonra issue otomatik kapanır; kapanmadıysa elle kapat.

**Bitti sayılma (Definition of Done):** [QUALITY.md](QUALITY.md) §4.

**Veritabanı migration'ı içeren PR'lar:** birleştirmeden önce Berkay canlı veritabanının yedeğini alır. Migration sunucu açılırken çalışmaz; Berkay yeni sürüm yayına girmeden önce bilgisayarından `prisma migrate deploy` ile uygular ([DEPLOY.md](DEPLOY.md) "Migration"). Geri alınamayan migration varsa PR'da yazar.

## 5. Kapsam değişikliği

- Yeni fikir ya da istek önce G'ye gelir. G kabul ederse:
  1. SPEC'e (ve gerekiyorsa ADR'ye) bir PR girer;
  2. BACKLOG'a yeni satır eklenir;
  3. `docs/issues/` altına issue metni yazılır.
- Sıra değişikliği yalnızca G'nin kararıyla olur ve BACKLOG'da satır taşınır.
- Fazın ortasında gelen acil güvenlik bulgusu `P0` olarak sıranın en önüne girer.

## 6. Raporlama

- Berkay her PR'da ve haftada bir issue yorumunda üç liste verir: **yapıldı / yapılmadı / doğrulanmadı**. Doğrulanmayan iş "bitti" diye sunulmaz.
- G faz sonunda ROADMAP §1'i ("Neredeyiz") günceller.

## 7. Claude Code ile çalışma notları (Berkay)

- Her oturum `CLAUDE.md`'yi okur. Issue dosyası ve ilgili belge bölümü oturumun ilk mesajında verilir.
- Bu makinede build için `SWC_NATIVE_BINDING_CACHE` kullanıcı ortam değişkeni gerekiyorsa ayarlı olmalı (v1 notu, archive/v1/STATUS.md §0).
- Arayüz işinde Claude Code'un tarayıcıda 375/768/1280 kontrolü yapması ve ekran görüntüsü alması istenir; tasarım kararlarında `impeccable` becerisi kullanılır, büyük görsel karar G'ye sorulur.
- Güvenlik işlerinde PR öncesi Claude Code'un `/security-review` komutu çalıştırılır; bulgular PR'da listelenir.
- Gizli değerler (veritabanı adresi, anahtarlar) sohbete, commit'e ya da ekran görüntüsüne girmez. Yeni değişken `.env.example`'a boş değerle eklenir.
