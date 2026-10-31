"use server";

import { revalidatePath } from "next/cache";
import {
  contractFormSchema,
  readingFormSchema,
  toCreateBody,
  toReadingBody,
  toUpdateBody,
  toVehicleBody,
  vehicleFormSchema,
  type ContractFormMessages,
  type ContractFormValues,
  type ContractSaveResult,
  type FleetContract,
  type FleetReading,
  type FleetVehicle,
  type FleetWriteResult,
  type ReadingFormMessages,
  type ReadingFormValues,
  type VehicleFormMessages,
  type VehicleFormValues,
} from "./admin-contracts";
import { apiRequest, type ApiResult } from "./api-request";
import { isMockMode } from "./mode";
import { mockWorld } from "./mock-world";
import { getSession } from "./session";
import { codeMessages, invalidFields } from "./validation";
import type { ZodError } from "zod";

// The contract and fleet car writes of the panel (V2-35). Each one asks first who is calling: the API checks the role on every call
// anyway (ADR-24), but the sample mode has no API, and an action is a public address, so it is checked here as well. The input is read
// with the same schema as the form (ADR-26); the action only names the fields that failed.
const contractMessages = codeMessages<ContractFormMessages>();
const vehicleMessages = codeMessages<VehicleFormMessages>();
const readingMessages = codeMessages<ReadingFormMessages>();

async function isAdministrator(): Promise<boolean> {
  return (await getSession())?.role === "admin";
}

const failed = (error: ZodError): { status: "invalid"; fields: Record<string, string> } => ({
  status: "invalid",
  fields: Object.fromEntries(invalidFields(error).map((name) => [name, "INVALID_FORMAT"])),
});

const contractPath = (number: string) => "/admin/contracts/" + encodeURIComponent(number);

// An answer of the API, in the words the forms work with.
function contractAnswer(result: ApiResult<FleetContract>): ContractSaveResult {
  switch (result.status) {
    case "ok":
      return { status: "ok", number: result.data.number, updatedAt: result.data.updatedAt };
    case "invalid":
      return { status: "invalid", fields: result.fieldErrors };
    case "not_found":
      return { status: "not_found" };
    case "rate_limited":
      return { status: "rate_limited", retryAfter: result.retryAfter };
    case "conflict":
      if (result.code === "STALE_WRITE") return { status: "stale" };
      if (result.code === "IN_USE") return { status: "in_use", vehicles: result.details?.vehicles ?? 0 };
      return { status: "unavailable" };
    default:
      return { status: "unavailable" };
  }
}

function writeAnswer<T>(result: ApiResult<T>): FleetWriteResult {
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
      if (result.code === "PLATE_TAKEN") return { status: "taken" };
      if (result.code === "STALE_WRITE") return { status: "stale" };
      if (result.code === "INVALID_TRANSITION") return { status: "not_allowed" };
      return { status: "unavailable" };
    default:
      return { status: "unavailable" };
  }
}

// A sample-mode answer, in the same words.
type Mock<T> =
  | { status: "ok"; value: T }
  | { status: "stale" | "not_found" | "taken" | "not_allowed" }
  | { status: "in_use"; vehicles: number }
  | { status: "invalid"; fields: Record<string, string> };

function mockContract(outcome: Mock<FleetContract>): ContractSaveResult {
  switch (outcome.status) {
    case "ok":
      return { status: "ok", number: outcome.value.number, updatedAt: outcome.value.updatedAt };
    case "invalid":
    case "in_use":
      return outcome;
    case "stale":
    case "not_found":
      return { status: outcome.status };
    default:
      return { status: "unavailable" };
  }
}

function mockWrite<T>(outcome: Mock<T>): FleetWriteResult {
  switch (outcome.status) {
    case "ok":
      return { status: "ok" };
    case "invalid":
      return outcome;
    case "stale":
    case "not_found":
    case "taken":
    case "not_allowed":
      return { status: outcome.status };
    default:
      return { status: "unavailable" };
  }
}

