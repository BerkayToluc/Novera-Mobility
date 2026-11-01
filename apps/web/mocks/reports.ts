import { buildReport, type FleetReport } from "@/lib/report-calc";
import { getMockCarReadings, listMockCompanyCars } from "./admin-contracts";
import { listMockExpenses } from "./expenses";
import { assignmentSpans } from "./fleet-panel";
import { listMockInvoices } from "./invoices";

// The sample report (USE_MOCKS=1, local work and tests only, lib/mode.ts): built from the sample company's own invoices, expenses, cars
// and assignments by the same rules as the API's, so what the report says adds up to those screens to the kuruş.
export function sampleReport(world: string, companyId: string, from: string, to: string, now = Date.now()): FleetReport {
  const spans = assignmentSpans(world, companyId);
  const everything = { page: 1, pageSize: 1000, sort: null, type: null, status: null } as const;
  return buildReport({
    from,
    to,
    now,
    vehicles: listMockCompanyCars(world, companyId).map((car) => ({
      id: car.id,
      plate: car.plate,
      model: `${car.model.brand} ${car.model.model}`,
      contractNumber: car.contract.number,
      startKm: car.startKm,
      readings: getMockCarReadings(world, car.id).map((reading) => ({ at: reading.at, km: reading.km })),
      spans: spans.filter((span) => span.vehicleId === car.id).map((span) => ({ employeeId: span.employeeId, department: span.department, startedAt: span.startedAt, endedAt: span.endedAt })),
    })),
    invoices: listMockInvoices(world, { page: 1, pageSize: 1000, sort: null, q: "", status: null }, companyId).items.map((invoice) => ({ period: invoice.period, lines: invoice.lines.map((line) => ({ contractNumber: line.contractNumber, amount: line.amount })) })),
    expenses: listMockExpenses(world, everything, companyId).items.map((expense) => ({ vehicleId: expense.vehicle.id, occurredAt: expense.occurredAt, amount: expense.amount })),
  });
}
