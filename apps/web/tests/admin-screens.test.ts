import { describe, expect, it } from "vitest";
import { tr, en } from "../i18n/messages";
import { routing } from "../i18n/routing";
import { ADMIN_SCREENS, isCurrentScreen, readyScreens } from "../lib/admin-screens";
import { pageWindow } from "../lib/admin-query";

// The menu of the panel (V2-24, docs/ADMIN.md §3): a screen is in it only when it exists.
describe("the panel screens", () => {
  it("every screen has a name in both languages", () => {
    for (const { key } of ADMIN_SCREENS) {
      expect(tr.Admin.nav[key], `tr ${key}`).toBeTruthy();
      expect(en.Admin.nav[key], `en ${key}`).toBeTruthy();
    }
  });

  it("a screen that is turned on has its address in the router (an issue that builds a screen adds both)", () => {
    for (const screen of readyScreens()) expect(Object.keys(routing.pathnames), screen.href).toContain(screen.href);
  });

  it("the screens that are built are on, the summary comes first, and the rest stay out of the menu", () => {
    // V2-26 turned on the campaign codes, V2-29 the models; each later issue adds its own key here when it turns its screen on.
    expect(readyScreens().map((screen) => screen.key)).toEqual(["summary", "promoCodes", "branches", "models", "vehicles", "extras", "reservations", "quotes", "messages", "companies"]);
    expect(ADMIN_SCREENS[0]!.key).toBe("summary");
  });

  it("the addresses are unique and all under /yonetim", () => {
    const hrefs = ADMIN_SCREENS.map((screen) => screen.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const href of hrefs) expect(href).toMatch(/^\/yonetim(\/[a-z-]+)?$/);
  });

  it("the summary is current only on its own address; the others also own what is under them", () => {
    expect(isCurrentScreen("/yonetim", "/yonetim")).toBe(true);
    expect(isCurrentScreen("/yonetim/bayiler", "/yonetim")).toBe(false);
    expect(isCurrentScreen("/yonetim/bayiler/yeni", "/yonetim/bayiler")).toBe(true);
    expect(isCurrentScreen("/yonetim/bayilerim", "/yonetim/bayiler")).toBe(false);
  });
});

describe("pageWindow", () => {
  it("shows the first, the last, the current and its neighbours, with a gap marked", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(5, 10)).toEqual([1, null, 4, 5, 6, null, 10]);
    expect(pageWindow(2, 10)).toEqual([1, 2, 3, null, 10]);
    expect(pageWindow(10, 10)).toEqual([1, null, 9, 10]);
  });
});
