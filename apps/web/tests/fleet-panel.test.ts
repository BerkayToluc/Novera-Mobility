import { describe, expect, it } from "vitest";
import { parseAdminListParams } from "@/lib/admin-query";
import {
  assignFormSchema,
  ASSIGNMENT_LIST,
  CONTRACT_LIST,
  daysUntil,
  EMPLOYEE_LIST,
  EMPTY_ASSIGN_FORM,
  EMPTY_EMPLOYEE_FORM,
  employeeFormSchema,
  employeeFormValuesOf,
  toAssignBody,
  toEmployeeCreateBody,
  toEmployeeUpdateBody,
  VEHICLE_LIST,
  type AssignFormValues,
  type EmployeeFormValues,
} from "@/lib/fleet-panel";
import { FLEET_SCREENS, isCurrentFleetScreen } from "@/lib/fleet-screens";
import { codeMessages, invalidFields } from "@/lib/validation";
import {
  assignFleetVehicle,
  createFleetEmployee,
  endFleetAssignment,
  fleetSummary,
  getFleetContract,
  getFleetEmployee,
  getFleetVehicle,
  listFleetAssignments,
  listFleetContracts,
  listFleetEmployees,
  listFleetVehicles,
  setFleetEmployeeActive,
  updateFleetEmployee,
} from "@/mocks/fleet-panel";
import { en, tr } from "../i18n/messages";
import { routing } from "../i18n/routing";

const EGE = "5d0c1c0e-6f3a-4a52-9c1e-0a1b2c3d4e01";
const OTHER = "5d0c1c0e-6f3a-4a52-9c1e-0a1b2c3d4e03";
const CAR_101 = "7c000000-0000-4000-8000-000000000001";
const CAR_102 = "7c000000-0000-4000-8000-000000000002";
const AYSE = "8b000000-0000-4000-8000-000000000001";
const CANSU = "8b000000-0000-4000-8000-000000000003";
const ILKER = "8b000000-0000-4000-8000-000000000005";
const first = { page: 1, pageSize: 20, sort: null, q: "" };

describe("the Filom screens (V2-36)", () => {
  it("every screen has a name in both languages and an address in the router", () => {
    for (const { key, href } of FLEET_SCREENS) {
      expect(tr.FleetPanel.nav[key], `tr ${key}`).toBeTruthy();
      expect(en.FleetPanel.nav[key], `en ${key}`).toBeTruthy();
      expect(Object.keys(routing.pathnames), href).toContain(href);
    }
    // The summary is the front door: current only on its own address; the others also own what is under them.
    expect(isCurrentFleetScreen("/filom", "/filom")).toBe(true);
    expect(isCurrentFleetScreen("/filom/araclar", "/filom")).toBe(false);
    expect(isCurrentFleetScreen("/filom/araclar/35FLM101", "/filom/araclar")).toBe(true);
    expect(isCurrentFleetScreen("/filom/araclarim", "/filom/araclar")).toBe(false);
  });

  it("the lists' addresses sort and filter by their allowed values, and ignore anything else", () => {
    expect(parseAdminListParams({ sirala: "year:desc", durum: "kullanimda", zimmet: "bosta" }, VEHICLE_LIST)).toMatchObject({ sort: { key: "year", dir: "desc" }, filters: { durum: "kullanimda", zimmet: "bosta" } });
    expect(parseAdminListParams({ sirala: "startKm:asc", durum: "yok", zimmet: "x" }, VEHICLE_LIST)).toMatchObject({ sort: { key: "plate", dir: "asc" }, filters: {} });
    expect(parseAdminListParams({ durum: "pasif" }, EMPLOYEE_LIST).filters).toEqual({ durum: "pasif" });
    expect(parseAdminListParams({ sirala: "lastName:asc" }, EMPLOYEE_LIST).sort).toEqual({ key: "lastName", dir: "asc" });
    expect(parseAdminListParams({ durum: "acik", sirala: "startedAt:asc" }, ASSIGNMENT_LIST)).toMatchObject({ sort: null, filters: { durum: "acik" } });
    expect(parseAdminListParams({ durum: "ENDED" }, CONTRACT_LIST).filters).toEqual({ durum: "ENDED" });
  });

  it("counts the days to a date", () => {
    expect(daysUntil("2026-11-10", "2026-10-31")).toBe(10);
    expect(daysUntil("2026-10-31", "2026-10-31")).toBe(0);
    expect(daysUntil("2026-10-01", "2026-10-31")).toBe(-30);
  });
});

