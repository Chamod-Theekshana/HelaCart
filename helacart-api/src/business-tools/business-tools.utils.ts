import { BadRequestException } from '@nestjs/common';
export function stockCsv(input: string) {
  const source = input.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [],
    field = '',
    quoted = false,
    closed = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (quoted) {
      if (c === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else field += c;
      continue;
    }
    if (c === '"') {
      if (field || closed) throw new BadRequestException('Invalid CSV quoting');
      quoted = true;
      continue;
    }
    if (c === ',' || c === '\n' || c === '\r') {
      row.push(field);
      field = '';
      closed = false;
      if (c !== ',') {
        if (c === '\r' && source[i + 1] === '\n') i++;
        if (row.some((v) => v.trim())) rows.push(row);
        row = [];
      }
      if (rows.length > 501)
        throw new BadRequestException(
          'Import at most 500 stock rows at a time',
        );
      continue;
    }
    if (closed && c !== ' ' && c !== '\t')
      throw new BadRequestException('Invalid CSV content after a quoted field');
    if (!closed) field += c;
  }
  if (quoted)
    throw new BadRequestException('CSV contains an unclosed quoted field');
  row.push(field);
  if (row.some((v) => v.trim())) rows.push(row);
  const header = rows.shift()?.map((v) => v.trim().toLowerCase());
  if (
    !header ||
    header.length !== 2 ||
    header[0] !== 'sku' ||
    header[1] !== 'on_hand'
  )
    throw new BadRequestException(
      'CSV needs exactly these columns: sku,on_hand',
    );
  if (!rows.length || rows.length > 500)
    throw new BadRequestException('Import 1 to 500 stock rows at a time');
  const seen = new Set<string>();
  return rows.map((values, i) => {
    const sku = values[0]?.trim(),
      value = values[1]?.trim();
    if (
      values.length !== 2 ||
      !sku ||
      !/^[A-Z0-9]+(?:[-_][A-Z0-9]+)*$/.test(sku) ||
      sku.length > 64 ||
      !value ||
      !/^(0|[1-9]\d*)$/.test(value) ||
      Number(value) > 1000000000
    )
      throw new BadRequestException(
        `CSV row ${i + 2}: use a valid SKU and a whole on_hand quantity between 0 and 1000000000`,
      );
    if (seen.has(sku))
      throw new BadRequestException(`CSV row ${i + 2}: duplicate SKU ${sku}`);
    seen.add(sku);
    return { row: i + 2, sku, onHand: Number(value) };
  });
}
export function csvDocument(rows: (string | number | null | undefined)[][]) {
  return (
    '\uFEFF' +
    rows
      .map((row) =>
        row
          .map((value) => {
            let s = String(value ?? '');
            if (typeof value === 'string' && /^[\s]*[=+\-@]/.test(s))
              s = "'" + s;
            return '"' + s.replaceAll('"', '""') + '"';
          })
          .join(','),
      )
      .join('\r\n')
  );
}
export function reportRange(from: string, to: string) {
  const valid = (value: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number(value.slice(0, 4)) >= 2000 &&
    Number(value.slice(0, 4)) <= 2100 &&
    Number.isFinite(Date.parse(value + 'T00:00:00Z')) &&
    new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
  if (!valid(from) || !valid(to) || from > to)
    throw new BadRequestException(
      'Use a valid date range with the start on or before the end',
    );
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
  if (days > 366)
    throw new BadRequestException('Choose a report period of at most 366 days');
  return {
    from,
    to,
    start: new Date(from + 'T00:00:00+05:30'),
    end: new Date(new Date(to + 'T00:00:00+05:30').getTime() + 86400000),
    days,
  };
}
export function safeNumber(value: unknown) {
  const result = Number(value ?? 0);
  if (!Number.isSafeInteger(result))
    throw new Error('Report amount exceeds the supported safe range');
  return result;
}
export function sumReportIntegers(values: Iterable<number>) {
  return safeNumber(
    Array.from(values).reduce((sum, value) => sum + BigInt(value), 0n),
  );
}
