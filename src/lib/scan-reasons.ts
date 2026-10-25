/** Motivos de rechazo de una lectura (ADR 0004 y 0010) en el lenguaje del personal de puerta. */
export const REASON_TEXT: Record<string, { title: string; detail?: string }> = {
  SESSION_NOT_INCLUDED: { title: "Esta sesión no está incluida", detail: "El boleto no da acceso a esta sesión." },
  TOO_EARLY: { title: "Todavía es pronto", detail: "La puerta de esta sesión aún no abre para este boleto." },
  SESSION_ENDED: { title: "La sesión ya terminó" },
  TOTAL_USES_EXHAUSTED: { title: "Ya usó todos sus ingresos" },
  ALREADY_USED_IN_SESSION: { title: "Ya ingresó a esta sesión" },
  INVALID_TOKEN: { title: "Código no válido", detail: "No es un boleto de Juntia o fue alterado." },
  INVALID_CODE: { title: "Código mal escrito", detail: "Revisa las 8 letras y números." },
  WRONG_EVENT: { title: "Boleto de otro evento" },
  TICKET_NOT_FOUND: { title: "Boleto no encontrado" },
  TICKET_VOID: { title: "Boleto anulado", detail: "La compra fue reembolsada." },
  EVENT_NOT_ACTIVE: { title: "El evento no está activo" },
};

export function reasonText(reason: string | undefined) {
  return REASON_TEXT[reason ?? ""] ?? { title: "Rechazado", detail: reason };
}
