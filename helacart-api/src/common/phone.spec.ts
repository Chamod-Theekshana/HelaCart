import { normalizeSriLankanMobile } from './phone.js';

describe('Sri Lankan mobile number normalisation', () => {
  it.each([
    ['0771234567', '+94771234567'],
    ['771234567', '+94771234567'],
    ['94771234567', '+94771234567'],
    ['+94771234567', '+94771234567'],
    ['+94 77 123 4567', '+94771234567'],
    ['077-123-4567', '+94771234567'],
    ['(077) 1234567', '+94771234567'],
  ])('normalises %s', (input, expected) => {
    expect(normalizeSriLankanMobile(input)).toBe(expected);
  });

  it.each([
    '0112345678',
    '+94112345678',
    '07712345',
    '077123456789',
    '+447700900123',
    '0771234567x',
    '',
    undefined,
    12345,
  ])('rejects %s', (input) => {
    expect(normalizeSriLankanMobile(input)).toBeNull();
  });
});
