import { describe, expect, it } from "vitest";
import { parseAdminListParams } from "@/lib/admin-query";
import { AIRPORTS, canCustomerCancel, CUSTOMER_TYPES, DRIVER_STEPS, EMPTY_REQUEST_FORM, FORM_TYPES, isDayInRange, isOpen, nextStatuses, OPEN_FILTER, REQUEST_FLOWS, REQUEST_LIST, REQUEST_STATUSES, REQUEST_TYPES, requestApiFilters, requestFormErrors, requestTone, toRequestBody, type RequestFormValues } from "@/lib/requests";
import { MOCK_ADMIN_SUMMARY } from "@/mocks/admin";
import { fleetSummary } from "@/mocks/fleet-panel";
import { createMockContract } from "@/mocks/admin-contracts";
import { cancelMockRequest, createMockRequest, getMockRequest, hasMockVipContract, listMockRequests, moveMockRequest, openRequestCount } from "@/mocks/requests";
import { en, tr } from "../i18n/messages";
import { routing } from "../i18n/routing";
import { FLEET_SCREENS } from "../lib/fleet-screens";

// The service request screens' rules (V2-41) without a browser: the steps of each kind (the API's table), the customer's form, the lists'
// addresses, and the sample requests, which behave like the API's. The same rules against the real API and the database are in
// apps/api/src/fleet/fleet-requests.integration.spec.ts.
const EGE = "5d0c1c0e-6f3a-4a52-9c1e-0a1b2c3d4e01";
const ANADOLU = "5d0c1c0e-6f3a-4a52-9c1e-0a1b2c3d4e03";
const CAR_101 = "7c000000-0000-4000-8000-000000000001";
const CAR_102 = "7c000000-0000-4000-8000-000000000002";
const TODAY = "2026-10-31";
const page = { page: 1, pageSize: 50, sort: null, filters: {} } as const;
let counter = 0;
const world = () => `requests-${(counter += 1)}-${Math.random().toString(36).slice(2, 8)}`;
const nextDay = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

const roadside = (extra: Partial<RequestFormValues> = {}): RequestFormValues => ({ ...EMPTY_REQUEST_FORM, type: "ROADSIDE", fleetVehicleId: CAR_101, incident: "TIRE", address: "Çiğli, İzmir", ...extra });
const replacement = (extra: Partial<RequestFormValues> = {}): RequestFormValues => ({ ...EMPTY_REQUEST_FORM, type: "REPLACEMENT_VEHICLE", fleetVehicleId: CAR_101, address: "Alsancak, İzmir", date: nextDay(2), durationDays: "5", ...extra });
const maintenance = (extra: Partial<RequestFormValues> = {}): RequestFormValues => ({ ...EMPTY_REQUEST_FORM, type: "MAINTENANCE", fleetVehicleId: CAR_102, service: "WINTER_TIRES", preferredDate: nextDay(7), valet: false, ...extra });

const NOW = Date.parse("2026-10-31T10:00:00.000Z");
const transfer = (extra: Partial<RequestFormValues> = {}): RequestFormValues => ({
  ...EMPTY_REQUEST_FORM,
  type: "TRANSFER",
  passengerName: "Ada Kaya",
  passengers: "3",
  flightNumber: "tk 1234",
  meetingKind: "airport",
  airport: "ADB",
  meetingAt: new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 16),
  destination: "Alsancak, İzmir",
  ...extra,
});
const vipContract = { productSlug: "vip-mobilite", startAt: nextDay(-1), endAt: nextDay(300), monthlyFee: "75000", deliveryCity: "İzmir" };

