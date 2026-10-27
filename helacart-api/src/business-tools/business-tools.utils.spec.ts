import {
  csvDocument,
  reportRange,
  safeNumber,
  stockCsv,
  sumReportIntegers,
} from './business-tools.utils.js';
describe('Stock CSV import and reporting boundaries', () => {
  it('preserves exact cents when large positive and negative journal entries cancel', () => {
    expect(sumReportIntegers([9007199254740991, 2, -9007199254740991])).toBe(2);
  });
  it('rejects combined report totals outside the safe range', () => {
    expect(() => sumReportIntegers([9007199254740991, 1])).toThrow();
  });
  it('reads a BOM, quoted CSV, CRLF, and zero physical quantities', () => {
    expect(
      stockCsv('\uFEFF"sku","on_hand"\r\n"SHIRT-BLUE","25"\r\nBAG_001,0\r\n'),
    ).toEqual([
      { row: 2, sku: 'SHIRT-BLUE', onHand: 25 },
      { row: 3, sku: 'BAG_001', onHand: 0 },
    ]);
  });
  it.each([
    'sku,on_hand\nA-1,-1',
    'sku,on_hand\nA-1,1.5',
    'sku,on_hand\nA-1,1e3',
    'sku,on_hand\nA-1,1000000001',
    'sku,on_hand\nA-1,1,2',
    'sku,on_hand\nA-1,1\nA-1,2',
    'sku,on_hand\n"A-1,2',
    'sku,on_hand\n"A-1"bad,2',
    'sku,price\nA-1,100',
    'sku,on_hand\n=FORMULA,2',
    'sku,on_hand\nA-1,+2',
    'sku,on_hand\nA-1,01',
    'sku,on_hand\nA-1,',
    'sku,on_hand',
  ])('rejects ambiguous or unsafe stock input %s', (csv) => {
    expect(() => stockCsv(csv)).toThrow();
  });
  it('bounds stock changes to 500 rows before touching a database', () => {
    expect(() =>
      stockCsv(
        'sku,on_hand\n' +
          Array.from({ length: 501 }, (_, i) => `SKU-${i},1`).join('\n'),
      ),
    ).toThrow('500');
  });
  it('escapes spreadsheet formulas in text without changing numeric amounts', () => {
    expect(csvDocument([[' =1+1', '@SUM(A1)', 'x,"y"', -50, 25]])).toBe(
      '\uFEFF"\' =1+1","\'@SUM(A1)","x,""y""","-50","25"',
    );
  });
  it('uses inclusive Sri Lanka days and handles leap years', () => {
    const r = reportRange('2024-02-28', '2024-03-01');
    expect(r.start.toISOString()).toBe('2024-02-27T18:30:00.000Z');
    expect(r.end.toISOString()).toBe('2024-03-01T18:30:00.000Z');
    expect(r.days).toBe(3);
    expect(reportRange('2024-01-01', '2024-12-31').days).toBe(366);
  });
  it.each([
    ['2026-02-30', '2026-03-01'],
    ['2026-03-02', '2026-03-01'],
    ['2025-01-01', '2026-01-02'],
    ['0000-01-01', '0000-01-01'],
    ['2026-2-01', '2026-03-01'],
  ])('rejects invalid report range %s to %s', (from, to) => {
    expect(() => reportRange(from, to)).toThrow();
  });
  it('refuses unsafe numeric report totals', () => {
    expect(safeNumber(100n)).toBe(100);
    expect(safeNumber(null)).toBe(0);
    expect(() => safeNumber(9007199254740992n)).toThrow();
  });
});
