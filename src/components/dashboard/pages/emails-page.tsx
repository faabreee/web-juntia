"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { useDashboard } from "@/components/dashboard/org-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listEvents, listNotifications, retryNotification } from "@/lib/api";
import type { NotificationResponse } from "@/lib/api";
import { errorMessage } from "@/lib/api-client";

const TYPE_LABEL: Record<string, string> = {
  ORDER_CONFIRMATION: "Confirmación de compra",
  TICKETS_DELIVERY: "Entrega de boletos",
  EVENT_REMINDER: "Recordatorio previo",
  EVENT_CANCELLED: "Evento cancelado",
  EVENT_CHANGED: "Evento modificado",
};
const STATUS_FILTERS = [
  { id: "ALL", label: "Todos" },
  { id: "SENT", label: "Enviados" },
  { id: "PENDING", label: "Pendientes" },
  { id: "FAILED", label: "Fallidos" },
  { id: "SKIPPED", label: "Omitidos" },
];

function StatusBadge({ n }: { n: NotificationResponse }) {
  const next = new Intl.DateTimeFormat("es", { timeStyle: "short", dateStyle: "short" }).format(new Date(n.nextAttemptAt));
  switch (n.status) {
    case "SENT":
      return <Badge>Enviado</Badge>;
    case "PENDING":
      return (
        <span>
          <Badge variant="secondary">Pendiente</Badge>
          <span className="mt-1 block text-xs text-muted-foreground">{(n.attempts ?? 0) > 0 ? `Reintento ${next}` : `Sale ${next}`}</span>
        </span>
      );
    case "SENDING":
      return <Badge variant="secondary">Enviando</Badge>;
    case "FAILED":
      return <Badge variant="destructive">Falló</Badge>;
    default:
      return <Badge variant="outline">Omitido</Badge>;
  }
}

/** Registro de los correos de un evento: qué se envió, qué espera y qué falló, con reintento manual. */
export function EmailsPage() {
  const { organization } = useDashboard();
  const queryClient = useQueryClient();
  const orgId = organization?.id ?? "";
  const canManage = organization?.role === "OWNER" || organization?.role === "ADMIN";
  const [picked, setPicked] = useState<string | null>(null);
  const [status, setStatus] = useState("ALL");

  const events = useQuery({
    queryKey: ["email-events", orgId],
    enabled: !!orgId && canManage,
    queryFn: async () => {
      const { data, error } = await listEvents({ path: { organizationId: orgId }, query: { size: 50 } });
      if (error || !data) throw new Error(errorMessage(error));
      return data.items.filter((e) => e.status !== "DRAFT");
    },
  });
  const eventId = picked ?? events.data?.[0]?.id ?? "";

  const log = useQuery({
    queryKey: ["notifications", orgId, eventId, status],
    enabled: !!eventId,
    refetchInterval: 10_000,
    queryFn: async (): Promise<NotificationResponse[]> => {
      const { data, error } = await listNotifications({
        path: { organizationId: orgId, eventId },
        query: { status: status === "ALL" ? undefined : status, limit: 100 },
      });
      if (error || !data) throw new Error(errorMessage(error));
      return data;
    },
  });

  const retry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await retryNotification({ path: { organizationId: orgId, notificationId: id } });
      if (error) throw new Error(errorMessage(error));
    },
    onSuccess: () => {
      toast.success("Envío reactivado");
      queryClient.invalidateQueries({ queryKey: ["notifications", orgId, eventId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!organization) return null;
  if (!canManage) return <p className="text-muted-foreground">Solo los propietarios y administradores pueden ver los correos.</p>;
  const fmt = new Intl.DateTimeFormat("es", { dateStyle: "short", timeStyle: "short" });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Correos</h1>
        <p className="text-muted-foreground">Los correos que Juntia envía a tus asistentes: confirmaciones, boletos, recordatorios y avisos de cambios.</p>
      </div>

      {events.data?.length === 0 && <p className="text-muted-foreground">Aún no hay eventos publicados.</p>}
      {events.data && events.data.length > 0 && (
        <div className="grid max-w-xl gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Evento</Label>
            <Select value={eventId} onValueChange={setPicked}>
              <SelectTrigger className="w-full" aria-label="Evento">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {events.data.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Estado</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full" aria-label="Estado">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Registro de envíos</CardTitle>
          <CardDescription>
            Un envío que falla se reintenta solo (a 1 min, 5 min, 30 min, 2 h y 6 h). Si agota los intentos queda como fallido y puedes reactivarlo. Se actualiza solo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Creado</TableHead>
                <TableHead>Correo</TableHead>
                <TableHead>Destinatario</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Detalle</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {log.data?.map((n) => (
                <TableRow key={n.id}>
                  <TableCell className="whitespace-nowrap">{fmt.format(new Date(n.createdAt))}</TableCell>
                  <TableCell>
                    {TYPE_LABEL[n.type] ?? n.type}
                    {n.subject && <span className="block text-xs text-muted-foreground">{n.subject}</span>}
                  </TableCell>
                  <TableCell>{n.recipientEmail}</TableCell>
                  <TableCell>
                    <StatusBadge n={n} />
                  </TableCell>
                  <TableCell className="max-w-64 text-xs text-muted-foreground">
                    {n.status === "SENT" && n.sentAt ? `Enviado ${fmt.format(new Date(n.sentAt))}` : n.lastError ?? "—"}
                    {(n.attempts ?? 0) > 1 && <span className="block">{n.attempts} intentos</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    {n.status === "FAILED" && (
                      <Button variant="outline" size="sm" onClick={() => retry.mutate(n.id)} disabled={retry.isPending}>
                        Reintentar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {log.data?.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Todavía no hay correos de este evento.</p>}
          {log.isError && <p className="pt-4 text-sm text-destructive">No se pudo cargar el registro.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
