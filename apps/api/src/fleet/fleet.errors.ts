import { HttpException, HttpStatus } from '@nestjs/common';

// A record of the fleet that is not there, or is another company's: the same answer for both, so the answer says nothing about
// what other companies have (ADR-25).
export function fleetNotFound(what: string): HttpException {
  return new HttpException({ code: 'NOT_FOUND', message: `${what} not found` }, HttpStatus.NOT_FOUND);
}

// The car has an assignment that is still open (FLEET.md §4.1). Nothing was written. The service checks first, and the database holds
// the rule as well when two requests arrive together.
export function vehicleAssigned(): HttpException {
  return new HttpException(
    { code: 'VEHICLE_ASSIGNED', message: 'The vehicle is assigned to someone already; end that assignment first' },
    HttpStatus.CONFLICT,
  );
}

// The same sicil no is on another person of the company.
export function employeeNoTaken(): HttpException {
  return new HttpException(
    { code: 'EMPLOYEE_NO_TAKEN', message: 'Another employee of the company has this number', fieldErrors: { employeeNo: 'EMPLOYEE_NO_TAKEN' } },
    HttpStatus.CONFLICT,
  );
}

// A renewal of this contract is waiting already: asking again would only fill the quote list of the administration with copies. Nothing was
// written.
export function renewalAlreadyRequested(): HttpException {
  return new HttpException(
    { code: 'ALREADY_REQUESTED', message: 'A renewal request for this contract is being handled already' },
    HttpStatus.CONFLICT,
  );
}
