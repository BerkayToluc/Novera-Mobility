import { randomInt } from 'node:crypto';

// A plate for a test car: a good Turkish plate ("34 KRT 4821", the form the database holds since V2-30) that no other test car
// has. The suites share one database and run at the same time, so a plate is chosen at random from about 80 million, and one
// that this process already handed out is never given twice.
const LETTERS = 'ABCDEFGHJKLMNPRSTUVYZ';
const handedOut = new Set<string>();

export function testPlate(): string {
  for (;;) {
    const letters = Array.from({ length: 3 }, () => LETTERS[randomInt(LETTERS.length)]).join('');
    const plate = `34 ${letters} ${randomInt(1000, 10000)}`;
    if (!handedOut.has(plate)) {
      handedOut.add(plate);
      return plate;
    }
  }
}