describe("the person form", () => {
  const schema = employeeFormSchema(codeMessages());
  const valid = (overrides: Partial<EmployeeFormValues> = {}): EmployeeFormValues => ({ ...EMPTY_EMPLOYEE_FORM, firstName: "Ada", lastName: "Kaya", ...overrides });
  const fieldsOf = (values: EmployeeFormValues): string[] => {
    const result = schema.safeParse(values);
    return result.success ? [] : invalidFields(result.error).sort();
  };

  it("needs a first and a last name; the rest may be empty, and an address and a number have to be right", () => {
    expect(fieldsOf(valid())).toEqual([]);
    expect(fieldsOf(EMPTY_EMPLOYEE_FORM)).toEqual(["firstName", "lastName"]);
    expect(fieldsOf(valid({ email: "degil", phone: "abc" }))).toEqual(["email", "phone"]);
    expect(fieldsOf(valid({ email: "ada@example.test", phone: "+90 532 555 01 01", department: "Satış", employeeNo: "S-1" }))).toEqual([]);
    expect(fieldsOf(valid({ department: "x".repeat(61), employeeNo: "y".repeat(31) }))).toEqual(["department", "employeeNo"]);
  });

  it("a new person sends what was filled; a change sends only what changed, with an emptied field as nothing", () => {
    expect(toEmployeeCreateBody(valid())).toEqual({ firstName: "Ada", lastName: "Kaya" });
    expect(toEmployeeCreateBody(valid({ department: " Satış ", email: "a@b.co" }))).toEqual({ firstName: "Ada", lastName: "Kaya", department: "Satış", email: "a@b.co" });
    const initial = valid({ department: "Satış", phone: "+90 532 555 01 01" });
    expect(toEmployeeUpdateBody(initial, initial, "v1")).toEqual({ updatedAt: "v1" });
    expect(toEmployeeUpdateBody({ ...initial, department: "" }, initial, "v1")).toEqual({ updatedAt: "v1", department: null });
    expect(toEmployeeUpdateBody({ ...initial, lastName: "Demir" }, initial, "v1")).toEqual({ updatedAt: "v1", lastName: "Demir" });
  });

  it("opens with what is stored", () => {
    const person = getFleetEmployee("unit-form", EGE, AYSE)!;
    expect(employeeFormValuesOf(person)).toMatchObject({ firstName: "Ayşe", lastName: "Demir", department: "Satış", employeeNo: "ORN-001" });
  });
});

describe("the assignment form", () => {
  const schema = assignFormSchema(codeMessages());
  const fieldsOf = (values: AssignFormValues): string[] => {
    const result = schema.safeParse(values);
    return result.success ? [] : invalidFields(result.error).sort();
  };

  it("needs a person; the day may be left out, and has to be a real one", () => {
    expect(fieldsOf(EMPTY_ASSIGN_FORM)).toEqual(["employeeId"]);
    expect(fieldsOf({ employeeId: CANSU, startedAt: "", note: "" })).toEqual([]);
    expect(fieldsOf({ employeeId: CANSU, startedAt: "2026-02-30", note: "" })).toEqual(["startedAt"]);
    expect(fieldsOf({ employeeId: CANSU, startedAt: "2026-10-30", note: "x".repeat(201) })).toEqual(["note"]);
    expect(toAssignBody(CAR_102, { employeeId: CANSU, startedAt: "", note: "" })).toEqual({ fleetVehicleId: CAR_102, employeeId: CANSU });
    expect(toAssignBody(CAR_102, { employeeId: CANSU, startedAt: "2026-10-30", note: " Not " })).toEqual({ fleetVehicleId: CAR_102, employeeId: CANSU, startedAt: "2026-10-30", note: "Not" });
  });
});

