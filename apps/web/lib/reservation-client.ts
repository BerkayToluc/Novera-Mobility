import "server-only";
import type { BookingData } from "./booking-data";
import { ApiUnavailableError } from "./fleet-client";

// `POST /reservations` does not exist yet (BACKLOG #22). With USE_MOCKS=1 this invents a
// booking number so the flow can be walked through and nothing is stored; without it, it
// says so instead of pretending a reservation was made. When the API lands, only this file
// changes: it sends the car, the dates, the extras and the chosen currency, and returns the
// number the backend issued.
export async function createReservation(data: BookingData): Promise<{ number: string }> {
  void data;
  if (process.env.USE_MOCKS === "1") {
    const serial = String(Math.floor(Math.random() * 100000)).padStart(5, "0");
    return { number: `NVR-${new Date().getFullYear()}-${serial}` };
  }
  throw new ApiUnavailableError();
}
