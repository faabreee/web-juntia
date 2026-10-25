import type { SessionResponse, TicketTypeRequest } from "@/lib/api";

export type Template = TicketTypeRequest["template"];
export type Scope = TicketTypeRequest["scope"];

/** Plantillas amigables del ADR 0004: solo rellenan los parámetros de la regla de acceso. */
export const TEMPLATES: { id: Template; title: string; description: string }[] = [
  { id: "SINGLE", title: "Entrada única", description: "Un ingreso a una sesión." },
  { id: "MULTI_DAY", title: "Pase por días", description: "Un ingreso por cada día elegido (por ejemplo, un pase de festival)." },
  { id: "N_USES", title: "Pase de N usos", description: "Un número fijo de ingresos que se usan en cualquier sesión." },
  { id: "CUSTOM", title: "Personalizada", description: "Controla cada parámetro de la regla de acceso." },
];

function fractionDigits(currency: string): number {
  return new Intl.NumberFormat("es", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
}

/** "12,50" o "12.50" -> unidad menor de la moneda (1250). Devuelve null si no es un número válido. */
export function priceToMinor(text: string, currency: string): number | null {
  const normalized = text.trim().replace(",", ".");
  if (normalized === "") return 0;
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 10 ** fractionDigits(currency));
}

export function minorToPriceText(minor: number, currency: string): string {
  const digits = fractionDigits(currency);
  return digits === 0 ? String(minor) : (minor / 10 ** digits).toFixed(digits);
}

export function formatPrice(minor: number, currency: string): string {
  if (minor === 0) return "Gratis";
  return new Intl.NumberFormat("es", { style: "currency", currency }).format(minor / 10 ** fractionDigits(currency));
}

type Rule = {
  scope: Scope;
  sessionIds: string[];
  maxTotalUses?: number;
  maxUsesPerSession?: number;
  earlyEntryMinutes?: number;
};

/** Resumen legible de una regla de acceso. */
export function describeAccess(rule: Rule, sessions: Pick<SessionResponse, "id" | "name">[]): string {
  const scope =
    rule.scope === "ALL_SESSIONS"
      ? "Todas las sesiones"
      : rule.sessionIds.length === sessions.length && sessions.length > 1
        ? "Todas las sesiones"
        : sessions.filter((s) => rule.sessionIds.includes(s.id)).map((s) => s.name).join(", ") || "Sin sesiones";
  const total = rule.maxTotalUses == null ? "ingresos ilimitados" : `${rule.maxTotalUses} ${rule.maxTotalUses === 1 ? "ingreso" : "ingresos"} en total`;
  const perSession =
    rule.maxUsesPerSession == null ? "reingreso libre" : rule.maxUsesPerSession === 1 ? "1 por sesión" : `${rule.maxUsesPerSession} por sesión`;
  return `${scope} · ${total} · ${perSession}`;
}
