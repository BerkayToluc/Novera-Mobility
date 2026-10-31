import { normalizeSearch } from "@/lib/branch-detail";
import { canCustomerCancel, isOpen, nextStatuses, REQUEST_FLOWS, requestApiFilters, type RequestFormValues, type RequestStatus, type RequestType, type ServiceRequest, type ServiceRequestCreated, type ServiceRequestDetail, type ServiceRequestPage } from "@/lib/requests";
import { toRequestBody } from "@/lib/requests";
import { getMockCompany } from "./admin-companies";
import { listMockCompanyCars, listMockContracts } from "./admin-contracts";

// The sample service requests (USE_MOCKS=1, local work and tests only, lib/mock-world.ts). They behave like the API's: a request is for one
// company, each kind has its own steps, the customer can only withdraw one that is received, Novera moves it forward, and every step goes
// into a timeline. Kept per "world" on `globalThis`, like the contracts: a test that makes or moves a request works in a world of its own.
const EGE = "5d0c1c0e-6f3a-4a52-9c1e-0a1b2c3d4e01";
const ANADOLU = "5d0c1c0e-6f3a-4a52-9c1e-0a1b2c3d4e03";
const CAR_101 = "7c000000-0000-4000-8000-000000000001";
const CAR_102 = "7c000000-0000-4000-8000-000000000002";
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

type Stored = Omit<ServiceRequestDetail, "company" | "canCancel" | "nextStatuses" | "open"> & { companyId: string };
type World = { requests: Stored[]; serial: number };

const store = globalThis as typeof globalThis & { __noveraMockRequests?: Map<string, World> };
const MAX_WORLDS = 60;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

const car = (id: string, plate: string, model: string) => ({ id, plate, model });
const EGEA = car(CAR_101, "35 FLM 101", "Fiat Egea");
const TOGG = car(CAR_102, "35 FLM 102", "Togg T10X");

