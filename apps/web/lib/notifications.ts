// Which e-mails the account wants (SPEC §2.9, v0.8): reminders before a trip and campaigns. Kept in
// a cookie while the account has no API (USE_MOCKS=1), like the other saved choices.
export type Notifications = { reminders: boolean; campaigns: boolean };

export const NOTIFY_COOKIE = "novera-notify";
// Set when "close the other sessions" was pressed; the sample session list then shows only this one.
export const SESSIONS_REVOKED_COOKIE = "novera-sessions-revoked";

// Reminders on and campaigns off until the person chooses: a marketing mail needs a yes.
export const DEFAULT_NOTIFICATIONS: Notifications = { reminders: true, campaigns: false };

export function parseNotifications(value: string | undefined): Notifications | null {
  if (!value) return null;
  try {
    const raw = JSON.parse(value) as Partial<Notifications>;
    if (typeof raw.reminders !== "boolean" || typeof raw.campaigns !== "boolean") return null;
    return { reminders: raw.reminders, campaigns: raw.campaigns };
  } catch {
    return null;
  }
}
