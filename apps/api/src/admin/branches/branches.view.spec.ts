import { PROVINCES, isProvince } from '../../common/provinces.js';
import { fold, isValidDay } from './branches.view.js';

describe('opening hours of a day (V2-27)', () => {
  it('accepts an opening time before a closing time, and the word closed', () => {
    for (const day of ['08:30-19:00', '00:00-23:59', '07:00-23:00', 'closed']) expect(isValidDay(day)).toBe(true);
  });

  it('refuses a closing time that is not after the opening, or a time that is not a time', () => {
    for (const day of ['19:00-08:30', '09:00-09:00', '24:00-25:00', '8:30-19:00', '08:30–19:00', '08:60-19:00', '', 'Closed', 'kapalı', '08:30']) {
      expect(isValidDay(day)).toBe(false);
    }
  });
});

describe('the provinces (V2-27)', () => {
  it('are the 81 of Türkiye, each once, and the spelling the web offers', () => {
    expect(PROVINCES).toHaveLength(81);
    expect(new Set(PROVINCES).size).toBe(81);
    expect(isProvince('İstanbul')).toBe(true);
    expect(isProvince('Istanbul')).toBe(false);
    expect(isProvince('')).toBe(false);
  });
});

describe('searching by hand (V2-27)', () => {
  it('ignores case and Turkish letters, so what is typed on a plain keyboard finds the branch', () => {
    expect(fold('İzmir Adnan Menderes Havalimanı')).toBe('izmir adnan menderes havalimani');
    expect(fold('Şişli')).toBe('sisli');
    expect(fold('  DİYARBAKIR  ')).toBe('diyarbakir');
    expect(fold('Kadıköy')).toBe(fold('KADIKOY'));
  });
});
