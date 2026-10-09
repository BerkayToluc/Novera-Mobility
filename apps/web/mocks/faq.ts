import type { Audience } from "@/lib/audience";
import type { FaqItem } from "@/lib/faq";

const FAQ: FaqItem[] = [
  {
    id: "i1",
    audience: "bireysel",
    question: { tr: "Aracı farklı bir bayide teslim edebilir miyim?", en: "Can I return the car at a different branch?" },
    answer: {
      tr: "Evet. Rezervasyonda bırakacağınız bayiyi ayrıca seçersiniz; bayiler arası teslim için ek bir ücret rezervasyon özetinde açıkça yazılır.",
      en: "Yes. You choose the drop-off branch separately when booking; any one-way fee is shown plainly in the booking summary.",
    },
  },
  {
    id: "i2",
    audience: "bireysel",
    question: { tr: "Kiralamak için hangi belgeler gerekli?", en: "What documents do I need to rent?" },
    answer: {
      tr: "Geçerli bir ehliyet ve kimlik belgesi yeterlidir. Teslim sırasında aracın durumunu birlikte kontrol ederiz.",
      en: "A valid driving licence and ID are enough. We check the car's condition together at pick-up.",
    },
  },
  {
    id: "i3",
    audience: "bireysel",
    question: { tr: "Rezervasyonu iptal edebilir miyim?", en: "Can I cancel a booking?" },
    answer: {
      tr: "Alış zamanından 24 saat öncesine kadar ücretsiz iptal edebilirsiniz. Koşullar Kiralama Koşulları sayfasındadır.",
      en: "You can cancel free of charge up to 24 hours before pick-up. The conditions are on the Rental Terms page.",
    },
  },
  {
    id: "i4",
    audience: "bireysel",
    question: { tr: "Yolda arıza olursa ne olur?", en: "What happens if the car breaks down?" },
    answer: {
      tr: "Yol Boyu Güvence kapsamında 7/24 destek hattımız sizi arar, en yakın çekici yönlendirilir ve gerekirse yedek araç gönderilir.",
      en: "Under Road Assurance our 24/7 desk calls you, the nearest tow is dispatched and, if needed, a replacement car is sent.",
    },
  },
  {
    id: "k1",
    audience: "kurumsal",
    question: { tr: "En az kaç araç için teklif alabilirim?", en: "What is the minimum fleet size for a quote?" },
    answer: {
      tr: "Tek araçtan başlayarak teklif hazırlıyoruz; filo büyüdükçe birim fiyat düşer.",
      en: "We quote from a single vehicle; the unit price falls as the fleet grows.",
    },
  },
  {
    id: "k2",
    audience: "kurumsal",
    question: { tr: "Sözleşme süresi ne kadar olabilir?", en: "How long can a contract run?" },
    answer: {
      tr: "Esnek filo için aylık, uzun dönem kiralama için 12 ile 48 ay arasında sözleşme yapılır.",
      en: "Flexible fleets run month to month; long-term leases run 12 to 48 months.",
    },
  },
  {
    id: "k3",
    audience: "kurumsal",
    question: { tr: "Bakım ve sigorta fiyata dahil mi?", en: "Are maintenance and insurance included?" },
    answer: {
      tr: "Evet. Periyodik bakım, lastik, sigorta ve Yol Boyu Güvence teklifte tek kalemde yer alır.",
      en: "Yes. Servicing, tyres, insurance and Road Assurance appear as a single line in the quote.",
    },
  },
  {
    id: "k4",
    audience: "kurumsal",
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
