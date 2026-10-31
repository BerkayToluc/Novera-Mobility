// The fictitious charging stations of the Green Fleet screen (V2-40, docs/FLEET.md §3.1, ADR-30): about thirty, in the cities fleets are
// delivered to. Names and places are made up; where a station is, and which sockets it has, is fixed here. Whether one is free is not stored:
// it is worked out from the station and the five minutes (src/fleet/simulation/stations.ts). Like the rest of the seed it only ADDS what is
// missing and never overwrites what is there (QUALITY §3.3): run again on a live database it makes no copy.
import type { PrismaClient } from "../src/generated/prisma/client.js";
import { CITY_CENTERS } from "../src/fleet/simulation/stations.js";

type Db = Pick<PrismaClient, "chargingStation">;
type Socket = "CCS" | "CHAdeMO" | "TYPE2";

// [name, north-south offset in degrees, east-west offset in degrees, sockets]: a few kilometres around the centre of the city.
const STATIONS: Record<string, Array<[string, number, number, Socket[]]>> = {
  İzmir: [
    ["Zeytin Şarj Alsancak", 0.012, -0.018, ["CCS", "TYPE2"]],
    ["Zeytin Şarj Bornova", 0.045, 0.05, ["CCS", "CHAdeMO", "TYPE2"]],
    ["Ege Hızlı Şarj Karşıyaka", 0.07, -0.03, ["CCS"]],
    ["Ege Hızlı Şarj Balçova", -0.02, -0.08, ["CCS", "TYPE2"]],
    ["Kordon Şarj Noktası", 0.0, -0.025, ["TYPE2"]],
  ],
  Ankara: [
    ["Başkent Şarj Kızılay", 0.003, 0.005, ["CCS", "TYPE2"]],
    ["Başkent Şarj Çankaya", -0.04, 0.01, ["CCS", "CHAdeMO"]],
    ["Anıt Hızlı Şarj Ulus", 0.03, -0.01, ["CCS"]],
    ["Anıt Hızlı Şarj Batıkent", 0.1, -0.15, ["CCS", "TYPE2"]],
    ["Gölbaşı Şarj Durağı", -0.17, 0.05, ["TYPE2"]],
  ],
  İstanbul: [
    ["Boğaz Şarj Beşiktaş", 0.03, 0.035, ["CCS", "TYPE2"]],
    ["Boğaz Şarj Kadıköy", -0.015, 0.04, ["CCS", "CHAdeMO", "TYPE2"]],
    ["Haliç Hızlı Şarj Şişli", 0.05, 0.0, ["CCS"]],
    ["Haliç Hızlı Şarj Ataşehir", 0.0, 0.14, ["CCS", "TYPE2"]],
    ["Marmara Şarj Bakırköy", -0.04, -0.08, ["TYPE2"]],
  ],
  Bursa: [
    ["Yeşil Şarj Osmangazi", 0.005, 0.01, ["CCS", "TYPE2"]],
    ["Yeşil Şarj Nilüfer", 0.03, -0.04, ["CCS", "CHAdeMO"]],
    ["Uludağ Yolu Şarj", -0.02, 0.06, ["TYPE2"]],
  ],
  Antalya: [
    ["Akdeniz Şarj Konyaaltı", -0.01, -0.06, ["CCS", "TYPE2"]],
    ["Akdeniz Şarj Lara", 0.0, 0.07, ["CCS", "CHAdeMO", "TYPE2"]],
    ["Kaleiçi Şarj Noktası", 0.005, 0.01, ["TYPE2"]],
  ],
  Eskişehir: [
    ["Porsuk Şarj Odunpazarı", 0.0, 0.01, ["CCS", "TYPE2"]],
    ["Porsuk Şarj Tepebaşı", 0.02, -0.03, ["CCS"]],
  ],
  Adana: [
    ["Çukurova Şarj Seyhan", 0.01, -0.01, ["CCS", "TYPE2"]],
    ["Çukurova Şarj Yüreğir", -0.02, 0.04, ["CCS", "CHAdeMO"]],
  ],
  Konya: [
    ["Mevlana Şarj Selçuklu", 0.02, -0.02, ["CCS", "TYPE2"]],
    ["Mevlana Şarj Meram", -0.015, -0.04, ["TYPE2"]],
  ],
  Gaziantep: [["Antep Şarj Şahinbey", 0.0, -0.02, ["CCS", "TYPE2"]]],
  Kayseri: [["Erciyes Şarj Melikgazi", 0.01, 0.0, ["CCS", "CHAdeMO", "TYPE2"]]],
  Mersin: [["Limanlı Şarj Yenişehir", 0.0, -0.01, ["CCS", "TYPE2"]]],
};

export type StationSeedResult = { stations: number };

export async function seedStations(db: Db): Promise<StationSeedResult> {
  const result: StationSeedResult = { stations: 0 };
  for (const [city, list] of Object.entries(STATIONS)) {
    const center = CITY_CENTERS[city];
    if (!center) throw new Error(`Şehir merkezi yok: ${city}`);
    for (const [name, north, east, sockets] of list) {
      const found = await db.chargingStation.findUnique({ where: { city_name: { city, name } } });
      if (found) continue;
      await db.chargingStation.create({ data: { city, name, latitude: Math.round((center.latitude + north) * 1e5) / 1e5, longitude: Math.round((center.longitude + east) * 1e5) / 1e5, sockets } });
      result.stations += 1;
    }
  }
  return result;
}

export const STATION_COUNT = Object.values(STATIONS).reduce((sum, list) => sum + list.length, 0);
