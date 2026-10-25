"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { EventStatusBadge } from "@/components/dashboard/event-status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listEvents } from "@/lib/api";
import type { EventSummaryResponse } from "@/lib/api";
import { useOrganizations } from "@/lib/queries";

export default function ValidatorHome() {
  const { data: organizations } = useOrganizations(true);
  const [picked, setPicked] = useState<string | null>(null);
  const orgId = picked ?? organizations?.[0]?.id ?? "";

  const events = useQuery({
    queryKey: ["validator-events", orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<EventSummaryResponse[]> => {
      const { data, error } = await listEvents({ path: { organizationId: orgId }, query: { status: "PUBLISHED", size: 50 } });
      if (error || !data) throw new Error("No se pudieron cargar los eventos");
      return data.items;
    },
  });

  if (organizations && organizations.length === 0) {
    return <p className="text-muted-foreground">Tu cuenta no pertenece a ninguna organización. Pide que te inviten para poder validar boletos.</p>;
  }
  const fmt = new Intl.DateTimeFormat("es", { dateStyle: "medium" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">¿Qué evento vas a validar?</h1>
        <p className="text-sm text-muted-foreground">Solo aparecen los eventos publicados de tu organización.</p>
      </div>
      {organizations && organizations.length > 1 && (
        <Select value={orgId} onValueChange={setPicked}>
          <SelectTrigger className="w-full" aria-label="Organización">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {organizations.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {events.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {events.isError && <p className="text-sm text-destructive">No se pudieron cargar los eventos.</p>}
      {events.data?.length === 0 && <p className="text-muted-foreground">No hay eventos publicados.</p>}
      <ul className="space-y-3">
        {events.data?.map((e) => (
          <li key={e.id}>
            <Link href={`/validator/${e.id}?org=${orgId}`} className="block">
              <Card className="transition-colors hover:bg-accent">
                <CardContent className="flex items-center justify-between gap-4 pt-6">
                  <div>
                    <p className="font-medium">{e.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {e.firstSessionAt ? fmt.format(new Date(e.firstSessionAt)) : "Sin fecha"}
                      {e.lastSessionAt && e.firstSessionAt && fmt.format(new Date(e.lastSessionAt)) !== fmt.format(new Date(e.firstSessionAt))
                        ? ` – ${fmt.format(new Date(e.lastSessionAt))}`
                        : ""}
                    </p>
                  </div>
                  <EventStatusBadge status={e.status} />
                </CardContent>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
