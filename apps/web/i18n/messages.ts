// UI text lives in one JSON file per feature, per language (messages/tr/<feature>.json and
// messages/en/<feature>.json), each holding one or more top-level namespaces.
//
// Why not one file per language: every feature added keys at the same place, so each
// merge of two branches conflicted. With one file per feature a new feature only adds
// its own files plus one line for each language below.
//
// Adding a feature: create its Turkish and English file, then add an import and a spread
// for each. If two branches both add a line here, keep both: the order does not matter.
import trAbout from "../messages/tr/about.json";
import trAuth from "../messages/tr/auth.json";
import trLegal from "../messages/tr/legal.json";
import trProducts from "../messages/tr/products.json";
import trProfile from "../messages/tr/profile.json";
import trServices from "../messages/tr/services.json";
import trSite from "../messages/tr/site.json";
import trUi from "../messages/tr/ui.json";

import enAbout from "../messages/en/about.json";
import enAuth from "../messages/en/auth.json";
import enLegal from "../messages/en/legal.json";
import enProducts from "../messages/en/products.json";
import enProfile from "../messages/en/profile.json";
import enServices from "../messages/en/services.json";
import enSite from "../messages/en/site.json";
import enUi from "../messages/en/ui.json";

// Turkish is the reference: a key used in code but missing here fails the typecheck
// instead of rendering the raw key on the page.
export const tr = {
  ...trAbout,
  ...trAuth,
  ...trLegal,
  ...trProducts,
  ...trProfile,
  ...trServices,
  ...trSite,
  ...trUi,
};

// Typed as Turkish's shape, so a key missing in English is a compile error too.
export const en: typeof tr = {
  ...enAbout,
  ...enAuth,
  ...enLegal,
  ...enProducts,
  ...enProfile,
  ...enServices,
  ...enSite,
  ...enUi,
};

export const messages = { tr, en } as const;