describe("the steps of each kind are the API's", () => {
  it("the table of the spec, in order", () => {
    expect(REQUEST_FLOWS.ROADSIDE).toEqual(["RECEIVED", "DISPATCHED", "EN_ROUTE", "COMPLETED"]);
    expect(REQUEST_FLOWS.REPLACEMENT_VEHICLE).toEqual(["RECEIVED", "APPROVED", "DELIVERED", "RETURNED"]);
    expect(REQUEST_FLOWS.MAINTENANCE).toEqual(["RECEIVED", "SCHEDULED", "IN_SERVICE", "COMPLETED"]);
    expect(REQUEST_FLOWS.TRANSFER).toEqual(["RECEIVED", "DRIVER_ASSIGNED", "MET", "COMPLETED"]);
  });

  it("a request goes to a later step of its kind or to cancelled, never back, never out of a finished one", () => {
    expect(nextStatuses("ROADSIDE", "RECEIVED")).toEqual(["DISPATCHED", "EN_ROUTE", "COMPLETED", "CANCELLED"]);
    expect(nextStatuses("ROADSIDE", "EN_ROUTE")).toEqual(["COMPLETED", "CANCELLED"]);
    expect(nextStatuses("ROADSIDE", "COMPLETED")).toEqual([]);
    expect(nextStatuses("REPLACEMENT_VEHICLE", "RETURNED")).toEqual([]);
    expect(nextStatuses("MAINTENANCE", "CANCELLED")).toEqual([]);
    expect(isOpen("REPLACEMENT_VEHICLE", "DELIVERED")).toBe(true);
    expect(isOpen("REPLACEMENT_VEHICLE", "RETURNED")).toBe(false);
  });

  it("the customer can withdraw only a received request; every state has a tone", () => {
    expect(REQUEST_STATUSES.filter(canCustomerCancel)).toEqual(["RECEIVED"]);
    expect(requestTone("ROADSIDE", "RECEIVED")).toBe("warning");
    expect(requestTone("ROADSIDE", "EN_ROUTE")).toBe("neutral");
    expect(requestTone("ROADSIDE", "COMPLETED")).toBe("success");
    expect(requestTone("ROADSIDE", "CANCELLED")).toBe("error");
  });
});

describe("the customer's form", () => {
  it("takes a good request of each of the three kinds about a car, and a kind that does not exist is refused", () => {
    for (const values of [roadside(), replacement(), maintenance()]) expect(requestFormErrors(values, TODAY)).toEqual({});
    expect(CUSTOMER_TYPES).toEqual(["ROADSIDE", "REPLACEMENT_VEHICLE", "MAINTENANCE"]);
    expect(requestFormErrors({ ...roadside(), type: "WASH" }, TODAY)).toEqual({ type: true });
  });

  it("a roadside request needs the incident and where the car is: an address, or a position, or both", () => {
    expect(requestFormErrors(roadside({ incident: "" }), TODAY)).toEqual({ incident: true });
    expect(requestFormErrors(roadside({ address: "" }), TODAY)).toEqual({ location: true });
    expect(requestFormErrors(roadside({ address: "", latitude: "38.42", longitude: "27.14" }), TODAY)).toEqual({});
    expect(requestFormErrors(roadside({ address: "Çiğli", latitude: "38.42", longitude: "27.14" }), TODAY)).toEqual({});
    // Half a position, and a position off the globe.
    expect(requestFormErrors(roadside({ address: "", latitude: "38.42" }), TODAY)).toEqual({ location: true });
    expect(requestFormErrors(roadside({ latitude: "138", longitude: "27" }), TODAY)).toEqual({ location: true });
    expect(requestFormErrors(roadside({ description: "x".repeat(501) }), TODAY)).toEqual({ description: true });
  });

  it("a replacement vehicle needs an address, a day from today on and 1 to 90 days", () => {
    expect(requestFormErrors(replacement({ address: "" }), TODAY)).toEqual({ address: true });
    expect(requestFormErrors(replacement({ date: "2026-10-30" }), TODAY)).toEqual({ date: true });
    expect(requestFormErrors(replacement({ date: TODAY }), TODAY)).toEqual({});
    expect(requestFormErrors(replacement({ date: "2028-01-01" }), TODAY)).toEqual({ date: true });
    for (const durationDays of ["", "0", "91", "2.5", "x"]) expect(requestFormErrors(replacement({ durationDays }), TODAY), durationDays).toEqual({ durationDays: true });
  });

  it("maintenance needs a service and a day; the pickup address only when a valet comes", () => {
    expect(requestFormErrors(maintenance({ service: "" }), TODAY)).toEqual({ service: true });
    expect(requestFormErrors(maintenance({ preferredDate: "" }), TODAY)).toEqual({ preferredDate: true });
    expect(requestFormErrors(maintenance({ valet: true }), TODAY)).toEqual({ address: true });
    expect(requestFormErrors(maintenance({ valet: true, address: "Bornova" }), TODAY)).toEqual({});
  });

  it("a car is needed, and the day range is today to a year ahead", () => {
    expect(requestFormErrors(roadside({ fleetVehicleId: "" }), TODAY)).toEqual({ fleetVehicleId: true });
    expect(isDayInRange("2026-10-31", TODAY)).toBe(true);
    expect(isDayInRange("2027-10-31", TODAY)).toBe(true);
    expect(isDayInRange("2027-11-02", TODAY)).toBe(false);
    expect(isDayInRange("2026-02-30", TODAY)).toBe(false);
  });

  it("is sent to the API as the API wants it", () => {
    expect(toRequestBody(roadside({ address: "", latitude: "38.42", longitude: "27.14", description: " Çekiyor " }))).toEqual({
      type: "ROADSIDE",
      fleetVehicleId: CAR_101,
      details: { incident: "TIRE", location: { latitude: 38.42, longitude: 27.14 }, description: "Çekiyor" },
    });
    expect(toRequestBody(replacement())).toEqual({ type: "REPLACEMENT_VEHICLE", fleetVehicleId: CAR_101, details: { address: "Alsancak, İzmir", date: nextDay(2), durationDays: 5 } });
    expect(toRequestBody(maintenance({ valet: true, address: "Bornova" })).details).toEqual({ service: "WINTER_TIRES", preferredDate: nextDay(7), valet: true, address: "Bornova" });
  });
});

