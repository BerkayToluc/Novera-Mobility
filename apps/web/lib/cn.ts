import { clsx, type ClassValue } from "clsx";

// Deliberately clsx only: tailwind-merge does not know our custom `text-small` /
// `text-fg` tokens and would drop one of them. Components avoid class conflicts instead.
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