export async function createContract(companyId: string, input: ContractFormValues): Promise<ContractSaveResult> {
  if (!(await isAdministrator())) return { status: "not_found" };
  const parsed = contractFormSchema(contractMessages).safeParse(input);
  if (!parsed.success) return failed(parsed.error);
  const values = parsed.data as ContractFormValues;

  const result = isMockMode()
    ? mockContract((await import("@/mocks/admin-contracts")).createMockContract(await mockWorld(), companyId, values))
    : contractAnswer(await apiRequest<FleetContract>("POST", "/admin/companies/" + encodeURIComponent(companyId) + "/contracts", toCreateBody(values)));
  if (result.status === "ok") revalidatePath("/", "layout");
  return result;
}

// `initial` is what the form was opened with, so only what the person changed is sent; `updatedAt` is the version it was opened at (the
// API answers STALE_WRITE if the contract moved on since).
export async function updateContract(number: string, updatedAt: string, input: ContractFormValues, initial: ContractFormValues): Promise<ContractSaveResult> {
  if (!(await isAdministrator())) return { status: "not_found" };
  const schema = contractFormSchema(contractMessages);
  const values = schema.safeParse(input);
  const before = schema.safeParse(initial);
  if (!values.success) return failed(values.error);
  if (!before.success) return { status: "unavailable" };

  const result = isMockMode()
    ? mockContract((await import("@/mocks/admin-contracts")).updateMockContract(await mockWorld(), number, updatedAt, values.data as ContractFormValues))
    : contractAnswer(await apiRequest<FleetContract>("PATCH", contractPath(number), toUpdateBody(values.data as ContractFormValues, before.data as ContractFormValues, updatedAt)));
  if (result.status === "ok") revalidatePath("/", "layout");
  return result;
}

export async function addFleetVehicle(number: string, input: VehicleFormValues): Promise<FleetWriteResult> {
  if (!(await isAdministrator())) return { status: "not_found" };
  const parsed = vehicleFormSchema(vehicleMessages).safeParse(input);
  if (!parsed.success) return failed(parsed.error);
  const values = parsed.data as VehicleFormValues;

  const result = isMockMode()
    ? mockWrite((await import("@/mocks/admin-contracts")).createMockCar(await mockWorld(), number, values))
    : writeAnswer(await apiRequest<FleetVehicle>("POST", contractPath(number) + "/vehicles", toVehicleBody(values)));
  if (result.status === "ok") revalidatePath("/", "layout");
  return result;
}

// Giving the car back. The version is the one the screen read, so a car changed in the meantime (a reading is not a change of the car)
// is not given back by a stale screen.
export async function returnFleetVehicle(id: string, updatedAt: string): Promise<FleetWriteResult> {
  if (!(await isAdministrator())) return { status: "not_found" };
  const result = isMockMode()
    ? mockWrite((await import("@/mocks/admin-contracts")).returnMockCar(await mockWorld(), id, updatedAt))
    : writeAnswer(await apiRequest<FleetVehicle>("PATCH", "/admin/fleet-vehicles/" + encodeURIComponent(id), { updatedAt, returned: true }));
  if (result.status === "ok") revalidatePath("/", "layout");
  return result;
}

export async function addReading(id: string, input: ReadingFormValues): Promise<FleetWriteResult> {
  if (!(await isAdministrator())) return { status: "not_found" };
  const parsed = readingFormSchema(readingMessages).safeParse(input);
  if (!parsed.success) return failed(parsed.error);
  const values = parsed.data as ReadingFormValues;

  const result = isMockMode()
    ? mockWrite<FleetReading>((await import("@/mocks/admin-contracts")).addMockReading(await mockWorld(), id, values))
    : writeAnswer(await apiRequest<FleetReading>("POST", "/admin/fleet-vehicles/" + encodeURIComponent(id) + "/readings", toReadingBody(values)));
  if (result.status === "ok") revalidatePath("/", "layout");
  return result;
}
