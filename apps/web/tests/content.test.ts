import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FAQ_ITEMS, FAQ_TOPICS } from "@/lib/faq";
import { GUIDES, isGuideSlug } from "@/lib/guides";
import { isProductSlug, PRODUCTS } from "@/lib/products";
import { PUBLIC_PAGES } from "@/lib/public-pages";

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

describe("FAQ", () => {
  const messages = (lang: string) => load(lang, "faq.json").Faq.items as Record<string, { question: string; answer: string }>;

  it("has unique ids and a known topic", () => {
    expect(new Set(FAQ_ITEMS.map((item) => item.id)).size).toBe(FAQ_ITEMS.length);
    for (const item of FAQ_ITEMS) expect(FAQ_TOPICS).toContain(item.topic);
  });

  it("has a question and an answer in both languages for every item, and no text without an item", () => {
    const ids = FAQ_ITEMS.map((item) => item.id).sort();
    for (const lang of ["tr", "en"]) {
      const texts = messages(lang);
      expect(Object.keys(texts).sort(), lang).toEqual(ids);
      for (const id of ids) expect(texts[id]?.question && texts[id]?.answer, `${lang} ${id}`).toBeTruthy();
    }
  });

  it("covers every help topic", () => {
    const used = new Set(FAQ_ITEMS.map((item) => item.topic));
    for (const topic of FAQ_TOPICS) expect(used, topic).toContain(topic);
  });

  it("gives each audience its own questions", () => {
    expect(FAQ_ITEMS.filter((item) => item.audience === "bireysel").length).toBeGreaterThan(0);
    expect(FAQ_ITEMS.filter((item) => item.audience === "kurumsal").length).toBeGreaterThan(0);
  });
});