function seed(): World {
  let n = 0;
  const make = (companyId: string, type: RequestType, vehicle: Stored["vehicle"], details: unknown, steps: Array<[RequestStatus, number, string | null]>, assignee: string | null = null): Stored => {
    n += 1;
    const events = steps.map(([status, age, note]) => ({ status, note, at: ago(age), by: (status === "RECEIVED" ? "COMPANY" : "NOVERA") as "COMPANY" | "NOVERA" }));
    const last = steps[steps.length - 1]!;
    return {
      id: `c1000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
      number: `TLP-${new Date().getUTCFullYear()}-${String(n).padStart(5, "0")}`,
      type,
      status: last[0],
      vehicle,
      details: details as Stored["details"],
      assignee,
      createdAt: events[0]!.at,
      updatedAt: events[events.length - 1]!.at,
      events,
      companyId,
    };
  };
  return {
    serial: 5,
    requests: [
      make(EGE, "ROADSIDE", EGEA, { incident: "BREAKDOWN", location: { address: "D550 Karayolu 12. km, Torbalı, İzmir", latitude: null, longitude: null }, description: "Motor uyarı ışığı yandı, araç çekmiyor." }, [["RECEIVED", 5 * HOUR, null], ["DISPATCHED", 4 * HOUR, "Çekici yönlendirildi."], ["EN_ROUTE", 3 * HOUR, "Çekici 20 dakika içinde orada."]], "Ege Çekici, 0532 000 00 01"),
      make(EGE, "MAINTENANCE", TOGG, { service: "WINTER_TIRES", preferredDate: new Date(Date.now() + 6 * DAY).toISOString().slice(0, 10), valet: true, address: "Bornova, İzmir" }, [["RECEIVED", 2 * DAY, null], ["SCHEDULED", DAY, "Salı günü 10:00'da vale ile alınacak."]], "Alsancak Lastik Oteli"),
      make(EGE, "REPLACEMENT_VEHICLE", EGEA, { address: "Alsancak, İzmir", date: new Date(Date.now() - 20 * DAY).toISOString().slice(0, 10), durationDays: 4 }, [["RECEIVED", 30 * DAY, null], ["APPROVED", 29 * DAY, null], ["DELIVERED", 20 * DAY, "Teslim edildi."], ["RETURNED", 16 * DAY, "İade alındı."]]),
      make(EGE, "ROADSIDE", TOGG, { incident: "TIRE", location: { address: "Çiğli Atatürk Organize Sanayi Bölgesi", latitude: null, longitude: null }, description: null }, [["RECEIVED", HOUR, null]]),
      make(ANADOLU, "ROADSIDE", car("c2000000-0000-4000-8000-000000000001", "06 ANA 123", "Renault Clio"), { incident: "FUEL_OR_CHARGE", location: { address: "Ankara Çevre Yolu", latitude: null, longitude: null }, description: null }, [["RECEIVED", 2 * HOUR, null]]),
    ],
  };
}

function world(name: string): World {
  const worlds = (store.__noveraMockRequests ??= new Map());
  let found = worlds.get(name);
  if (!found) {
    // The oldest world that is not "main" makes room, so a test run cannot grow the server without end.
    if (worlds.size >= MAX_WORLDS) {
      const oldest = [...worlds.keys()].find((key) => key !== "main");
      if (oldest) worlds.delete(oldest);
    }
    found = seed();
    worlds.set(name, found);
  }
  return found;
}

function view(name: string, row: Stored): ServiceRequest {
  const { companyId, events: _events, ...rest } = row;
  void _events;
  return { ...rest, company: { id: companyId, name: getMockCompany(name, companyId)?.name ?? "—" }, open: isOpen(row.type, row.status) };
}

function detail(name: string, row: Stored): ServiceRequestDetail {
  return { ...view(name, row), events: row.events.map((event) => ({ ...event })), canCancel: canCustomerCancel(row.status), nextStatuses: nextStatuses(row.type, row.status) };
}

const normalize = (number: string) => number.trim().toUpperCase();

type Sort = { key: string; dir: "asc" | "desc" } | null;
type ListQuery = { page: number; pageSize: number; sort: Sort; filters: Partial<Record<"durum" | "tur", string>>; vehicle?: string | null; q?: string; company?: string | null };

export function listMockRequests(name: string, query: ListQuery, companyId: string | null = null): ServiceRequestPage {
  const api = requestApiFilters(query.filters);
  const words = normalizeSearch(query.q ?? "").split(/\s+/).filter(Boolean);
  const rows = world(name).requests.filter((row) => {
    if (companyId !== null && row.companyId !== companyId) return false;
    if (query.company && row.companyId !== query.company) return false;
    if (api.type && row.type !== api.type) return false;
    if (api.status && row.status !== api.status) return false;
    if (api.open !== undefined && isOpen(row.type, row.status) !== api.open) return false;
    if (query.vehicle && row.vehicle?.id !== query.vehicle) return false;
    const haystack = normalizeSearch(`${row.number} ${row.vehicle?.plate ?? ""} ${getMockCompany(name, row.companyId)?.name ?? ""}`);
    return words.every((word) => haystack.includes(word));
  });
  const sign = query.sort?.dir === "asc" ? 1 : -1;
  const by = query.sort?.key === "updatedAt" ? "updatedAt" : "createdAt";
  rows.sort((a, b) => sign * (a[by] < b[by] ? -1 : a[by] > b[by] ? 1 : 0) || a.id.localeCompare(b.id));
  return { items: rows.slice((query.page - 1) * query.pageSize, query.page * query.pageSize).map((row) => view(name, row)), total: rows.length, page: query.page, pageSize: query.pageSize };
}

// `companyId` narrows to one company's requests (the customer's screens): another company's is not found.
export function getMockRequest(name: string, number: string, companyId: string | null = null): ServiceRequestDetail | null {
  const row = world(name).requests.find((entry) => entry.number === normalize(number) && (companyId === null || entry.companyId === companyId));
  return row ? detail(name, row) : null;
}

// Whether the company has a VIP Mobilite contract in force: the only ones that can ask for a transfer (docs/FLEET.md §3.1).
export const hasMockVipContract = (name: string, companyId: string): boolean => (listMockContracts(name, companyId) ?? []).some((contract) => contract.productSlug === "vip-mobilite" && contract.status === "ACTIVE");

export type CreateOutcome = { status: "ok"; value: ServiceRequestCreated } | { status: "invalid"; fields: Record<string, string> } | { status: "forbidden" };

export function createMockRequest(name: string, companyId: string, values: RequestFormValues): CreateOutcome {
  const w = world(name);
  if (values.type === "TRANSFER") return createMockTransfer(name, companyId, values);
  const vehicle = listMockCompanyCars(name, companyId).find((entry) => entry.id === values.fleetVehicleId && entry.status === "ACTIVE");
  if (!vehicle) return { status: "invalid", fields: { fleetVehicleId: "UNKNOWN_REFERENCE" } };
  const body = toRequestBody(values);
  const similar = w.requests.filter((row) => row.companyId === companyId && row.vehicle?.id === vehicle.id && row.type === body.type && isOpen(row.type, row.status)).map((row) => row.number);
  const now = new Date().toISOString();
  w.serial += 1;
  const row: Stored = {
    id: crypto.randomUUID(),
    number: `TLP-${now.slice(0, 4)}-${String(w.serial).padStart(5, "0")}`,
    type: body.type,
    status: "RECEIVED",
    vehicle: { id: vehicle.id, plate: vehicle.plate, model: `${vehicle.model.brand} ${vehicle.model.model}` },
    details: normalizeDetails(body),
    assignee: null,
    createdAt: now,
    updatedAt: now,
    events: [{ status: "RECEIVED", note: null, at: now, by: "COMPANY" }],
    companyId,
  };
  w.requests.push(row);
  return { status: "ok", value: { ...detail(name, row), similarOpen: similar } };
}

// A transfer: no car, a VIP Mobilite contract needed (403 without one), and the details as the API keeps them.
function createMockTransfer(name: string, companyId: string, values: RequestFormValues): CreateOutcome {
  if (!hasMockVipContract(name, companyId)) return { status: "forbidden" };
  const w = world(name);
  const body = toRequestBody(values);
  const d = body.details as unknown as { passengerName: string; passengers: number; flightNumber?: string; meeting: { airport?: string; address?: string }; meetingAt: string; destination: string; note?: string };
  const now = new Date().toISOString();
  w.serial += 1;
  const row: Stored = {
    id: crypto.randomUUID(),
    number: `TLP-${now.slice(0, 4)}-${String(w.serial).padStart(5, "0")}`,
    type: "TRANSFER",
    status: "RECEIVED",
    vehicle: null,
    details: { passengerName: d.passengerName, passengers: d.passengers, flightNumber: d.flightNumber ?? null, meeting: { airport: d.meeting.airport ?? null, address: d.meeting.address ?? null }, meetingAt: d.meetingAt, destination: d.destination, note: d.note ?? null } as unknown as Stored["details"],
    assignee: null,
    createdAt: now,
    updatedAt: now,
    events: [{ status: "RECEIVED", note: null, at: now, by: "COMPANY" }],
    companyId,
  };
  w.requests.push(row);
  return { status: "ok", value: { ...detail(name, row), similarOpen: [] } };
}

// The details as the API stores them: the position and the address always there, empty ones `null`.
function normalizeDetails(body: ReturnType<typeof toRequestBody>): Stored["details"] {
  const d = body.details as unknown as Record<string, unknown>;
  if (body.type === "ROADSIDE") {
    const location = (d.location ?? {}) as { address?: string; latitude?: number; longitude?: number };
    return { incident: d.incident, location: { address: location.address ?? null, latitude: location.latitude ?? null, longitude: location.longitude ?? null }, description: (d.description as string | undefined) ?? null } as Stored["details"];
  }
  if (body.type === "MAINTENANCE") return { ...d, address: (d.address as string | undefined) ?? null } as Stored["details"];
  return d as Stored["details"];
}

export type CancelOutcome = { status: "ok" } | { status: "not_found" | "not_allowed" };

export function cancelMockRequest(name: string, companyId: string, number: string): CancelOutcome {
  const row = world(name).requests.find((entry) => entry.number === normalize(number) && entry.companyId === companyId);
  if (!row) return { status: "not_found" };
  if (!canCustomerCancel(row.status)) return { status: "not_allowed" };
  const now = new Date().toISOString();
  Object.assign(row, { status: "CANCELLED", updatedAt: now });
  row.events.push({ status: "CANCELLED", note: null, at: now, by: "COMPANY" });
  return { status: "ok" };
}

export type MoveOutcome = { status: "ok" } | { status: "not_found" | "not_allowed" } | { status: "invalid"; fields: Record<string, string> };

export function moveMockRequest(name: string, number: string, status: RequestStatus, note: string | null, assignee: string | null | undefined): MoveOutcome {
  const row = world(name).requests.find((entry) => entry.number === normalize(number));
  if (!row) return { status: "not_found" };
  if (!nextStatuses(row.type, row.status).includes(status)) return { status: "not_allowed" };
  // A transfer needs a driver written down to be assigned, met and finished (V2-42).
  const driver = assignee !== undefined ? assignee : row.assignee;
  if (row.type === "TRANSFER" && (status === "DRIVER_ASSIGNED" || status === "MET" || status === "COMPLETED") && !driver) return { status: "invalid", fields: { assignee: "REQUIRED" } };
  const now = new Date().toISOString();
  Object.assign(row, { status, updatedAt: now, ...(assignee !== undefined ? { assignee } : {}) });
  row.events.push({ status, note, at: now, by: "NOVERA" });
  return { status: "ok" };
}

// What the summaries show: the requests that are not over, of one company (Filom) or of all (the administration).
export const openRequestCount = (name: string, companyId: string | null = null): number =>
  world(name).requests.filter((row) => (companyId === null || row.companyId === companyId) && isOpen(row.type, row.status)).length;

export { REQUEST_FLOWS };
