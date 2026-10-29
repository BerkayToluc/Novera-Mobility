import { consumptionUnitOf, isElectric, slugOf } from './vehicle-models.view.js';

describe('the address of a model from its name (V2-29)', () => {
  it('is lower case words joined by hyphens', () => {
    expect(slugOf('Renault', 'Clio')).toBe('renault-clio');
    expect(slugOf('Toyota', 'Corolla Hybrid')).toBe('toyota-corolla-hybrid');
    expect(slugOf('Mercedes-Benz', 'E-Serisi')).toBe('mercedes-benz-e-serisi');
  });

  it('turns the Turkish letters into plain ones, the dotted and the dotless I alike', () => {
    expect(slugOf('Çelik', 'Şahin Ğ')).toBe('celik-sahin-g');
    expect(slugOf('İzmir', 'ISPARTA ılık')).toBe('izmir-isparta-ilik');
  });

  it('drops what is not a letter or a digit, and does not start or end with a hyphen', () => {
    expect(slugOf('  BMW ', '5 Serisi (G30)!')).toBe('bmw-5-serisi-g30');
    expect(slugOf('---', '???')).toBe('');
  });
});

describe('what a consumption is measured in (V2-29)', () => {
  it('an electric car in kWh, every other car in litres', () => {
    expect(consumptionUnitOf('ELECTRIC')).toBe('KWH_PER_100KM');
    for (const fuel of ['PETROL', 'DIESEL', 'HYBRID'] as const) expect(consumptionUnitOf(fuel)).toBe('L_PER_100KM');
  });

  it('knows which fuel is electric', () => {
    expect(isElectric('ELECTRIC')).toBe(true);
    expect(isElectric('HYBRID')).toBe(false);
  });
});
