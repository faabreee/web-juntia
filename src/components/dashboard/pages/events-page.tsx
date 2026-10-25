"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useDeferredValue, useState } from "react";

import { EventStatusBadge } from "@/components/dashboard/event-status-badge";
import { NewEventDialog } from "@/components/dashboard/new-event-dialog";
import { useDashboard } from "@/components/dashboard/org-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listEvents } from "@/lib/api";
import type { EventPageResponse } from "@/lib/api";
import { errorMessage } from "@/lib/api-client";

const PAGE_SIZE = 10;

function dayStart(date: string) {
  return date ? new Date(`${date}T00:00:00`).toISOString() : undefined;
}

export function EventsPage() {
  const { organization } = useDashboard();
  const orgId = organization?.id ?? "";
  const canManage = organization?.role === "OWNER" || organization?.role === "ADMIN";

  const [status, setStatus] = useState("ALL");
  const [text, setText] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);
  const q = useDeferredValue(text);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["events", orgId, status, q, from, to, page],
    enabled: !!orgId,
    queryFn: async (): Promise<EventPageResponse> => {
      const { data, error } = await listEvents({
        path: { organizationId: orgId },
        query: {
          status: status === "ALL" ? undefined : (status as "DRAFT" | "PUBLISHED" | "CANCELLED"),
          q: q || undefined,
          from: dayStart(from),
          // "hasta" incluye el día completo
          to: to ? dayStart(new Date(new Date(`${to}T00:00:00`).getTime() + 86_400_000).toISOString().slice(0, 10)) : undefined,
          page,
          size: PAGE_SIZE,
        },
      });
      if (error || !data) throw new Error(errorMessage(error));
      return data;
    },
  });

  if (!organization) return null;
  const totalPages = data ? Math.max(1, Math.ceil((data.total ?? 0) / (data.size ?? PAGE_SIZE))) : 1;
  const fmt = new Intl.DateTimeFormat("es", { dateStyle: "medium" });

  function resetPage<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(0);
    };
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Eventos</h1>
          <p className="text-muted-foreground">Eventos de {organization.name}.</p>
        </div>
        {canManage && <NewEventDialog />}
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="search">Buscar</Label>
              <Input id="search" placeholder="Título del evento" value={text} onChange={(e) => resetPage(setText)(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={status} onValueChange={resetPage(setStatus)}>
                <SelectTrigger className="w-full" aria-label="Estado">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="DRAFT">Borrador</SelectItem>
                  <SelectItem value="PUBLISHED">Publicado</SelectItem>
                  <SelectItem value="CANCELLED">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="from">Desde</Label>
                <Input id="from" type="date" value={from} onChange={(e) => resetPage(setFrom)(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="to">Hasta</Label>
                <Input id="to" type="date" value={to} onChange={(e) => resetPage(setTo)(e.target.value)} />
              </div>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Evento</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fechas</TableHead>
                <TableHead className="text-right">Sesiones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.items.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">
                    <Link href={`/events/${e.id}`} className="underline-offset-4 hover:underline">
                      {e.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <EventStatusBadge status={e.status} />
                  </TableCell>
                  <TableCell>
                    {e.firstSessionAt && e.lastSessionAt
                      ? fmt.format(new Date(e.firstSessionAt)) +
                        (fmt.format(new Date(e.firstSessionAt)) !== fmt.format(new Date(e.lastSessionAt)) ? ` – ${fmt.format(new Date(e.lastSessionAt))}` : "")
                      : "Sin sesiones"}
                  </TableCell>
                  <TableCell className="text-right">{e.sessionCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
          {isError && <p className="text-sm text-destructive">No se pudieron cargar los eventos.</p>}
          {data && data.items.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {(data.total ?? 0) === 0 && !q && status === "ALL" && !from && !to ? "Aún no tienes eventos." : "Ningún evento coincide con los filtros."}
            </p>
          )}

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {data ? `${data.total ?? 0} evento${data.total === 1 ? "" : "s"}` : ""}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                Anterior
              </Button>
              <span className="text-sm text-muted-foreground">
                {page + 1} / {totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Siguiente
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
