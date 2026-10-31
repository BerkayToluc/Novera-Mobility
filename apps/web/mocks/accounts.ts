import type { Session } from "@/lib/session";

// Sample accounts for USE_MOCKS=1 (BACKLOG Y38). The fixture is the whole "database": whoever
// signs in on the individual tab becomes the first, on the corporate tab the second.
export const MOCK_INDIVIDUAL: Session = {
  type: "individual",
  role: "customer",
  user: { id: "u-individual", firstName: "Elif", lastName: "Yıldız", email: "elif.yildiz@example.com" },
  hasPassword: true,
  googleLinked: false,
};

// The account a sample Google sign-up creates: opened with Google, so it has no password yet.
export const MOCK_GOOGLE: Session = {
  type: "individual",
  role: "customer",
  user: { id: "u-google", firstName: "Ece", lastName: "Aydın", email: "ece.aydin@example.com" },
  hasPassword: false,
  googleLinked: true,
};

export const MOCK_CORPORATE: Session = {
  type: "corporate",
  role: "customer",
  user: { id: "u-corporate", firstName: "Mert", lastName: "Kaya", email: "filo@egelojistik.example" },
  company: {
    id: "5d0c1c0e-6f3a-4a52-9c1e-0a1b2c3d4e01",
    name: "Ege Lojistik A.Ş.",
    taxOffice: "Bornova",
    city: "İzmir",
    phone: "+90 232 555 01 00",
    contactTitle: { tr: "Filo Yöneticisi", en: "Fleet Manager" },
    salesContact: "satis@novera.example",
  },
  hasPassword: true,
  googleLinked: false,
  // Its company has an active fleet contract (mocks/admin-contracts.ts), so Filom is open to it (V2-36).
  hasFleet: true,
};

// A corporate account whose company has no fleet contract yet: Filom shows its empty state and the call for a quote.
export const MOCK_CORPORATE_NOFLEET: Session = {
  type: "corporate",
  role: "customer",
  user: { id: "u-corporate-nofleet", firstName: "Aylin", lastName: "Sönmez", email: "aylin@anadoluinsaat.example" },
  company: { name: "Anadolu İnşaat A.Ş.", taxOffice: "Çankaya", city: "Ankara", phone: "+90 312 555 03 00" },
  hasPassword: true,
  googleLinked: false,
  hasFleet: false,
};

// An administrator (V2-23): signs in with the cookie only (`novera-mock-session=admin`), as the sign-in form has no tab for it.
export const MOCK_ADMIN: Session = {
  type: "individual",
  role: "admin",
  user: { id: "u-admin", firstName: "Deniz", lastName: "Yönetici", email: "yonetici@novera.example" },
  hasPassword: true,
  googleLinked: false,
};
