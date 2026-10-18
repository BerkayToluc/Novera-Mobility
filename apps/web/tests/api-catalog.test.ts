import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changePassword, deleteMyAccount, saveNotifications } from "../lib/account-actions";
import { fetchMySessions } from "../lib/api-account";
import { parseVehicleSlug, sessionFromApi, summaryFromApi, vehicleSlug } from "../lib/api-mappers";
import type { components } from "../lib/api-types";
import { getAvailableVehicles, getBranchDetails, getExtras, getVehicle, getVehicles } from "../lib/fleet-client";
import { createHold, getHold, holdApiId, VehicleUnavailableError } from "../lib/hold-client";
import { quotePrice } from "../lib/price-client";
import { MOCK_SESSION_COOKIE } from "../lib/session";

type Schemas = components["schemas"];

const sent = new Map<string, string>();
const deleted: string[] = [];
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7" }),
  cookies: async () => ({
    get: (name: string) => (sent.has(name) ? { value: sent.get(name) } : undefined),
    set: () => undefined,
    delete: (name: string) => deleted.push(name),
  }),
}));

const respond = (status: number, body?: unknown) =>
  vi.fn(async () => new Response(body === undefined ? null : JSON.stringify(body), { status }));
const urlOf = (mock: ReturnType<typeof respond>, call = 0) => (mock.mock.calls[call] as unknown as [string, RequestInit])[0];
const initOf = (mock: ReturnType<typeof respond>, call = 0) => (mock.mock.calls[call] as unknown as [string, RequestInit])[1];

const VEHICLE_ID = "7b2f6d0e-1c3a-4a53-9d5e-0d2a8c1f4b11";
const model = {
  slug: "toyota-corolla-hybrid",
  brand: "Toyota",
  model: "Corolla Hybrid",
  class: { slug: "ekonomik", name: { tr: "Ekonomik", en: "Economy" } },
  seats: 5,
  bags: 2,
  transmission: "AUTOMATIC",
  fuelType: "HYBRID",
  consumption: { value: 4.5, unit: "L_PER_100KM" },
  description: { tr: "x", en: "x" },
  imageUrl: null,
} as unknown as Schemas["VehicleModelBase"];

const search = { pickupBranchId: "b1", returnBranchId: "b2", startAt: "2026-12-14T10:00", endAt: "2026-12-17T10:00" };

const user = {
  id: "u1",
  email: "a@b.c",
  firstName: "A",
  lastName: "B",
  accountType: "INDIVIDUAL",
  locale: "tr",
  theme: "light",
  currency: "TRY",
};

