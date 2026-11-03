/** A short, log-safe description of an unknown error (no stack, bounded size). */
export function describeError(error: unknown): string {
  if (error instanceof Error) {
    const code = (error as { code?: unknown }).code;
    const text = `${error.name}${typeof code === 'string' ? ` [${code}]` : ''}: ${error.message}`;
    return redact(text).slice(0, 500);
  }
  return redact(String(error)).slice(0, 500);
}

/** Removes credentials embedded in connection strings or bearer headers. */
export function redact(text: string): string {
  return text
    .replace(/(postgres(?:ql)?:\/\/)[^@\s]+@/gi, '$1***@')
    .replace(/(bearer\s+)[A-Za-z0-9._-]+/gi, '$1***');
}
