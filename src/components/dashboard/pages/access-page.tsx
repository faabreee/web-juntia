"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { FormError } from "@/components/auth/auth-card";
import { useDashboard } from "@/components/dashboard/org-context";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCheckInSummary, getEvent, listCheckIns, listDevices, listEvents, revertCheckIn, revokeDevice } from "@/lib/api";
import type { AuditEntry, DeviceResponse } from "@/lib/api";
import { errorMessage } from "@/lib/api-client";
import { reasonText } from "@/lib/scan-reasons";

export function AccessPage() {
  const { organization } = useDashboard();
  const queryClient = useQueryClient();
  const orgId = organization?.id ?? "";
  const canManage = organization?.role === "OWNER" || organization?.role === "ADMIN";
  const [picked, setPicked] = useState<string | null>(null);

  const events = useQuery({
    queryKey: ["access-events", orgId],
    enabled: !!orgId && canManage,
    queryFn: async () => {
      const { data, error } = await listEvents({ path: { organizationId: orgId }, query: { status: "PUBLISHED", size: 50 } });
      if (error || !data) throw new Error(errorMessage(error));
      return data.items;
    },
  });
  const eventId = picked ?? events.data?.[0]?.id ?? "";

  const event = useQuery({
    queryKey: ["event", orgId, eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data } = await getEvent({ path: { organizationId: orgId, eventId } });
      return data ?? null;
    },
  });
  const summary = useQuery({
    queryKey: ["checkin-summary", orgId, eventId],
    enabled: !!eventId,
    refetchInterval: 10_000,
    queryFn: async () => (await getCheckInSummary({ path: { organizationId: orgId, eventId } })).data ?? null,
  });
  const audit = useQuery({
    queryKey: ["checkins", orgId, eventId],
    enabled: !!eventId,
    refetchInterval: 10_000,
    queryFn: async (): Promise<AuditEntry[]> => {
      const { data, error } = await listCheckIns({ path: { organizationId: orgId, eventId }, query: { limit: 100 } });
      if (error || !data) throw new Error(errorMessage(error));
      return data;
    },
  });
  const devices = useQuery({
    queryKey: ["devices", orgId],
    enabled: !!orgId && canManage,
    queryFn: async (): Promise<DeviceResponse[]> => {
      const { data, error } = await listDevices({ path: { organizationId: orgId } });
      if (error || !data) throw new Error(errorMessage(error));
      return data;
    },
  });

  const revoke = useMutation({
    mutationFn: async (deviceId: string) => {
      const { error } = await revokeDevice({ path: { organizationId: orgId, deviceId } });
      if (error) throw new Error(errorMessage(error));
    },
    onSuccess: () => {
      toast.success("Dispositivo revocado");
      queryClient.invalidateQueries({ queryKey: ["devices", orgId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [target, setTarget] = useState<AuditEntry | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const revert = useMutation({
    mutationFn: async () => {
      if (!target) return;
      const { error } = await revertCheckIn({ path: { organizationId: orgId, eventId, checkInId: target.id }, body: { reason } });
      if (error) throw new Error(errorMessage(error));
    },
    onSuccess: () => {
      toast.success("Ingreso revertido");
      setTarget(null);
      queryClient.invalidateQueries({ queryKey: ["checkins", orgId, eventId] });
      queryClient.invalidateQueries({ queryKey: ["checkin-summary", orgId, eventId] });
    },
    onError: (e: Error) => setError(e.message),
  });

  if (!organization) return null;
  if (!canManage) return <p className="text-muted-foreground">Solo los propietarios y administradores pueden ver los accesos.</p>;

  const fmt = new Intl.DateTimeFormat("es", { dateStyle: "short", timeStyle: "medium" });
  const sessionName = (id?: string) => event.data?.sessions.find((s) => s.id === id)?.name ?? "—";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Accesos</h1>
          <p className="text-muted-foreground">Ingresos en puerta, dispositivos y auditoría de {organization.name}.</p>
        </div>
        <Link href="/validator" className={buttonVariants()}>
          Abrir modo validador
        </Link>
      </div>

      {events.data?.length === 0 && <p className="text-muted-foreground">No hay eventos publicados todavía.</p>}
      {events.data && events.data.length > 0 && (
        <div className="max-w-sm space-y-2">
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
      )}

      {summary.data && (
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            ["Boletos válidos", summary.data.validTickets],
            ["Boletos que ya ingresaron", summary.data.ticketsEntered],
            ["Ingresos", summary.data.entries],
            ["Lecturas rechazadas", summary.data.rejected],
          ].map(([label, value]) => (
            <Card key={label as string}>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="text-3xl font-semibold tabular-nums">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {summary.data && event.data && event.data.sessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Ingresos por sesión</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {event.data.sessions.map((s) => (
                <li key={s.id} className="flex items-center justify-between py-2">
                  <span>{s.name}</span>
                  <span className="font-semibold tabular-nums">{summary.data?.entriesBySession[s.id] ?? 0}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Dispositivos de validación</CardTitle>
          <CardDescription>Cada puerta registra el suyo la primera vez que valida. Revoca los que ya no deban usarse.</CardDescription>
        </CardHeader>
        <CardContent>
          {devices.data?.length === 0 && <p className="text-sm text-muted-foreground">Aún no se registró ninguna puerta.</p>}
          <ul className="divide-y">
            {devices.data?.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="flex items-center gap-2 font-medium">
                    {d.name} {d.revoked && <Badge variant="outline">Revocado</Badge>}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Registrado por {d.registeredByName} · {d.lastSeenAt ? `última lectura ${fmt.format(new Date(d.lastSeenAt))}` : "sin lecturas"}
                  </p>
                </div>
                {!d.revoked && (
                  <Button variant="outline" size="sm" onClick={() => revoke.mutate(d.id)} disabled={revoke.isPending}>
                    Revocar
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Registro de lecturas</CardTitle>
          <CardDescription>Todos los intentos, aceptados y rechazados (los 100 más recientes). Se actualiza solo.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hora</TableHead>
                <TableHead>Resultado</TableHead>
                <TableHead>Boleto</TableHead>
                <TableHead>Sesión</TableHead>
                <TableHead>Puerta</TableHead>
                <TableHead>Validó</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {audit.data?.map((a) => (
                <TableRow key={a.id} className={a.revertedAt ? "opacity-60" : ""}>
                  <TableCell className="whitespace-nowrap">{fmt.format(new Date(a.at))}</TableCell>
                  <TableCell>
                    {a.result === "ACCEPTED" ? <Badge>Aceptado</Badge> : <Badge variant="destructive">{reasonText(a.reason).title}</Badge>}
                    {a.revertedAt && (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        Revertido por {a.revertedByName}: {a.revertReason}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {a.ticketCode ? (
                      <>
                        <span className="font-mono">{a.ticketCode}</span>
                        <span className="block text-xs text-muted-foreground">
                          {a.ticketTypeName}
                          {a.attendeeName ? ` · ${a.attendeeName}` : ""}
                        </span>
                      </>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>{sessionName(a.sessionId)}</TableCell>
                  <TableCell>{a.deviceName}</TableCell>
                  <TableCell>{a.validatorName}</TableCell>
                  <TableCell className="text-right">
                    {a.result === "ACCEPTED" && !a.revertedAt && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setTarget(a);
                          setReason("");
                          setError(null);
                        }}
                      >
                        Revertir
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {audit.data?.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Todavía no hay lecturas.</p>}
        </CardContent>
      </Card>

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              revert.mutate();
            }}
            className="space-y-4"
          >
            <DialogHeader>
              <DialogTitle>Revertir ingreso</DialogTitle>
              <DialogDescription>
                El boleto {target?.ticketCode} podrá volver a entrar. El ingreso queda en el registro con tu nombre y el motivo.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="revert-reason">Motivo</Label>
              <Input id="revert-reason" required minLength={3} maxLength={255} value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <FormError message={error} />
            <DialogFooter>
              <Button type="submit" variant="destructive" disabled={revert.isPending}>
                {revert.isPending ? "Revirtiendo…" : "Revertir ingreso"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
