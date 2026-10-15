import { createHash, randomBytes } from 'node:crypto';

export const SESSION_COOKIE = 'novera_session';
export const SESSION_DAYS = 30;

// Çereze rastgele bir anahtar konur; veritabanında yalnızca özeti (SHA-256) saklanır.
// Veritabanı sızsa bile içindeki kayıtlarla oturum açılamaz.
export function newSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// `Cookie` başlığından tek bir çerezi okur (cookie-parser paketine gerek yok).
export function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    if (part.slice(0, index).trim() === name) {
      const value = part.slice(index + 1).trim();
      try {
        return decodeURIComponent(value) || null;
      } catch {
        return null;
      }
    }
  }
  return null;
}
