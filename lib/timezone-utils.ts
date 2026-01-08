export function getBrowserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function resolveTimeZone(
  settings?: { timezone?: string | null } | null,
  browserTimeZone?: string
): string {
  const resolvedBrowserTimeZone = browserTimeZone ?? getBrowserTimeZone();

  if (!settings?.timezone) return resolvedBrowserTimeZone;
  if (settings.timezone === 'UTC' && resolvedBrowserTimeZone !== 'UTC') {
    return resolvedBrowserTimeZone;
  }
  return settings.timezone;
}

export function toZonedDateTime(date: Date, timeZone: string) {
  return Temporal.Instant.from(date.toISOString()).toZonedDateTimeISO(timeZone);
}
