# Novera Mobility belgeleri

> v2 · 22 Ekim 2026. Hangi soru hangi belgede?

| Soru | Belge | Kim günceller |
|---|---|---|
| Ne yapıyoruz, kapsamda ne var ne yok, "bitti" nasıl kabul edilir? | [SPEC.md](SPEC.md) | G |
| Hangi sırayla, hangi faz kapısıyla? | [ROADMAP.md](ROADMAP.md) | G |
| İş listesi, öncelik, bağımlılık, GitHub eşlemesi | [BACKLOG.md](BACKLOG.md) | G |
| Tek bir işin tam metni (issue'ya kopyalanır) | [issues/](issues/) `V2-xx-*.md` | G (Berkay öneri getirir) |
| Issue → dal → PR → kabul süreci, roller | [WORKFLOW.md](WORKFLOW.md) | G |
| Bilinen sorunlar, denetim listeleri, Definition of Done | [QUALITY.md](QUALITY.md) | Berkay (her PR'da) |
| Teknik kararlar (ADR), sistem şeması, klasörler | [ARCHITECTURE.md](ARCHITECTURE.md) | Berkay, G onaylar |
| Renk, yazı, boşluk, panel ekran kuralları | [DESIGN.md](DESIGN.md) | Berkay, G onaylar |
| Yönetim paneli tasarımı | [ADMIN.md](ADMIN.md) | Berkay, G onaylar |
| Filom (kurumsal filo paneli), talepler, simülasyon | [FLEET.md](FLEET.md) | Berkay, G onaylar |
| Güvenlik kararları, hız sınırı tablosu, yayın güvenlik listesi | [SECURITY.md](SECURITY.md) | Berkay |
| Canlıya çıkış adımları (Vercel, Render, Neon, Resend) | [DEPLOY.md](DEPLOY.md) | Berkay |
| API sözleşmesi | [api/openapi.yaml](api/openapi.yaml) | Berkay (uç değişen her PR'da) |
| Fotoğraf kaynakları | [PHOTO-CREDITS.md](PHOTO-CREDITS.md) | Berkay |
| v1'in ayrıntılı sayfa tanımları, eski iş listesi, eski durum ve denetimler | [archive/v1/](archive/v1/) | Değişmez (yalnızca referans) |

**Çelişki kuralı:** SPEC ve BACKLOG kapsamda, ARCHITECTURE teknik kararda, `openapi.yaml` uç biçiminde, `globals.css` token değerinde kazanır. Çelişki fark edilince taraf seçilmez; G'ye sorulur ve belge düzeltilir.
