import type { DayHours, OpeningHours } from "./branch-detail";

// Whether a branch is open, and when that changes (SPEC §2.2.2). Everything is read in Turkey's
// time, wherever the visitor is: the branch is there, not where the browser is. `now` is a
// parameter so the result is the same on every machine and testable.
export type OpeningStatus =
  // Every day of the week, all day.
  | { state: "always" }
  | { state: "open"; until: string }
  // `daysAhead` 0 is later today, 1 tomorrow; `weekday` is 0 (Sunday) to 6, for further days.
  | { state: "closed"; opensAt: string; daysAhead: number; weekday: number }
  // A branch with no opening hours at all.
  | { state: "closed-for-good" };

const TIME_ZONE = "Europe/Istanbul";
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function istanbulClock(now: Date): { weekday: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return { weekday: WEEKDAYS.indexOf(get("weekday")), minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

// "24:00" is the end of the day, so a branch that never closes is 00:00 to 24:00.
const isAllDay = (day: DayHours) => day !== null && toMinutes(day.open) === 0 && toMinutes(day.close) === 1440;

const hoursOn = (hours: OpeningHours, weekday: number): DayHours =>
  weekday === 0 ? hours.sunday : weekday === 6 ? hours.saturday : hours.weekdays;

export function openingStatus(hours: OpeningHours, now: Date): OpeningStatus {
  if (isAllDay(hours.weekdays) && isAllDay(hours.saturday) && isAllDay(hours.sunday)) return { state: "always" };

  const { weekday, minutes } = istanbulClock(now);
  const today = hoursOn(hours, weekday);
  if (today) {
    const open = toMinutes(today.open);
    const close = toMinutes(today.close);
    if (minutes >= open && minutes < close) return { state: "open", until: today.close };
    if (minutes < open) return { state: "closed", opensAt: today.open, daysAhead: 0, weekday };
  }
  for (let ahead = 1; ahead <= 7; ahead++) {
    const day = (weekday + ahead) % 7;
    const next = hoursOn(hours, day);
    if (next) return { state: "closed", opensAt: next.open, daysAhead: ahead, weekday: day };
  }
  return { state: "closed-for-good" };
}
