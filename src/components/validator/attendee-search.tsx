"use client";

import { useQuery } from "@tanstack/react-query";
import { useDeferredValue, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { searchAttendees } from "@/lib/api";
import type { AttendeeResponse } from "@/lib/api";
import { errorMessage } from "@/lib/api-client";

/** Búsqueda manual: por código, nombre del asistente, o nombre o correo del comprador. */
export function AttendeeSearch({
  open,
  onOpenChange,
  organizationId,
  eventId,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  eventId: string;
  onPick: (ticketId: string) => void;
}) {
  const [text, setText] = useState("");
  const q = useDeferredValue(text.trim());
  const enough = q.length >= 3;

  const results = useQuery({
    queryKey: ["attendees", organizationId, eventId, q],
    enabled: open && enough,
    queryFn: async (): Promise<AttendeeResponse[]> => {
      const { data, error } = await searchAttendees({ path: { organizationId, eventId }, query: { q } });
      if (error || !data) throw new Error(errorMessage(error));
      return data;
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Buscar asistente</DialogTitle>
          <DialogDescription>Por código del boleto, nombre del asistente, o nombre o correo del comprador.</DialogDescription>
        </DialogHeader>
        <Input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Ej. ABCD-EFGH, Lucía, lucia@…" aria-label="Buscar" />
        {!enough && <p className="text-sm text-muted-foreground">Escribe al menos 3 caracteres.</p>}
        {results.isError && <p className="text-sm text-destructive">{(results.error as Error).message}</p>}
        {enough && results.data?.length === 0 && <p className="text-sm text-muted-foreground">Nada coincide con «{q}».</p>}
        <ul className="divide-y">
          {results.data?.map((a) => (
            <li key={a.ticketId} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0 space-y-0.5">
                <p className="truncate font-medium">{a.attendeeName ?? a.buyerName}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {a.ticketTypeName} · <span className="font-mono">{a.code}</span>
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  Compra de {a.buyerName} · {a.buyerEmailMasked}
                </p>
                <p className="text-xs">
                  {!a.valid ? <Badge variant="outline">Anulado</Badge> : (a.entries ?? 0) > 0 ? `Ya ingresó ${a.entries} vez/veces` : "Sin ingresos todavía"}
                </p>
              </div>
              <Button
                size="sm"
                disabled={!a.valid}
                onClick={() => {
                  onOpenChange(false);
                  onPick(a.ticketId);
                }}
              >
                Dar ingreso
              </Button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
