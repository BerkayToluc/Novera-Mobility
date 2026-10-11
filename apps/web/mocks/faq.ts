import type { Audience } from "@/lib/audience";
import type { FaqItem } from "@/lib/faq";

const FAQ: FaqItem[] = [
  {
    id: "i1",
    audience: "bireysel",
    topic: "teslim",
    question: { tr: "Aracı farklı bir bayide teslim edebilir miyim?", en: "Can I return the car at a different branch?" },
    answer: {
      tr: "Evet. Rezervasyonda bırakacağınız bayiyi ayrıca seçersiniz; farklı bayiye bırakmak için ek ücret alınmaz.",
      en: "Yes. You choose the drop-off branch separately when booking, and there is no extra charge for returning at a different branch.",
    },
  },
  {
    id: "i2",
    audience: "bireysel",
    topic: "teslim",
    question: { tr: "Kiralamak için hangi belgeler gerekli?", en: "What documents do I need to rent?" },
    answer: {
      tr: "Geçerli bir ehliyet ve kimlik belgesi yeterlidir. Teslim sırasında aracın durumunu birlikte kontrol ederiz.",
      en: "A valid driving licence and ID are enough. We check the car's condition together at pick-up.",
    },
  },
  {
    id: "i3",
    audience: "bireysel",
    topic: "rezervasyon",
    question: { tr: "Rezervasyonu iptal edebilir miyim?", en: "Can I cancel a booking?" },
    answer: {
      tr: "Alış zamanından 24 saat öncesine kadar ücretsiz iptal edebilirsiniz. Koşullar Kiralama Koşulları sayfasındadır.",
      en: "You can cancel free of charge up to 24 hours before pick-up. The conditions are on the Rental Terms page.",
    },
  },
  {
    id: "i4",
    audience: "bireysel",
    topic: "hasar",
    question: { tr: "Yolda arıza olursa ne olur?", en: "What happens if the car breaks down?" },
    answer: {
      tr: "Yol Boyu Güvence kapsamında 7/24 destek hattımız sizi arar, en yakın çekici yönlendirilir ve gerekirse yedek araç gönderilir.",
      en: "Under Road Assurance our 24/7 desk calls you, the nearest tow is dispatched and, if needed, a replacement car is sent.",
    },
  },
  {
    id: "i5",
    audience: "bireysel",
    topic: "rezervasyon",
    question: { tr: "Hangi şehirlerde bayiniz var?", en: "Which cities have a Novera branch?" },
    answer: {
      tr: "14 şehirde 15 bayimiz var; çoğu havalimanlarında. Adres ve çalışma saatleri İletişim sayfasında şehre göre süzülebilir.",
      en: "We have 15 branches in 14 cities, most of them at airports. Addresses and opening hours can be filtered by city on the Contact page.",
    },
  },
  {
    id: "i6",
    audience: "bireysel",
    topic: "odeme",
    question: { tr: "Gösterilen fiyatlara KDV dahil mi?", en: "Do the prices shown include VAT?" },
    answer: {
      tr: "Evet, fiyatlara KDV dahildir. Rezervasyon özetinde tüm kalemleri tek tek görürsünüz.",
      en: "Yes, prices include VAT. The booking summary lists every item separately.",
    },
  },
  {
    id: "i7",
    audience: "bireysel",
    topic: "odeme",
    question: { tr: "Rezervasyonumu yaparken fiyat değişir mi?", en: "Can the price change while I book?" },
    answer: {
      tr: "Seçtiğiniz tarih, bayi ve ekstralara göre hesaplanan toplam, ödemeden önce rezervasyon özetinde açıkça gösterilir.",
      en: "The total, worked out from your dates, branch and extras, is shown clearly in the booking summary before you pay.",
    },
  },
  {
    id: "i8",
    audience: "bireysel",
    topic: "hasar",
    question: { tr: "Çizik ya da hasarı nasıl kayda geçirebilirim?", en: "How do I record a scratch or damage?" },
    answer: {
      tr: "Novera Driver App ile aracı teslim alırken çizik ve hasarı fotoğraflayıp dijital tutanak tutabilirsiniz.",
      en: "With the Novera Driver App you can photograph any scratch or damage when you take the car and keep a digital record.",
    },
  },
  {
    id: "i9",
    audience: "bireysel",
    topic: "hesap",
    question: { tr: "Rezervasyonlarımı nerede görürüm?", en: "Where can I see my bookings?" },
    answer: {
      tr: "Giriş yaptıktan sonra profilinizdeki Rezervasyonlarım sayfasında geçmiş ve yaklaşan rezervasyonlarınızı görürsünüz.",
      en: "Once signed in, the My Bookings page in your profile shows your past and upcoming bookings.",
    },
  },
  {
    id: "i10",
    audience: "bireysel",
    topic: "hesap",
    question: { tr: "Puanlar nasıl kazanılır?", en: "How are points earned?" },
    answer: {
      tr: "Her 100 ₺ harcamanız için 1 puan kazanırsınız.",
      en: "You earn 1 point for every ₺100 you spend.",
    },
  },
  {
    id: "k1",
    audience: "kurumsal",
    topic: "kurumsal",
    question: { tr: "En az kaç araç için teklif alabilirim?", en: "What is the minimum fleet size for a quote?" },
    answer: {
      tr: "Tek araçtan başlayarak teklif hazırlıyoruz; filo büyüdükçe birim fiyat düşer.",
      en: "We quote from a single vehicle; the unit price falls as the fleet grows.",
    },
  },
  {
    id: "k2",
    audience: "kurumsal",
    topic: "kurumsal",
    question: { tr: "Sözleşme süresi ne kadar olabilir?", en: "How long can a contract run?" },
    answer: {
      tr: "Esnek filo için aylık, uzun dönem kiralama için 12 ile 48 ay arasında sözleşme yapılır.",
      en: "Flexible fleets run month to month; long-term leases run 12 to 48 months.",
    },
  },
  {
    id: "k3",
    audience: "kurumsal",
    topic: "kurumsal",
    question: { tr: "Bakım ve sigorta fiyata dahil mi?", en: "Are maintenance and insurance included?" },
    answer: {
      tr: "Evet. Periyodik bakım, lastik, sigorta ve Yol Boyu Güvence teklifte tek kalemde yer alır.",
      en: "Yes. Servicing, tyres, insurance and Road Assurance appear as a single line in the quote.",
    },
  },
  {
    id: "k4",
    audience: "kurumsal",
    topic: "kurumsal",
    question: { tr: "Teklife ne kadar sürede dönüş yapılır?", en: "How soon will I hear back?" },
    answer: {
      tr: "Talebiniz bir iş günü içinde bir filo uzmanına ulaşır ve size e-posta ile dönülür.",
      en: "Your request reaches a fleet specialist within one business day and we reply by email.",
    },
  },
];

export function mockFaq(audience: Audience): FaqItem[] {
  return FAQ.filter((item) => item.audience === audience);
}
