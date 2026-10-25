// Utilidades de fechas en una zona horaria IANA concreta, sin dependencias.

const PART_OPTIONS: Intl.DateTimeFormatOptions = {
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
};

function zonedParts(ts: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { ...PART_OPTIONS, timeZone }).formatToParts(new Date(ts));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { y: get("year"), mo: get("month"), d: get("day"), h: get("hour"), mi: get("minute"), s: get("second") };
}

/** Diferencia (ms) entre la hora "de pared" de la zona y UTC en el instante dado. */
function offsetMs(ts: number, timeZone: string) {
  const p = zonedParts(ts, timeZone);
  return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - Math.floor(ts / 1000) * 1000;
}

/** "2027-03-05T20:00" interpretado en `timeZone` -> instante ISO (UTC). */
export function zonedLocalToInstant(local: string, timeZone: string): string {
  const [date, time] = local.split("T");
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  let ts = wall;
  for (let i = 0; i < 2; i++) ts = wall - offsetMs(ts, timeZone);
  return new Date(ts).toISOString();
}

/** Instante ISO -> "YYYY-MM-DDTHH:mm" en `timeZone` (formato de <input type="datetime-local">). */
export function instantToZonedLocal(iso: string, timeZone: string): string {
  const p = zonedParts(new Date(iso).getTime(), timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.y}-${pad(p.mo)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}`;
}

export function formatInZone(iso: string, timeZone: string, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("es", options ?? { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(iso));
}

export function formatRange(startIso: string, endIso: string, timeZone: string): string {
  const day = new Intl.DateTimeFormat("es", { dateStyle: "full", timeZone });
  const time = new Intl.DateTimeFormat("es", { timeStyle: "short", timeZone });
  const sameDay = day.format(new Date(startIso)) === day.format(new Date(endIso));
  return sameDay
    ? `${day.format(new Date(startIso))}, ${time.format(new Date(startIso))} – ${time.format(new Date(endIso))}`
    : `${day.format(new Date(startIso))} ${time.format(new Date(startIso))} – ${day.format(new Date(endIso))} ${time.format(new Date(endIso))}`;
}
