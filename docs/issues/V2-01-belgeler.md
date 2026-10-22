# V2-01 · v2 belge seti, issue metinleri ve süreç şablonları

**Faz:** 0 · Süreç · **Öncelik:** P0 · **Boyut:** S · **Bağımlı:** —

## Amaç
Roller değişti: G artık PM, Berkay full stack. Bu iş iki şey yapar:
- v2'nin kapsamını, sırasını ve sürecini tek bir belge setinde toplar;
- Berkay'ın Claude Code ile doğrudan çalışabileceği hazır issue metinlerini sağlar.

## Kapsam
- `docs/` altında v2 belgeleri: README, SPEC, DESIGN, ARCHITECTURE, QUALITY, ADMIN, FLEET, BACKLOG, ROADMAP, WORKFLOW.
- `docs/issues/V2-01…V2-46` issue metinleri.
- v1 belgelerinin `docs/archive/v1/` altına taşınması.
- `CLAUDE.md`'nin yeni rollere göre güncellenmesi; `.github/ISSUE_TEMPLATE/gorev.md` ve PR şablonu.
- `scripts/create-issues.ps1` (isteğe bağlı, toplu issue açma).

## Kapsam dışı
Kod değişikliği.

## Kabul kriterleri
- [ ] G belgeleri okudu ve PR'ı birleştirdi.
- [ ] GitHub'da etiketler ve milestone'lar oluşturuldu (WORKFLOW.md §2).
- [ ] V2-02…V2-46 issue'ları açıldı; BACKLOG.md'deki eşleme tablosu dolduruldu.
- [ ] Repo ayarlarında secret scanning ve push protection açık.

## Etiketler
`faz-0` `belge` `P0`