describe("a VIP transfer (V2-42)", () => {
  it("is a fourth kind of the form, and the others are still the three about a car", () => {
    expect(FORM_TYPES).toEqual(["ROADSIDE", "REPLACEMENT_VEHICLE", "MAINTENANCE", "TRANSFER"]);
    expect(CUSTOMER_TYPES).not.toContain("TRANSFER");
    expect(DRIVER_STEPS).toEqual(["DRIVER_ASSIGNED", "MET", "COMPLETED"]);
    expect(AIRPORTS).toHaveLength(12);
  });

  it("takes a good transfer without a car, and names what is wrong", () => {
    expect(requestFormErrors(transfer(), TODAY)).toEqual({});
    expect(requestFormErrors(transfer({ meetingKind: "address", airport: "", address: "Otel Lobisi" }), TODAY)).toEqual({});
    expect(requestFormErrors(transfer({ passengerName: " " }), TODAY)).toEqual({ passengerName: true });
    for (const passengers of ["", "0", "8", "2.5"]) expect(requestFormErrors(transfer({ passengers }), TODAY)).toEqual({ passengers: true });
    for (const flightNumber of ["TURKISH1", "1234", "TK12345", "T"]) expect(requestFormErrors(transfer({ flightNumber }), TODAY)).toEqual({ flightNumber: true });
    expect(requestFormErrors(transfer({ flightNumber: "" }), TODAY)).toEqual({});
    expect(requestFormErrors(transfer({ airport: "" }), TODAY)).toEqual({ meeting: true });
    expect(requestFormErrors(transfer({ airport: "XXX" }), TODAY)).toEqual({ meeting: true });
    expect(requestFormErrors(transfer({ meetingKind: "address", airport: "", address: " " }), TODAY)).toEqual({ meeting: true });
    expect(requestFormErrors(transfer({ destination: "" }), TODAY)).toEqual({ destination: true });
    expect(requestFormErrors(transfer({ note: "n".repeat(501) }), TODAY)).toEqual({ note: true });
  });

  it("the moment is at least two hours from now, at most a year, and the edge itself is allowed", () => {
    const at = (offsetMs: number) => new Date(NOW + offsetMs + 3 * 3_600_000).toISOString().slice(0, 16);
    // The field writes Istanbul time (+03:00), so the text above is shifted by the three hours back to the instant.
    expect(requestFormErrors(transfer({ meetingAt: at(2 * 3_600_000) }), TODAY, NOW)).toEqual({});
    expect(requestFormErrors(transfer({ meetingAt: at(2 * 3_600_000 - 60_000) }), TODAY, NOW)).toEqual({ meetingAt: true });
    expect(requestFormErrors(transfer({ meetingAt: at(-3_600_000) }), TODAY, NOW)).toEqual({ meetingAt: true });
    expect(requestFormErrors(transfer({ meetingAt: at(400 * 86_400_000) }), TODAY, NOW)).toEqual({ meetingAt: true });
    for (const meetingAt of ["", "yarın", "2026-11-03", "2026-02-30T10:00", "2026-11-03T25:00"]) expect(requestFormErrors(transfer({ meetingAt }), TODAY, NOW)).toEqual({ meetingAt: true });
  });

  it("is sent to the API without a car, with the flight in capitals and the moment as an instant", () => {
    const body = toRequestBody(transfer({ meetingAt: "2026-11-03T09:30", note: " Tabela " }));
    expect(body).toEqual({
      type: "TRANSFER",
      details: { passengerName: "Ada Kaya", passengers: 3, flightNumber: "TK1234", meeting: { airport: "ADB" }, meetingAt: "2026-11-03T06:30:00.000Z", destination: "Alsancak, İzmir", note: "Tabela" },
    });
    expect("fleetVehicleId" in body).toBe(false);
    expect(toRequestBody(transfer({ meetingKind: "address", address: " Otel ", flightNumber: "" })).details).toMatchObject({ meeting: { address: "Otel" } });
  });

  it("is forbidden for a company with no VIP Mobilite contract, and opens once the administrator has made one", () => {
    const name = world();
    expect(hasMockVipContract(name, EGE)).toBe(false);
    expect(createMockRequest(name, EGE, transfer())).toEqual({ status: "forbidden" });
    expect(listMockRequests(name, page, EGE).total).toBe(4);
    expect(fleetSummary(name, EGE).hasVipContract).toBe(false);

    expect(createMockContract(name, EGE, { ...vipContract, status: "ACTIVE" }).status).toBe("ok");
    expect(hasMockVipContract(name, EGE)).toBe(true);
    expect(fleetSummary(name, EGE).hasVipContract).toBe(true);
    const made = createMockRequest(name, EGE, transfer());
    expect(made).toMatchObject({ status: "ok", value: { type: "TRANSFER", status: "RECEIVED", vehicle: null, similarOpen: [], details: { flightNumber: "TK1234", meeting: { airport: "ADB", address: null } } } });
  });

  it("needs the driver written down to be assigned, met and finished; cancelling needs none", () => {
    const name = world();
    createMockContract(name, EGE, { ...vipContract, status: "ACTIVE" });
    const made = createMockRequest(name, EGE, transfer());
    if (made.status !== "ok") throw new Error("not made");
    const { number } = made.value;
    for (const status of DRIVER_STEPS) expect(moveMockRequest(name, number, status, null, undefined)).toEqual({ status: "invalid", fields: { assignee: "REQUIRED" } });
    expect(moveMockRequest(name, number, "DRIVER_ASSIGNED", null, "")).toEqual({ status: "invalid", fields: { assignee: "REQUIRED" } });
    expect(moveMockRequest(name, number, "DRIVER_ASSIGNED", null, "Mehmet Usta, 0532 000 00 02")).toEqual({ status: "ok" });
    expect(moveMockRequest(name, number, "MET", null, undefined)).toEqual({ status: "ok" });
    expect(moveMockRequest(name, number, "COMPLETED", null, undefined)).toEqual({ status: "ok" });
    const other = createMockRequest(name, EGE, transfer());
    if (other.status !== "ok") throw new Error("not made");
    expect(moveMockRequest(name, other.value.number, "CANCELLED", "Uçuş iptal", undefined)).toEqual({ status: "ok" });
  });
});