describe("the sample fleet of the customer", () => {
  it("shows the company's own cars, contract and summary, and another company gets nothing", () => {
    const world = "unit-fleet-read";
    expect(fleetSummary(world, EGE)).toMatchObject({ hasActiveContract: true, vehicles: { total: 2, assigned: 1, idle: 1 }, contracts: { active: 1, endingSoon: 0 }, maintenanceDue: 1 });
    expect(fleetSummary(world, OTHER)).toMatchObject({ hasActiveContract: false, vehicles: { total: 0, assigned: 0, idle: 0 }, maintenanceDue: 0 });

    const cars = listFleetVehicles(world, EGE, { ...first, status: null, assigned: null });
    expect(cars.items.map((car) => car.plate)).toEqual(["35 FLM 101", "35 FLM 102"]);
    expect(listFleetVehicles(world, EGE, { ...first, status: null, assigned: true }).items.map((car) => car.plate)).toEqual(["35 FLM 101"]);
    expect(listFleetVehicles(world, EGE, { ...first, q: "35flm102", status: null, assigned: null }).total).toBe(1);
    expect(listFleetVehicles(world, EGE, { ...first, q: "egea", status: null, assigned: null }).total).toBe(1);
    expect(listFleetVehicles(world, OTHER, { ...first, status: null, assigned: null }).total).toBe(0);

    // A car by plate, however it is typed; another company's car, or a plate that cannot be one, is not found.
    expect(getFleetVehicle(world, EGE, "35flm101")).toMatchObject({ plate: "35 FLM 101", assignee: { name: "Ayşe Demir" } });
    expect(getFleetVehicle(world, OTHER, "35 FLM 101")).toBeNull();
    expect(getFleetVehicle(world, EGE, "yok")).toBeNull();
    const contract = listFleetContracts(world, EGE, { ...first, status: null }).items[0]!;
    expect(getFleetContract(world, EGE, contract.number)?.vehicles).toHaveLength(2);
    expect(getFleetContract(world, OTHER, contract.number)).toBeNull();
    expect(listFleetContracts(world, OTHER, { ...first, status: null }).total).toBe(0);
  });

  it("gives a car to a person and takes it back; the car has one open assignment at most, and the history is kept", () => {
    const world = "unit-fleet-assign";
    expect(assignFleetVehicle(world, EGE, CAR_102, { employeeId: CANSU, startedAt: "", note: "Yeni" })).toEqual({ status: "ok" });
    expect(getFleetVehicle(world, EGE, "35 FLM 102")).toMatchObject({ assignee: { name: "Cansu Arslan" } });
    expect(getFleetEmployee(world, EGE, CANSU)?.vehicle).toEqual({ plate: "35 FLM 102" });
    // A second person for a car that has someone, and a car that is not the company's, are refused.
    expect(assignFleetVehicle(world, EGE, CAR_102, { employeeId: AYSE, startedAt: "", note: "" })).toEqual({ status: "assigned" });
    expect(assignFleetVehicle(world, OTHER, CAR_102, { employeeId: CANSU, startedAt: "", note: "" })).toEqual({ status: "invalid", fields: { fleetVehicleId: "UNKNOWN_REFERENCE" } });
    expect(assignFleetVehicle(world, EGE, CAR_101, { employeeId: "yok", startedAt: "", note: "" })).toEqual({ status: "invalid", fields: { employeeId: "UNKNOWN_REFERENCE" } });
    // An inactive person is not given a car, and the day cannot be in the future or before the last assignment ended.
    expect(assignFleetVehicle(world, EGE, CAR_102, { employeeId: ILKER, startedAt: "", note: "" })).toEqual({ status: "invalid", fields: { employeeId: "NOT_ALLOWED" } });

    const open = listFleetAssignments(world, EGE, { page: 1, pageSize: 20, vehicle: CAR_102, employee: null, open: true }).items[0]!;
    expect(endFleetAssignment(world, EGE, open.id)).toEqual({ status: "ok" });
    expect(endFleetAssignment(world, EGE, open.id)).toEqual({ status: "not_allowed" });
    expect(endFleetAssignment(world, OTHER, open.id)).toEqual({ status: "not_found" });
    expect(getFleetVehicle(world, EGE, "35 FLM 102")?.assignee).toBeNull();
    // The history of the car: the new one and the old one, newest first.
    expect(getFleetVehicle(world, EGE, "35 FLM 102")?.assignments.map((entry) => entry.employee.name)).toEqual(["Cansu Arslan", "Burak Yılmaz"]);
    expect(assignFleetVehicle(world, EGE, CAR_102, { employeeId: CANSU, startedAt: "2020-01-01", note: "" })).toEqual({ status: "invalid", fields: { startedAt: "OUT_OF_RANGE" } });
    expect(assignFleetVehicle(world, EGE, CAR_102, { employeeId: CANSU, startedAt: "2099-01-01", note: "" })).toEqual({ status: "invalid", fields: { startedAt: "OUT_OF_RANGE" } });
  });

  it("a person who is made inactive gives the car back at once, and cannot be given another; opening them again lets them", () => {
    const world = "unit-fleet-inactive";
    const ayse = getFleetEmployee(world, EGE, AYSE)!;
    expect(getFleetVehicle(world, EGE, "35 FLM 101")?.assignee?.name).toBe("Ayşe Demir");
    const left = setFleetEmployeeActive(world, EGE, AYSE, ayse.updatedAt, false);
    expect(left.status).toBe("ok");
    expect(getFleetVehicle(world, EGE, "35 FLM 101")?.assignee).toBeNull();
    expect(getFleetEmployee(world, EGE, AYSE)).toMatchObject({ active: false, vehicle: null });
    expect(listFleetAssignments(world, EGE, { page: 1, pageSize: 20, vehicle: CAR_101, employee: null, open: true }).total).toBe(0);
    expect(assignFleetVehicle(world, EGE, CAR_101, { employeeId: AYSE, startedAt: "", note: "" })).toEqual({ status: "invalid", fields: { employeeId: "NOT_ALLOWED" } });
    // A stale copy is refused.
    expect(setFleetEmployeeActive(world, EGE, AYSE, ayse.updatedAt, true)).toEqual({ status: "stale" });
    const fresh = getFleetEmployee(world, EGE, AYSE)!;
    expect(setFleetEmployeeActive(world, EGE, AYSE, fresh.updatedAt, true).status).toBe("ok");
    expect(assignFleetVehicle(world, EGE, CAR_101, { employeeId: AYSE, startedAt: "", note: "" })).toEqual({ status: "ok" });
  });

  it("makes and changes a person; a sicil no is one person's in the company, and another company's person is not found", () => {
    const world = "unit-fleet-people";
    const made = createFleetEmployee(world, EGE, { ...EMPTY_EMPLOYEE_FORM, firstName: "Yeni", lastName: "Kişi", employeeNo: "orn-001" });
    expect(made).toEqual({ status: "no_taken" });
    const ok = createFleetEmployee(world, EGE, { ...EMPTY_EMPLOYEE_FORM, firstName: "Yeni", lastName: "Kişi", employeeNo: "ORN-100", email: "Yeni@Example.test" });
    expect(ok.status).toBe("ok");
    if (ok.status !== "ok") return;
    expect(ok.value).toMatchObject({ active: true, vehicle: null, email: "yeni@example.test" });
    expect(listFleetEmployees(world, EGE, { ...first, active: null }).total).toBe(6);
    expect(listFleetEmployees(world, EGE, { ...first, active: false }).items.map((row) => row.lastName)).toEqual(["Polat"]);
    expect(listFleetEmployees(world, EGE, { ...first, q: "SATIŞ", active: null }).total).toBe(2);
    expect(listFleetEmployees(world, OTHER, { ...first, active: null }).total).toBe(0);

    const changed = updateFleetEmployee(world, EGE, ok.value.id, ok.value.updatedAt, { ...EMPTY_EMPLOYEE_FORM, firstName: "Değişen", lastName: "Kişi", employeeNo: "ORN-100" });
    expect(changed.status).toBe("ok");
    expect(updateFleetEmployee(world, EGE, ok.value.id, ok.value.updatedAt, { ...EMPTY_EMPLOYEE_FORM, firstName: "X", lastName: "Y" })).toEqual({ status: "stale" });
    expect(updateFleetEmployee(world, OTHER, ok.value.id, ok.value.updatedAt, { ...EMPTY_EMPLOYEE_FORM, firstName: "X", lastName: "Y" })).toEqual({ status: "not_found" });
  });
});

describe("the messages", () => {
  it("every state of a car, an assignment and a contract has a name in both languages", () => {
    for (const messages of [tr, en]) {
      expect(messages.FleetPanel.vehicles.status.ACTIVE).toBeTruthy();
      expect(messages.FleetPanel.vehicles.status.RETURNED).toBeTruthy();
      expect(messages.FleetPanel.assignments.status.open).toBeTruthy();
      expect(messages.FleetPanel.contracts.status.ENDED).toBeTruthy();
      for (const slug of ["akilli-kurumsal-filo", "yesil-filo", "vip-mobilite", "esnek-kisa-donem"] as const) expect(messages.FleetPanel.contracts.products[slug], slug).toBeTruthy();
    }
  });

  it("the privacy text has a section on corporate customers' staff data, in both languages", () => {
    expect(tr.LegalPrivacy.sections.some((section) => /personel/i.test(section.heading))).toBe(true);
    expect(en.LegalPrivacy.sections.some((section) => /staff/i.test(section.heading))).toBe(true);
  });
});
