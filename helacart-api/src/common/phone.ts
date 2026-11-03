/**
 * Normalises a Sri Lankan mobile number to E.164 (`+947XXXXXXXX`). Accepts
 * `07XXXXXXXX`, `7XXXXXXXX`, `947XXXXXXXX` and `+947XXXXXXXX`, ignoring spaces,
 * hyphens, dots and parentheses. Landlines and foreign numbers return null.
 */
export function normalizeSriLankanMobile(input: unknown): string | null {
  if (typeof input !== 'string' || input.length > 30) return null;
  const compact = input.trim().replace(/[\s().-]/g, '');
  const match = /^(?:\+94|94|0)?(7\d{8})$/.exec(compact);
  return match ? `+94${match[1]}` : null;
}
