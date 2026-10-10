// Fictional partner companies for the home page strip (SPEC §2.2.4, §6). Invented names that
// avoid well-known brands, so no real company appears to endorse a fictional one. The names
// are proper nouns and are not translated.
export const PARTNERS = [
  { id: "altinova", name: "Altınova Tarım", mark: "sun", style: "plain" },
  { id: "lodos", name: "Lodos Yazılım", mark: "wind", style: "caps" },
  { id: "yakamoz", name: "Yakamoz Turizm", mark: "wave", style: "light" },
  { id: "tekdag", name: "Tekdağ İnşaat", mark: "peak", style: "caps" },
  { id: "ilgaz", name: "Ilgaz Medikal", mark: "cross", style: "plain" },
  { id: "serender", name: "Serender Mimarlık", mark: "arch", style: "light" },
  { id: "cinaralti", name: "Çınaraltı Danışmanlık", mark: "tree", style: "plain" },
  { id: "mavikent", name: "Mavikent Lojistik", mark: "box", style: "caps" },
] as const;

export type Partner = (typeof PARTNERS)[number];
export type PartnerMark = Partner["mark"];
