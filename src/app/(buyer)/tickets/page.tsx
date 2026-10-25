"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { listMyTickets } from "@/lib/api";
import type { TicketResponse } from "@/lib/api";

function whenText(t: TicketResponse) {
  if (!t.firstSessionAt) return "Fecha por confirmar";
  const fmt = new Intl.DateTimeFormat("es", { dateStyle: "medium", timeZone: t.timezone });
  const first = fmt.format(new Date(t.firstSessionAt));
  const last = t.lastSessionAt ? fmt.format(new Date(t.lastSessionAt)) : first;
  return first === last ? first : `${first} – ${last}`;
}

export default function TicketsPage() {
  const tickets = useQuery({
    queryKey: ["my-tickets"],
    queryFn: async (): Promise<TicketResponse[]> => {
      const { data, error } = await listMyTickets();
      if (error || !data) throw new Error("No se pudieron cargar tus boletos");
      return data;
    },
  });

  // Agrupados por evento, en el orden en que llegan (ya vienen por fecha).
  const groups = new Map<string, TicketResponse[]>();
  tickets.data?.forEach((t) => groups.set(t.eventSlug, [...(groups.get(t.eventSlug) ?? []), t]));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Mis boletos</h1>
      {tickets.isLoading && <Skeleton className="h-32 w-full" />}
      {tickets.isError && <p className="text-sm text-destructive">No se pudieron cargar tus boletos.</p>}
      {tickets.data?.length === 0 && (
        <p className="text-muted-foreground">
          Aún no tienes boletos. Cuando compres entradas aparecerán aquí.
        </p>
      )}
      {[...groups.entries()].map(([slug, items]) => (
        <section key={slug} className="space-y-3" aria-label={items[0].eventTitle}>
          <div>
            <h2 className="text-lg font-semibold">{items[0].eventTitle}</h2>
            <p className="text-sm text-muted-foreground">{whenText(items[0])}</p>
          </div>
          <ul className="space-y-3">
            {items.map((t) => (
              <li key={t.id}>
                <Link href={`/tickets/${t.id}`} className="block">
                  <Card className={`transition-colors hover:bg-accent ${t.status === "VOID" ? "opacity-60" : ""}`}>
                    <CardContent className="flex items-center justify-between gap-4 pt-6">
                      <div className="space-y-1">
                        <p className="font-medium">{t.ticketTypeName}</p>
                        <p className="font-mono text-sm tracking-wider text-muted-foreground">{t.code}</p>
                        {t.nominative && t.status === "VALID" && (
                          <p className={`text-sm ${t.attendeeName ? "text-muted-foreground" : "font-medium text-amber-600 dark:text-amber-400"}`}>
                            {t.attendeeName ? `Asistente: ${t.attendeeName}` : "Falta el nombre del asistente"}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {t.status === "VOID" ? <Badge variant="outline">Anulado</Badge> : <Badge>Ver boleto</Badge>}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
