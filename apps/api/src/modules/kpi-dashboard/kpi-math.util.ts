export function resolveDashboardRange(input?: { from?: Date; to?: Date }): {
  from: Date;
  to: Date;
} {
  const now = new Date();
  const to = input?.to ?? now;

  if (input?.from) {
    return { from: input.from, to };
  }

  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 29);
  from.setUTCHours(0, 0, 0, 0);

  return { from, to };
}

export function normalizeDateOnly(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

export function businessDaysBetweenInclusive(from: Date, to: Date): number {
  const start = normalizeDateOnly(from);
  const end = normalizeDateOnly(to);

  if (start > end) {
    return 0;
  }

  const cursor = new Date(start);
  let days = 0;

  while (cursor <= end) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) {
      days += 1;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return days;
}

export function ratioOrNull(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(denominator) || denominator <= 0) {
    return null;
  }

  return Number((numerator / denominator).toFixed(4));
}

export function roundNumber(input: number): number {
  return Number(input.toFixed(2));
}

export function daysDiffFloor(from: Date, to: Date): number {
  const diffMs = to.getTime() - from.getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  if (diffMs <= 0) {
    return 0;
  }
  return Math.floor(diffMs / dayMs);
}
