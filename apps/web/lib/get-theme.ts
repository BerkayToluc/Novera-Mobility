import "server-only";
import { cookies } from "next/headers";
import { parseTheme, THEME_COOKIE, type Theme } from "./theme";

export async function getTheme(): Promise<Theme | undefined> {
  return parseTheme((await cookies()).get(THEME_COOKIE)?.value);
}
