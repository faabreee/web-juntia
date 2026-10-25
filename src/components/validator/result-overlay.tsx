"use client";

import { useEffect } from "react";

import { reasonText } from "@/lib/scan-reasons";
import type { ScanResponse } from "@/lib/api";

export type ScanFeedback =
  | { kind: "result"; data: ScanResponse }
  | { kind: "error"; message: string; retry?: () => void };

const SHOW_MS = { accepted: 2200, rejected: 6000 };

function time(iso: string) {
  return new Intl.DateTimeFormat("es", { timeStyle: "short" }).format(new Date(iso));
}

/** Respuesta inmediata a pantalla completa: verde = adelante, rojo = no pasa (con el motivo), naranja = sin respuesta. */
export function ResultOverlay({ feedback, onDismiss }: { feedback: ScanFeedback; onDismiss: () => void }) {
  const accepted = feedback.kind === "result" && feedback.data.result === "ACCEPTED";

  useEffect(() => {
    if (feedback.kind === "error") return;
    const id = setTimeout(onDismiss, accepted ? SHOW_MS.accepted : SHOW_MS.rejected);
    return () => clearTimeout(id);
  }, [feedback, accepted, onDismiss]);

  if (feedback.kind === "error") {
    return (
      <div role="alertdialog" aria-live="assertive" className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-amber-500 p-6 text-center text-black">
        <p className="text-4xl font-black">Sin respuesta</p>
        <p className="max-w-sm text-lg">{feedback.message}</p>
        <div className="flex gap-3">
          {feedback.retry && (
            <button type="button" onClick={feedback.retry} className="rounded-xl bg-black px-6 py-3 text-lg font-semibold text-white">
              Reintentar
            </button>
          )}
          <button type="button" onClick={onDismiss} className="rounded-xl border-2 border-black px-6 py-3 text-lg font-semibold">
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  const d = feedback.data;
  const t = d.ticket;
  const reason = reasonText(d.reason);
  const missingName = accepted && t?.nominative && !t.attendeeName;

  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      aria-label={accepted ? "Boleto válido" : `Boleto rechazado: ${reason.title}`}
      onClick={onDismiss}
      className={`fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center gap-4 p-6 text-center text-white ${accepted ? "bg-green-600" : "bg-red-600"}`}
    >
      <p aria-hidden className="text-8xl leading-none">
        {accepted ? "✓" : "✕"}
      </p>
      <p className="text-5xl font-black tracking-tight">{accepted ? "ADELANTE" : reason.title.toUpperCase()}</p>
      {!accepted && reason.detail && <p className="max-w-sm text-xl">{reason.detail}</p>}

      {t && (
        <div className="space-y-1 text-xl">
          <p className="font-semibold">{t.ticketTypeName}</p>
          {t.attendeeName && <p>{t.attendeeName}</p>}
          <p className="font-mono text-lg tracking-widest opacity-90">{t.code}</p>
        </div>
      )}
      {d.session && <p className="text-lg opacity-95">{d.session.name}</p>}

      {accepted && (
        <p className="text-lg opacity-95">
          {d.maxUsesPerSession === 1 || d.maxUsesPerSession == null ? `Ingreso ${d.entriesInSession} a esta sesión` : `Ingreso ${d.entriesInSession} de ${d.maxUsesPerSession} a esta sesión`}
          {d.maxTotalUses != null && ` · ${d.entriesTotal} de ${d.maxTotalUses} en total`}
        </p>
      )}
      {missingName && <p className="rounded-lg bg-amber-300 px-4 py-2 text-lg font-semibold text-black">Boleto nominativo sin nombre registrado</p>}
      {!accepted && d.previousEntry && (
        <p className="text-lg">
          Ya ingresó a las {time(d.previousEntry.at)} por {d.previousEntry.deviceName}
        </p>
      )}
      {d.replayed && <p className="text-sm opacity-80">Lectura repetida: se muestra el resultado original</p>}
      <p className="mt-4 text-sm opacity-80">Toca para continuar</p>
    </div>
  );
}
