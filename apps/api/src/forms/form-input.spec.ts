import { isSpam } from './form-input.js';

// Veritabanı gerektirmeyen birim testleri: her ortamda ve CI'da çalışır.

describe('isSpam (tuzak alan)', () => {
  it.each([[{}], [{ website: '' }], [{ website: '   ' }], [{ website: null }], [{ website: undefined }]])(
    'boş tuzak alan spam değildir: %p',
    (input) => {
      expect(isSpam(input)).toBe(false);
    },
  );

  it.each([[{ website: 'http://spam.example' }], [{ website: 'x' }], [{ website: 1 }], [{ website: true }], [{ website: {} }]])(
    'dolu tuzak alan spamdır: %p',
    (input) => {
      expect(isSpam(input)).toBe(true);
    },
  );
});
