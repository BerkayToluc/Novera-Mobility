// Made-up contact details for the sample branches (USE_MOCKS=1). The real ones come from
// the backend seed (BACKLOG #15). Phone numbers use the 555 01xx range reserved for fiction,
// and the e-mail domain does not exist.
import type { BranchDetail, DayHours, OpeningHours } from "@/lib/branch-detail";
import { MOCK_BRANCHES } from "./fleet";

const hours = (open: string, close: string): DayHours => ({ open, close });
const OFFICE: OpeningHours = { weekdays: hours("08:00", "20:00"), saturday: hours("09:00", "18:00"), sunday: null };
const AIRPORT: OpeningHours = { weekdays: hours("00:00", "24:00"), saturday: hours("00:00", "24:00"), sunday: hours("00:00", "24:00") };

type Extra = Pick<BranchDetail, "address" | "latitude" | "longitude" | "phone"> & { hours: OpeningHours };

const DETAILS: Record<string, Extra> = {
  "istanbul-kadikoy": { address: "Caferağa Mah. Moda Cad. No: 12, Kadıköy", latitude: 40.9899, longitude: 29.0258, phone: "+90 216 555 01 01", hours: OFFICE },
  "istanbul-havalimani": { address: "Tayakadın Mah. Terminal Cad. Gelen Yolcu Katı, Arnavutköy", latitude: 41.2753, longitude: 28.7519, phone: "+90 212 555 01 02", hours: AIRPORT },
  "istanbul-sabiha": { address: "Sanayi Mah. Havalimanı Cad. Dış Hatlar Gelen, Pendik", latitude: 40.8986, longitude: 29.3092, phone: "+90 216 555 01 03", hours: AIRPORT },
  "ankara-esenboga": { address: "Esenboğa Havalimanı İç Hatlar Gelen, Çubuk", latitude: 40.1281, longitude: 32.9951, phone: "+90 312 555 01 04", hours: AIRPORT },
  "ankara-kizilay": { address: "Kızılay Mah. Atatürk Bulvarı No: 88, Çankaya", latitude: 39.9208, longitude: 32.854, phone: "+90 312 555 01 05", hours: OFFICE },
  "izmir-adnan-menderes": { address: "Gaziemir Havalimanı İç Hatlar Gelen, Gaziemir", latitude: 38.2924, longitude: 27.157, phone: "+90 232 555 01 06", hours: AIRPORT },
  "izmir-alsancak": { address: "Alsancak Mah. Kıbrıs Şehitleri Cad. No: 41, Konak", latitude: 38.4361, longitude: 27.1428, phone: "+90 232 555 01 07", hours: OFFICE },
  "antalya-havalimani": { address: "Havalimanı Mah. Terminal 1 Gelen Yolcu, Muratpaşa", latitude: 36.8987, longitude: 30.8005, phone: "+90 242 555 01 08", hours: AIRPORT },
  "bursa-nilufer": { address: "Özlüce Mah. FSM Bulvarı No: 23, Nilüfer", latitude: 40.2246, longitude: 28.9127, phone: "+90 224 555 01 09", hours: OFFICE },
  "adana-sakirpasa": { address: "Şakirpaşa Havalimanı İç Hatlar Gelen, Seyhan", latitude: 36.9822, longitude: 35.2804, phone: "+90 322 555 01 10", hours: AIRPORT },
  "gaziantep-havalimani": { address: "Oğuzeli Havalimanı İç Hatlar Gelen, Oğuzeli", latitude: 36.9472, longitude: 37.4787, phone: "+90 342 555 01 11", hours: AIRPORT },
  "konya-merkez": { address: "Meram Yeni Yol Cad. No: 57, Meram", latitude: 37.8625, longitude: 32.4833, phone: "+90 332 555 01 12", hours: OFFICE },
  "eskisehir-merkez": { address: "Hoşnudiye Mah. İsmet İnönü Cad. No: 9, Tepebaşı", latitude: 39.7667, longitude: 30.5256, phone: "+90 222 555 01 13", hours: OFFICE },
  "mugla-dalaman": { address: "Dalaman Havalimanı Dış Hatlar Gelen, Dalaman", latitude: 36.7131, longitude: 28.7925, phone: "+90 252 555 01 14", hours: AIRPORT },
  "trabzon-havalimani": { address: "Havalimanı Mah. Terminal Binası Gelen Yolcu, Ortahisar", latitude: 40.9951, longitude: 39.7897, phone: "+90 462 555 01 15", hours: AIRPORT },
};

export function mockBranchDetails(): BranchDetail[] {
  return MOCK_BRANCHES.map((branch) => {
    const { hours: openingHours, ...rest } = DETAILS[branch.id];
    return { ...branch, ...rest, email: `${branch.id}@novera.example`, openingHours };
  });
}
