// Fictional but internally consistent figures (SPEC §4.1): 15 car models, 18% of the fleet
// electric or hybrid, branches in 14 cities, 4,200 corporate clients, founded in 2012.
// Numbers live here, not in the message files, so each language formats them its own
// way ("4.200" vs "4,200"); the labels that go with them live in the messages.
export const FOUNDED_YEAR = 2012;

export const STATS = [
  { key: "years" },
  { key: "cities", value: 14 },
  { key: "fleet", value: 15 },
  { key: "clients", value: 4200 },
] as const;

// Every sustainability claim is a measurable figure (SPEC §4).
export const CLAIMS = [
  { key: "ev", value: 0.18, percent: true },
  { key: "co2", value: 1250 },
  { key: "tyres", value: 9600 },
  { key: "paperless", value: 0.94, percent: true },
] as const;

// Chronological: the order of this list is the order on the page.
export const TIMELINE = [
  { key: "founded", year: FOUNDED_YEAR },
  { key: "corporate", year: 2015 },
  { key: "assurance", year: 2018 },
  { key: "digital", year: 2021 },
  { key: "electric", year: 2023 },
  { key: "expansion", year: 2025 },
] as const;
