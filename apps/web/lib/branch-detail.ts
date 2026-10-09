import type { Branch } from "./vehicle";

// Opening and closing time ("08:00"), or null for a closed day. Mirrors the shape the
// backend stores in Branch.openingHours (BACKLOG #14).
export type DayHours = { open: string; close: string } | null;

export type OpeningHours = { weekdays: DayHours; saturday: DayHours; sunday: DayHours };

// A branch as the contact page shows it: everything needed to find it and reach it.
export type BranchDetail = Branch & {
  address: string;
  latitude: number;
  longitude: number;
  phone: string;
  email: string;
  openingHours: OpeningHours;
};

// Lowercases the Turkish way and drops accents, so "izmir", "İzmir" and "IZMIR" all find
// the same branch and "sisli" finds "Şişli".
export function normalizeSearch(value: string): string {
  return value
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim();
}

export function matchesBranch(branch: BranchDetail, query: string): boolean {
  const needle = normalizeSearch(query);
  if (!needle) return true;
  return normalizeSearch(`${branch.city} ${branch.name}`).includes(needle);
}

export const directionsUrl = ({ latitude, longitude }: BranchDetail) =>
  `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
