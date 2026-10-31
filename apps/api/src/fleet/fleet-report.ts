// The carbon saved by the electric and hybrid cars of a fleet (V2-40, docs/FLEET.md §3.1). An example calculation, and the screen says so:
// kilometres × (what a petrol car of the same class gives off − what this car gives off). The factors are in one place, here, in grams of
// CO₂ per kilometre so that everything stays a whole number; FLEET.md §3.1 gives them in kilograms.
export const PETROL_G_PER_KM = 170;
export const EMISSION_G_PER_KM = { HYBRID: 105, ELECTRIC: 45 } as const;
export type GreenFuel = keyof typeof EMISSION_G_PER_KM;

export const isGreenFuel = (fuel: string): fuel is GreenFuel => fuel === 'HYBRID' || fuel === 'ELECTRIC';

// Grams of CO₂ saved by driving `km` kilometres in a car of this kind instead of a petrol one. Whole grams; never negative.
export function carbonSavedGrams(fuel: GreenFuel, km: number): number {
  return Math.max(0, Math.round(km)) * (PETROL_G_PER_KM - EMISSION_G_PER_KM[fuel]);
}