describe("the lists' addresses", () => {
  it("`durum` is the open ones or a step, `tur` a kind; anything else falls back", () => {
    const params = parseAdminListParams({ durum: "acik", tur: "ROADSIDE" }, REQUEST_LIST);
    expect(params.filters).toEqual({ durum: OPEN_FILTER, tur: "ROADSIDE" });
    expect(requestApiFilters(params.filters)).toEqual({ open: true, type: "ROADSIDE" });
    expect(requestApiFilters({ durum: "EN_ROUTE" })).toEqual({ status: "EN_ROUTE" });
    expect(parseAdminListParams({ durum: "yok", tur: "WASH" }, REQUEST_LIST).filters).toEqual({});
    expect(params.sort).toEqual({ key: "createdAt", dir: "desc" });
  });
});

describe("the sample requests", () => {
  it("are the company's own, newest first, and another company's is not found", () => {
    const name = world();
    const own = listMockRequests(name, page, EGE);
    expect(own.total).toBe(4);
    expect(own.items.every((item) => item.company.id === EGE)).toBe(true);
    expect(own.items.map((item) => item.createdAt)).toEqual([...own.items.map((item) => item.createdAt)].sort().reverse());
    expect(listMockRequests(name, page, ANADOLU).total).toBe(1);
    expect(listMockRequests(name, page).total).toBe(5);
    const theirs = listMockRequests(name, page, ANADOLU).items[0]!;
    expect(getMockRequest(name, theirs.number, EGE)).toBeNull();
    expect(getMockRequest(name, theirs.number.toLowerCase(), ANADOLU)?.number).toBe(theirs.number);
    expect(cancelMockRequest(name, EGE, theirs.number)).toEqual({ status: "not_found" });
  });

  it("narrow by kind, step, open or over, car and word", () => {
    const name = world();
    expect(listMockRequests(name, { ...page, filters: { tur: "ROADSIDE" } }, EGE).total).toBe(2);
    expect(listMockRequests(name, { ...page, filters: { durum: "acik" } }, EGE).total).toBe(3);
    expect(listMockRequests(name, { ...page, filters: { durum: "RETURNED" } }, EGE).total).toBe(1);
    expect(listMockRequests(name, { ...page, vehicle: CAR_102 }, EGE).total).toBe(2);
    expect(listMockRequests(name, { ...page, q: "anadolu" }).total).toBe(1);
    expect(listMockRequests(name, { ...page, q: "35 flm 101" }).total).toBe(2);
  });

  it("a made request is received, has the first line of its timeline, and says which other open ones the car has", () => {
    const name = world();
    const made = createMockRequest(name, EGE, roadside());
    expect(made).toMatchObject({ status: "ok", value: { status: "RECEIVED", open: true, canCancel: true, vehicle: { plate: "35 FLM 101" } } });
    if (made.status !== "ok") return;
    expect(made.value.events).toHaveLength(1);
    expect(made.value.events[0]).toMatchObject({ status: "RECEIVED", by: "COMPANY" });
    // The sample car 35 FLM 101 already has an open roadside request (the first sample one).
    expect(made.value.similarOpen).toEqual([expect.stringMatching(/^TLP-\d{4}-00001$/)]);
    expect(made.value.details).toMatchObject({ incident: "TIRE", location: { address: "Çiğli, İzmir", latitude: null, longitude: null }, description: null });
    expect(createMockRequest(name, EGE, roadside({ fleetVehicleId: "7c000000-0000-4000-8000-0000000000ff" }))).toEqual({ status: "invalid", fields: { fleetVehicleId: "UNKNOWN_REFERENCE" } });
    expect(listMockRequests(name, page, EGE).total).toBe(5);
  });

  it("is withdrawn only while received; once Novera has moved it, the customer cannot", () => {
    const name = world();
    const received = listMockRequests(name, { ...page, filters: { durum: "RECEIVED" } }, EGE).items[0]!;
    expect(cancelMockRequest(name, EGE, received.number)).toEqual({ status: "ok" });
    expect(getMockRequest(name, received.number, EGE)).toMatchObject({ status: "CANCELLED", open: false, canCancel: false, nextStatuses: [] });
    expect(cancelMockRequest(name, EGE, received.number)).toEqual({ status: "not_allowed" });
    const moving = listMockRequests(name, { ...page, filters: { durum: "EN_ROUTE" } }, EGE).items[0]!;
    expect(cancelMockRequest(name, EGE, moving.number)).toEqual({ status: "not_allowed" });
  });

  it("Novera moves it along: a later step, with a note and who is on it; never back, and the timeline says Novera did it", () => {
    const name = world();
    const made = createMockRequest(name, EGE, maintenance());
    if (made.status !== "ok") throw new Error("not made");
    const { number } = made.value;
    expect(moveMockRequest(name, number, "SCHEDULED", "Salı 10:00", "Alsancak Lastik")).toEqual({ status: "ok" });
    expect(moveMockRequest(name, number, "RECEIVED", null, undefined)).toEqual({ status: "not_allowed" });
    expect(moveMockRequest(name, number, "SCHEDULED", null, undefined)).toEqual({ status: "not_allowed" });
    expect(moveMockRequest(name, number, "DELIVERED", null, undefined)).toEqual({ status: "not_allowed" });
    expect(moveMockRequest(name, number, "COMPLETED", null, undefined)).toEqual({ status: "ok" });
    expect(moveMockRequest(name, number, "CANCELLED", null, undefined)).toEqual({ status: "not_allowed" });
    expect(moveMockRequest(name, "TLP-2026-99999", "COMPLETED", null, undefined)).toEqual({ status: "not_found" });
    const detail = getMockRequest(name, number, EGE)!;
    expect(detail.assignee).toBe("Alsancak Lastik");
    expect(detail.events.map((event) => [event.status, event.by, event.note])).toEqual([["RECEIVED", "COMPANY", null], ["SCHEDULED", "NOVERA", "Salı 10:00"], ["COMPLETED", "NOVERA", null]]);
  });

  it("the open ones are counted for a company and for all, and the summaries carry the counts", () => {
    const name = world();
    expect(openRequestCount(name, EGE)).toBe(3);
    expect(openRequestCount(name)).toBe(4);
    expect(openRequestCount(name)).toBe(MOCK_ADMIN_SUMMARY.serviceRequests);
    expect(fleetSummary(name, EGE).requests).toEqual({ open: 3 });
    expect(fleetSummary(name, ANADOLU).requests).toEqual({ open: 1 });
  });
});

describe("the words and the address", () => {
  it("every kind, step and the screen are named in both languages and the screen has its address", () => {
    const entry = FLEET_SCREENS.find((screen) => screen.key === "requests")!;
    expect(Object.keys(routing.pathnames)).toEqual(expect.arrayContaining([entry.href, "/filom/talepler/yeni", "/filom/talepler/[number]", "/yonetim/talepler", "/yonetim/talepler/[number]"]));
    for (const language of [tr, en]) {
      expect(language.FleetPanel.nav.requests).toBeTruthy();
      for (const type of REQUEST_TYPES) {
        expect(language.FleetPanel.requests.type[type]).toBeTruthy();
        expect(language.Admin.requests.type[type]).toBeTruthy();
      }
      for (const status of REQUEST_STATUSES) {
        expect(language.FleetPanel.requests.status[status]).toBeTruthy();
        expect(language.Admin.requests.status[status]).toBeTruthy();
      }
    }
    expect(tr.FleetPanel.requests.status.DISPATCHED).toBe("Yönlendirildi");
    expect(tr.FleetPanel.requests.status.EN_ROUTE).toBe("Yolda");
  });
});