beforeEach(() => {
  sent.clear();
  deleted.length = 0;
  vi.stubEnv("API_URL", "http://api.test");
  vi.stubEnv("USE_MOCKS", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("the catalogue from the API", () => {
  it("reads the branches with their opening hours", async () => {
    const fetchMock = respond(200, [
      {
        id: "b1",
        name: "Kadıköy",
        city: "İstanbul",
        address: "Moda Cad.",
        latitude: 40.9,
        longitude: 29,
        phone: "+90 216 555 01 01",
        email: "k@novera.example",
        openingHours: { weekdays: "08:30-19:00", saturday: "09:00-17:00", sunday: "closed" },
        vehicleModels: [],
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const [branch] = await getBranchDetails();
    expect(urlOf(fetchMock)).toBe("http://api.test/branches");
    expect(branch.openingHours).toEqual({
      weekdays: { open: "08:30", close: "19:00" },
      saturday: { open: "09:00", close: "17:00" },
      sunday: null,
    });
  });

  it("lists a model once for each branch that stocks it, from its lowest price", async () => {
    const fetchMock = respond(200, [
      {
        ...model,
        fromDailyPrice: { amount: 125000, currency: "EUR" },
        branches: [
          { id: "b1", name: "A", city: "X" },
          { id: "b2", name: "B", city: "Y" },
        ],
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const vehicles = await getVehicles("EUR");
    expect(urlOf(fetchMock)).toBe("http://api.test/vehicle-models?currency=EUR");
    expect(vehicles.map((vehicle) => vehicle.branchId)).toEqual(["b1", "b2"]);
    expect(vehicles[0]).toMatchObject({ modelSlug: "toyota-corolla-hybrid", dailyPrice: { amount: 125000, currency: "EUR" } });
  });

  it("searches the free cars with the dates in UTC, and names each car by model and id", async () => {
    const fetchMock = respond(200, [
      {
        vehicleId: VEHICLE_ID,
        model,
        branch: { id: "b1", name: "A", city: "X" },
        days: 3,
        dailyPrice: { amount: 100000, currency: "TRY" },
        totalPrice: { amount: 300000, currency: "TRY" },
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const [offer] = await getAvailableVehicles(search, "TRY");
    const query = new URL(urlOf(fetchMock)).searchParams;
    expect(query.get("startAt")).toBe("2026-12-14T07:00:00Z");
    expect(query.get("endAt")).toBe("2026-12-17T07:00:00Z");
    expect(query.get("currency")).toBe("TRY");
    expect(offer).toMatchObject({ id: VEHICLE_ID, slug: `toyota-corolla-hybrid.${VEHICLE_ID}`, branchId: "b1", days: 3 });
  });

  it("treats dates the API refuses as no cars, and a service that is down as an error", async () => {
    vi.stubGlobal("fetch", respond(422, { code: "VALIDATION_FAILED", fieldErrors: { startAt: "OUT_OF_RANGE" } }));
    expect(await getAvailableVehicles(search, "TRY")).toEqual([]);
    vi.stubGlobal("fetch", respond(503));
    await expect(getAvailableVehicles(search, "TRY")).rejects.toThrow();
    await expect(getExtras("TRY")).rejects.toThrow();
  });

  it("finds the car of a booking from its model, and nothing for a slug that is not one", async () => {
    vi.stubGlobal("fetch", respond(200, [{ ...model, fromDailyPrice: { amount: 100000, currency: "TRY" }, branches: [] }]));
    const vehicle = await getVehicle(`toyota-corolla-hybrid.${VEHICLE_ID}`, "TRY", "b1");
    expect(vehicle).toMatchObject({ id: VEHICLE_ID, branchId: "b1", brand: "Toyota" });
    expect(await getVehicle("no-such-model.abc", "TRY", "b1")).toBeNull();
    expect(await getVehicle("nodot", "TRY", "b1")).toBeNull();
  });

  it("splits and joins the slug of a car", () => {
    expect(parseVehicleSlug(vehicleSlug("a-b", "id1"))).toEqual({ modelSlug: "a-b", vehicleId: "id1" });
    expect(parseVehicleSlug("nodot")).toBeNull();
  });
});

describe("holds", () => {
  const holdId = "0f4e8f4c-7b0e-4c75-8e0b-2d1c2a3b4c5d";

  it("holds the car through the API and carries the end in the address", async () => {
    const expires = "2026-12-14T07:15:00Z";
    const fetchMock = respond(201, { id: holdId, vehicleId: VEHICLE_ID, expiresAt: expires });
    vi.stubGlobal("fetch", fetchMock);
    const hold = await createHold(`toyota-corolla-hybrid.${VEHICLE_ID}`, search);
    expect(urlOf(fetchMock)).toBe("http://api.test/holds");
    expect(JSON.parse(initOf(fetchMock).body as string)).toMatchObject({
      vehicleId: VEHICLE_ID,
      startAt: "2026-12-14T07:00:00Z",
    });
    expect(hold.id).toBe(`${holdId}.${Date.parse(expires)}`);
    expect(holdApiId(hold.id)).toBe(holdId);
  });

  it("tells a car someone else got, and a service that is down", async () => {
    vi.stubGlobal("fetch", respond(409, { code: "VEHICLE_UNAVAILABLE" }));
    await expect(createHold(`m.${VEHICLE_ID}`, search)).rejects.toBeInstanceOf(VehicleUnavailableError);
    vi.stubGlobal("fetch", respond(503));
    await expect(createHold(`m.${VEHICLE_ID}`, search)).rejects.not.toBeInstanceOf(VehicleUnavailableError);
  });

  it("reads a live hold from the address, and treats an expired or malformed one as over", async () => {
    const live = `${holdId}.${Date.now() + 60_000}`;
    expect(await getHold(live, "any")).toMatchObject({ id: live });
    expect(await getHold(`${holdId}.${Date.now() - 1000}`, "any")).toBeNull();
    expect(await getHold("garbage", "any")).toBeNull();
  });
});

describe("the price", () => {
  const vehicle = { id: VEHICLE_ID, dailyPrice: { amount: 100000, currency: "TRY" } } as never;
  const wifi = {
    slug: "wifi",
    name: { tr: "Wi-Fi", en: "Wi-Fi" },
    price: { amount: 8000, currency: "TRY" },
    pricing: "PER_DAY",
  } as const;
  const breakdown = {
    currency: "TRY",
    exchangeRate: 1,
    days: 3,
    lines: [
      {
        type: "VEHICLE",
        label: { tr: "T", en: "T" },
        quantity: 3,
        unitPrice: { amount: 100000, currency: "TRY" },
        total: { amount: 300000, currency: "TRY" },
      },
      {
        type: "EXTRA",
        label: { tr: "Wi-Fi", en: "Wi-Fi" },
        quantity: 3,
        unitPrice: { amount: 8000, currency: "TRY" },
        total: { amount: 24000, currency: "TRY" },
      },
    ],
    total: { amount: 324000, currency: "TRY" },
    pointsUsed: 100,
    payable: { amount: 274000, currency: "TRY" },
  };

  it("asks the API, with the hold's own id and the points choice", async () => {
    const fetchMock = respond(200, breakdown);
    vi.stubGlobal("fetch", fetchMock);
    const summary = await quotePrice({
      vehicle,
      days: 3,
      extras: [wifi],
      currency: "TRY",
      search,
      holdId: "0f4e8f4c-7b0e-4c75-8e0b-2d1c2a3b4c5d.1766000000000",
      pointsBalance: 500,
    });
    expect(JSON.parse(initOf(fetchMock).body as string)).toEqual({
      vehicleId: VEHICLE_ID,
      pickupBranchId: "b1",
      returnBranchId: "b2",
      startAt: "2026-12-14T07:00:00Z",
      endAt: "2026-12-17T07:00:00Z",
      currency: "TRY",
      holdId: "0f4e8f4c-7b0e-4c75-8e0b-2d1c2a3b4c5d",
      extras: [{ slug: "wifi", quantity: 1 }],
      usePoints: true,
    });
    expect(summary.total).toEqual({ amount: 274000, currency: "TRY" });
    expect(summary.points).toEqual({ count: 100, amount: { amount: 50000, currency: "TRY" } });
    expect(summary.extraLines[0].extra.slug).toBe("wifi");
    expect(summary.discount).toBeNull();
  });

  it("shows the plain total when no points are spent, and the VAT inside it", () => {
    const summary = summaryFromApi({ ...breakdown, pointsUsed: 0, payable: undefined } as never, [wifi]);
    expect(summary.total).toEqual({ amount: 324000, currency: "TRY" });
    expect(summary.points).toBeNull();
    expect(summary.vat.amount).toBe(54000);
  });

  it("tells a car that was taken", async () => {
    vi.stubGlobal("fetch", respond(409, { code: "VEHICLE_UNAVAILABLE" }));
    await expect(quotePrice({ vehicle, days: 3, extras: [], currency: "TRY", search })).rejects.toBeInstanceOf(
      VehicleUnavailableError,
    );
  });
});

describe("the account", () => {
  // Every call answers like the real API: GET /me with the user, the rest as the test says.
  const answering = (other: (url: string, method: string) => Response) =>
    vi.fn(async (url: string, init: RequestInit) =>
      url.endsWith("/me") && init.method === "GET" ? new Response(JSON.stringify(user)) : other(url, init.method ?? "GET"),
    );

  it("lists the open sessions", async () => {
    vi.stubGlobal(
      "fetch",
      respond(200, [{ id: "s1", current: true, device: null, createdAt: "2026-10-01T10:00:00Z", expiresAt: "2026-11-01T10:00:00Z" }]),
    );
    expect(await fetchMySessions()).toEqual([
      { id: "s1", current: true, device: null, createdAt: "2026-10-01T10:00:00Z", expiresAt: "2026-11-01T10:00:00Z" },
    ]);
  });

  it("changes the password, and says when the current one is wrong", async () => {
    sent.set("novera_session", "tok");
    vi.stubGlobal("fetch", answering(() => new Response(null, { status: 204 })));
    expect(await changePassword("eski-sifre-1", "yeni-sifre-2")).toEqual({ ok: true });
    vi.stubGlobal(
      "fetch",
      answering(
        () =>
          new Response(JSON.stringify({ code: "VALIDATION_FAILED", fieldErrors: { currentPassword: "INCORRECT" } }), {
            status: 422,
          }),
      ),
    );
    expect(await changePassword("yanlis-sifre", "yeni-sifre-2")).toEqual({ ok: false, reason: "incorrect" });
    expect(await changePassword("a", "kisa")).toEqual({ ok: false, reason: "invalid" });
  });

  it("saves notifications with PATCH /me, and deletes the account and its cookies", async () => {
    sent.set("novera_session", "tok");
    const calls: { url: string; method?: string; body?: unknown }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, method: init.method, body: init.body ? JSON.parse(init.body as string) : undefined });
        if (init.method === "DELETE") return new Response(null, { status: 204 });
        return new Response(JSON.stringify(user));
      }),
    );
    expect(await saveNotifications({ reminders: true, campaigns: true })).toEqual({ ok: true });
    expect(calls.find((call) => call.method === "PATCH")).toMatchObject({
      url: "http://api.test/me",
      body: { notifications: { reminders: true, campaigns: true } },
    });
    expect(await deleteMyAccount()).toEqual({ ok: true });
    expect(deleted).toEqual(expect.arrayContaining(["novera_session", MOCK_SESSION_COOKIE]));
  });

  it("maps a corporate account with its company details", () => {
    const session = sessionFromApi({
      id: "u2",
      email: "filo@ege.example",
      firstName: "Mert",
      lastName: "Kaya",
      accountType: "CORPORATE",
      companyName: "Ege Lojistik",
      taxOffice: "Bornova",
      companyCity: "İzmir",
      companyPhone: "+90 232 555 01 00",
      contactTitle: "Filo Yöneticisi",
      salesContact: { name: "Selin", email: "satis@novera.example", phone: "+90 212 555 01 99" },
      locale: "tr",
      theme: "light",
      currency: "TRY",
    } as Schemas["User"]);
    expect(session.company).toEqual({
      name: "Ege Lojistik",
      taxOffice: "Bornova",
      city: "İzmir",
      phone: "+90 232 555 01 00",
      contactTitle: "Filo Yöneticisi",
      salesContact: "satis@novera.example",
    });
  });
});
