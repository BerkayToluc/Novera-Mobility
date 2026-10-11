import type { Session } from "@/lib/session";

// Sample accounts for USE_MOCKS=1 (BACKLOG Y38). The fixture is the whole "database": whoever
// signs in on the individual tab becomes the first, on the corporate tab the second.
export const MOCK_INDIVIDUAL: Session = {
  type: "individual",
  user: { id: "u-individual", firstName: "Elif", lastName: "Yıldız", email: "elif.yildiz@example.com" },
};

export const MOCK_CORPORATE: Session = {
  type: "corporate",
  user: { id: "u-corporate", firstName: "Mert", lastName: "Kaya", email: "filo@egelojistik.example" },
  company: {
    name: "Ege Lojistik A.Ş.",
    taxOffice: "Bornova",
    city: "İzmir",
    phone: "+90 232 555 01 00",
    contactTitle: { tr: "Filo Yöneticisi", en: "Fleet Manager" },
    salesContact: "satis@novera.example",
  },
};
