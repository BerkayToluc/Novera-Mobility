import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FAQ_TOPICS } from "@/lib/faq";
import { GUIDES, isGuideSlug } from "@/lib/guides";
import { isProductSlug, PRODUCTS } from "@/lib/products";
import { PUBLIC_PAGES } from "@/lib/public-pages";
import { mockFaq } from "@/mocks/faq";

const messagesDir = (lang: string) => fileURLToPath(new URL(`../messages/${lang}`, import.meta.url));
const load = (lang: string, file: string) => JSON.parse(readFileSync(`${messagesDir(lang)}/${file}`, "utf8"));

// "a.b.0.c" for every leaf, so two files can be compared by shape.
function paths(value: unknown, prefix = ""): string[] {
  if (Array.isArray(value)) return value.flatMap((item, index) => paths(item, `${prefix}${index}.`));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) => paths(item, `${prefix}${key}.`));
  }
  return [prefix];
}

describe("messages", () => {
  const files = readdirSync(messagesDir("tr")).filter((file) => file.endsWith(".json"));

  it("has the same files in Turkish and English", () => {
    expect(readdirSync(messagesDir("en")).sort()).toEqual(readdirSync(messagesDir("tr")).sort());
  });

  it.each(files)("%s has the same keys in both languages", (file) => {
    expect(paths(load("en", file)).sort()).toEqual(paths(load("tr", file)).sort());
  });

  it.each(files)("%s has no empty text", (file) => {
    for (const lang of ["tr", "en"]) {
      const empty = JSON.stringify(load(lang, file)).includes('""');
      expect(empty, `${lang}/${file}`).toBe(false);
    }
  });
});

describe("guides and products", () => {
  it("every guide has its text in both languages", () => {
    for (const lang of ["tr", "en"]) {
      const items = load(lang, "guides.json").GuidesPage.items;
      for (const slug of GUIDES) {
        expect(items[slug], `${lang}/${slug}`).toMatchObject({ title: expect.any(String), summary: expect.any(String) });
        expect(items[slug].sections.length).toBeGreaterThan(0);
      }
    }
  });

  it("every product has its text in both languages", () => {
    for (const lang of ["tr", "en"]) {
      const items = load(lang, "products.json").ProductsPage.items;
      for (const { slug } of PRODUCTS) expect(items[slug], `${lang}/${slug}`).toBeDefined();
    }
  });

  it("recognises only real slugs", () => {
    expect(isGuideSlug(GUIDES[0])).toBe(true);
    expect(isGuideSlug("nope")).toBe(false);
    expect(isProductSlug("yesil-filo")).toBe(true);
    expect(isProductSlug("nope")).toBe(false);
  });

  it("lists every guide and product page publicly", () => {
    const listed = PUBLIC_PAGES.filter((page) => typeof page !== "string").map((page) => (page as { params: { slug: string } }).params.slug);
    for (const slug of [...GUIDES, ...PRODUCTS.map((product) => product.slug)]) expect(listed).toContain(slug);
  });
});

describe("FAQ sample data", () => {
  const items = [...mockFaq("bireysel"), ...mockFaq("kurumsal")];

  it("has unique ids, a known topic and both languages", () => {
    expect(new Set(items.map((item) => item.id)).size).toBe(items.length);
    for (const item of items) {
      expect(FAQ_TOPICS).toContain(item.topic);
      expect(item.question.tr && item.question.en && item.answer.tr && item.answer.en).toBeTruthy();
    }
  });

  it("covers every help topic", () => {
    const used = new Set(items.map((item) => item.topic));
    // "genel" is only for the API's questions, which come without a topic.
    for (const topic of FAQ_TOPICS.filter((value) => value !== "genel")) expect(used, topic).toContain(topic);
  });

  it("keeps each audience to its own questions", () => {
    expect(mockFaq("bireysel").every((item) => item.audience === "bireysel")).toBe(true);
    expect(mockFaq("kurumsal").every((item) => item.audience === "kurumsal")).toBe(true);
  });
});
