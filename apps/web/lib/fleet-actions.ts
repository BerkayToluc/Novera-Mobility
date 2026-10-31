"use server";

import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";
import { apiRequest, type ApiResult } from "./api-request";
import {
  assignFormSchema,
  employeeFormSchema,
  toAssignBody,
  toEmployeeCreateBody,
  toEmployeeUpdateBody,
  type AssignFormMessages,
  type AssignFormValues,
  type AssignmentResult,
  type EmployeeFormMessages,
  type EmployeeFormValues,
  type EmployeeSaveResult,
  type FleetAssignment,
  type FleetEmployee,
} from "./fleet-panel";
import { isMockMode } from "./mode";
import { mockWorld } from "./mock-world";
import { getSession } from "./session";
import { codeMessages, invalidFields } from "./validation";

// The writes of the Filom screens (V2-36): the people and the assignments. Each one asks first who is calling: the API checks the account
// and the company on every call anyway (CompanyGuard, ADR-25), but the sample mode has no API, and an action is a public address, so it
// is checked here as well. The input is read with the same schema as the form (ADR-26); the action only names the fields that failed.
const employeeMessages = codeMessages<EmployeeFormMessages>();
const assignMessages = codeMessages<AssignFormMessages>();

// The company of the signed-in corporate account that has a fleet, or null: anyone else is turned away as if the page did not exist.
async function companyOfCaller(): Promise<{ id: string } | null> {
  const session = await getSession();
  if (!session || session.type !== "corporate" || session.role !== "customer" || !session.hasFleet) return null;
  return { id: session.company?.id ?? "none" };
}

const failed = (error: ZodError): { status: "invalid"; fields: Record<string, string> } => ({
  status: "invalid",
  fields: Object.fromEntries(invalidFields(error).map((name) => [name, "INVALID_FORMAT"])),
});

function employeeAnswer(result: ApiResult<FleetEmployee>): EmployeeSaveResult {
  switch (result.status) {
    case "ok":
      return { status: "ok", id: result.data.id, updatedAt: result.data.updatedAt };
    case "invalid":
      return { status: "invalid", fields: result.fieldErrors };
    case "not_found":
      return { status: "not_found" };
    case "rate_limited":
      return { status: "rate_limited", retryAfter: result.retryAfter };
    case "conflict":
      if (result.code === "STALE_WRITE") return { status: "stale" };
      if (result.code === "EMPLOYEE_NO_TAKEN") return { status: "no_taken" };
      return { status: "unavailable" };
    default:
      return { status: "unavailable" };
  }
}

function assignmentAnswer(result: ApiResult<FleetAssignment>): AssignmentResult {
  switch (result.status) {
    case "ok":
      return { status: "ok" };
    case "invalid":
      return { status: "invalid", fields: result.fieldErrors };
    case "not_found":
      return { status: "not_found" };
    case "rate_limited":
      return { status: "rate_limited", retryAfter: result.retryAfter };
    case "conflict":
      if (result.code === "VEHICLE_ASSIGNED") return { status: "assigned" };
      if (result.code === "INVALID_TRANSITION") return { status: "not_allowed" };
      return { status: "unavailable" };
    default:
      return { status: "unavailable" };
  }
}

type EmployeeMock = { status: "ok"; value: FleetEmployee } | { status: "stale" | "not_found" | "no_taken" };
const mockEmployee = (outcome: EmployeeMock): EmployeeSaveResult => (outcome.status === "ok" ? { status: "ok", id: outcome.value.id, updatedAt: outcome.value.updatedAt } : { status: outcome.status });

const refresh = <T extends { status: string }>(result: T): T => {
  if (result.status === "ok") revalidatePath("/", "layout");
  return result;
};

export async function createEmployee(input: EmployeeFormValues): Promise<EmployeeSaveResult> {
  const company = await companyOfCaller();
  if (!company) return { status: "not_found" };
  const parsed = employeeFormSchema(employeeMessages).safeParse(input);
  if (!parsed.success) return failed(parsed.error);
  const values = parsed.data as EmployeeFormValues;
  return refresh(
    isMockMode()
      ? mockEmployee((await import("@/mocks/fleet-panel")).createFleetEmployee(await mockWorld(), company.id, values))
      : employeeAnswer(await apiRequest<FleetEmployee>("POST", "/fleet/employees", toEmployeeCreateBody(values))),
  );
}

// `initial` is what the form was opened with, so only what the person changed is sent; `updatedAt` is the version it was opened at (the API
// answers STALE_WRITE if the person moved on since).
export async function updateEmployee(id: string, updatedAt: string, input: EmployeeFormValues, initial: EmployeeFormValues): Promise<EmployeeSaveResult> {
  const company = await companyOfCaller();
  if (!company) return { status: "not_found" };
  const schema = employeeFormSchema(employeeMessages);
  const values = schema.safeParse(input);
  const before = schema.safeParse(initial);
  if (!values.success) return failed(values.error);
  if (!before.success) return { status: "unavailable" };
  return refresh(
    isMockMode()
      ? mockEmployee((await import("@/mocks/fleet-panel")).updateFleetEmployee(await mockWorld(), company.id, id, updatedAt, values.data as EmployeeFormValues))
      : employeeAnswer(await apiRequest<FleetEmployee>("PATCH", "/fleet/employees/" + encodeURIComponent(id), toEmployeeUpdateBody(values.data as EmployeeFormValues, before.data as EmployeeFormValues, updatedAt))),
  );
}

// A person who leaves is made inactive, and the car they have comes back at once (the API ends the assignment in the same step).
export async function setEmployeeActive(id: string, updatedAt: string, active: boolean): Promise<EmployeeSaveResult> {
  const company = await companyOfCaller();
  if (!company) return { status: "not_found" };
  return refresh(
    isMockMode()
      ? mockEmployee((await import("@/mocks/fleet-panel")).setFleetEmployeeActive(await mockWorld(), company.id, id, updatedAt, active))
      : employeeAnswer(await apiRequest<FleetEmployee>("PATCH", "/fleet/employees/" + encodeURIComponent(id), { updatedAt, active })),
  );
}

export async function assignVehicle(vehicleId: string, input: AssignFormValues): Promise<AssignmentResult> {
  const company = await companyOfCaller();
  if (!company) return { status: "not_found" };
  const parsed = assignFormSchema(assignMessages).safeParse(input);
  if (!parsed.success) return failed(parsed.error);
  const values = parsed.data as AssignFormValues;
  return refresh(
    isMockMode()
      ? (await import("@/mocks/fleet-panel")).assignFleetVehicle(await mockWorld(), company.id, vehicleId, values)
      : assignmentAnswer(await apiRequest<FleetAssignment>("POST", "/fleet/assignments", toAssignBody(vehicleId, values))),
  );
}

export async function endAssignment(id: string): Promise<AssignmentResult> {
  const company = await companyOfCaller();
  if (!company) return { status: "not_found" };
  return refresh(
    isMockMode()
      ? (await import("@/mocks/fleet-panel")).endFleetAssignment(await mockWorld(), company.id, id)
      : assignmentAnswer(await apiRequest<FleetAssignment>("POST", "/fleet/assignments/" + encodeURIComponent(id) + "/end", {})),
  );
}
