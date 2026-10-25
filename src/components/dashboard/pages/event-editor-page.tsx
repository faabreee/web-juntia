"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { FormError } from "@/components/auth/auth-card";
import { EventStatusBadge } from "@/components/dashboard/event-status-badge";
import { TicketTypesCard } from "@/components/dashboard/ticket-types-card";
import { useDashboard } from "@/components/dashboard/org-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  addSession,
  cancelEvent,
  deleteEvent,
  deleteSession,
  getEvent,
  listVenues,
  publishEvent,
  removeCover,
  unpublishEvent,
  updateEvent,
  updateSession,
  uploadCover,
} from "@/lib/api";
import type { EventResponse, SessionResponse, VenueResponse } from "@/lib/api";
import { errorMessage } from "@/lib/api-client";
import { formatRange, instantToZonedLocal, zonedLocalToInstant } from "@/lib/datetime";

type SessionDraft = { id?: string; name: string; start: string; end: string; venueId: string };
const NO_VENUE = "none";

export function EventEditorPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { organization } = useDashboard();
  const orgId = organization?.id ?? "";
  const canManage = organization?.role === "OWNER" || organization?.role === "ADMIN";
  const eventKey = ["event", orgId, eventId];

  const event = useQuery({
    queryKey: eventKey,
    enabled: !!orgId,
    queryFn: async (): Promise<EventResponse> => {
      const { data, error } = await getEvent({ path: { organizationId: orgId, eventId } });
      if (error || !data) throw new Error(errorMessage(error, "Evento no encontrado"));
      return data;
    },
  });

  const venues = useQuery({
    queryKey: ["venues", orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<VenueResponse[]> => {
      const { data } = await listVenues({ path: { organizationId: orgId } });
      return data ?? [];
    },
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: eventKey });
    queryClient.invalidateQueries({ queryKey: ["events", orgId] });
  };
  const onError = (e: Error) => toast.error(e.message);

  const loaded = event.data;

  // ---- estado ----
  const transition = useMutation({
    mutationFn: async (action: "publish" | "unpublish") => {
      const call = action === "publish" ? publishEvent : unpublishEvent;
      const { error } = await call({ path: { organizationId: orgId, eventId } });
      if (error) throw new Error(errorMessage(error));
      return action;
    },
    onSuccess: (action) => {
      toast.success(action === "publish" ? "Evento publicado" : "Evento despublicado");
      refresh();
    },
    onError,
  });

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const cancel = useMutation({
    mutationFn: async () => {
      const { error } = await cancelEvent({ path: { organizationId: orgId, eventId }, body: { reason: cancelReason || undefined } });
      if (error) throw new Error(errorMessage(error));
    },
    onSuccess: () => {
      setCancelOpen(false);
      toast.success("Evento cancelado");
      refresh();
    },
    onError,
  });

  const [deleteOpen, setDeleteOpen] = useState(false);
  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await deleteEvent({ path: { organizationId: orgId, eventId } });
      if (error) throw new Error(errorMessage(error));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events", orgId] });
      router.replace("/events");
    },
    onError,
  });

  // ---- sesiones ----
  const [session, setSession] = useState<SessionDraft | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const saveSession = useMutation({
    mutationFn: async (d: SessionDraft) => {
      const body = {
        name: d.name,
        startsAt: zonedLocalToInstant(d.start, loaded?.timezone ?? "UTC"),
        endsAt: zonedLocalToInstant(d.end, loaded?.timezone ?? "UTC"),
        venueId: d.venueId === NO_VENUE ? undefined : d.venueId,
      };
      const result = d.id
        ? await updateSession({ path: { organizationId: orgId, eventId, sessionId: d.id }, body })
        : await addSession({ path: { organizationId: orgId, eventId }, body });
      if (result.error) throw new Error(errorMessage(result.error));
    },
    onSuccess: () => {
      setSession(null);
      refresh();
    },
    onError: (e: Error) => setSessionError(e.message),
  });

  const removeSession = useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await deleteSession({ path: { organizationId: orgId, eventId, sessionId } });
      if (error) throw new Error(errorMessage(error));
    },
    onSuccess: refresh,
    onError,
  });

  function openSession(s?: SessionResponse) {
    setSessionError(null);
    const tz = loaded?.timezone ?? "UTC";
    if (s) {
      setSession({ id: s.id, name: s.name, start: instantToZonedLocal(s.startsAt, tz), end: instantToZonedLocal(s.endsAt, tz), venueId: s.venue?.id ?? NO_VENUE });
    } else {
      // Sugerencia: el día siguiente a la última sesión, a la misma hora.
      const last = loaded?.sessions.at(-1);
      const base = last ? new Date(new Date(last.startsAt).getTime() + 86_400_000) : new Date(Date.now() + 7 * 86_400_000);
      const start = instantToZonedLocal(base.toISOString(), tz);
      const end = instantToZonedLocal(new Date(base.getTime() + 4 * 3_600_000).toISOString(), tz);
      setSession({ name: `Día ${(loaded?.sessions.length ?? 0) + 1}`, start, end, venueId: last?.venue?.id ?? NO_VENUE });
    }
  }

  // ---- portada ----
  const [coverVersion, setCoverVersion] = useState(0);
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const { error } = await uploadCover({ path: { organizationId: orgId, eventId }, body: { file } });
      if (error) throw new Error(errorMessage(error));
    },
    onSuccess: () => {
      setCoverVersion((v) => v + 1);
      toast.success("Portada actualizada");
      refresh();
    },
    onError,
  });
  const dropCover = useMutation({
    mutationFn: async () => {
      const { error } = await removeCover({ path: { organizationId: orgId, eventId } });
      if (error) throw new Error(errorMessage(error));
    },
    onSuccess: refresh,
    onError,
  });

  if (!organization) return null;
  if (event.isLoading) return <Skeleton className="mx-auto h-64 max-w-4xl" />;
  if (event.isError || !loaded) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <p className="text-destructive">No se encontró el evento.</p>
        <Link href="/events" className="text-sm underline">
          Volver a eventos
        </Link>
      </div>
    );
  }

  const cancelled = loaded.status === "CANCELLED";
  const editable = canManage && !cancelled;
  const publicUrl = typeof window === "undefined" ? "" : `${window.location.origin}/e/${loaded.slug}`;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <Link href="/events" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            ← Eventos
          </Link>
          <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight">
            {loaded.title} <EventStatusBadge status={loaded.status} />
          </h1>
        </div>
        {canManage && !cancelled && (
          <div className="flex flex-wrap gap-2">
            {loaded.status === "DRAFT" && (
              <Button onClick={() => transition.mutate("publish")} disabled={transition.isPending}>
                Publicar
              </Button>
            )}
            {loaded.status === "PUBLISHED" && (
              <Button variant="outline" onClick={() => transition.mutate("unpublish")} disabled={transition.isPending}>
                Despublicar
              </Button>
            )}
            <Button variant="outline" onClick={() => setCancelOpen(true)}>
              Cancelar evento
            </Button>
            {loaded.status === "DRAFT" && (
              <Button variant="ghost" onClick={() => setDeleteOpen(true)}>
                Eliminar borrador
              </Button>
            )}
          </div>
        )}
      </div>

      {cancelled && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="font-medium">Este evento fue cancelado y ya no se puede modificar.</p>
            {loaded.cancelReason && <p className="text-sm text-muted-foreground">Motivo: {loaded.cancelReason}</p>}
          </CardContent>
        </Card>
      )}

      {loaded.status !== "DRAFT" && (
        <Card>
          <CardHeader>
            <CardTitle>Enlace público</CardTitle>
            <CardDescription>Compártelo con tu público.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <Input readOnly value={publicUrl} aria-label="Enlace público" />
            <Button
              variant="outline"
              onClick={() => navigator.clipboard.writeText(publicUrl).then(() => toast.success("Enlace copiado"))}
            >
              Copiar
            </Button>
            <Link href={`/e/${loaded.slug}`} target="_blank" className="text-sm underline">
              Abrir
            </Link>
          </CardContent>
        </Card>
      )}

      <DetailsCard event={loaded} editable={editable} orgId={orgId} onSaved={refresh} />

      <Card>
        <CardHeader>
          <CardTitle>Portada</CardTitle>
          <CardDescription>JPEG, PNG o WebP, hasta 5 MB.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loaded.hasCover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/organizations/${orgId}/events/${eventId}/cover?v=${coverVersion}`}
              alt="Portada del evento"
              className="max-h-64 rounded-md border object-cover"
            />
          ) : (
            <p className="text-sm text-muted-foreground">Sin portada.</p>
          )}
          {editable && (
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                aria-label="Subir portada"
                className="max-w-xs"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) upload.mutate(file);
                  e.target.value = "";
                }}
                disabled={upload.isPending}
              />
              {loaded.hasCover && (
                <Button variant="ghost" onClick={() => dropCover.mutate()} disabled={dropCover.isPending}>
                  Quitar portada
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div className="space-y-1.5">
            <CardTitle>Sesiones</CardTitle>
            <CardDescription>Un evento necesita al menos una sesión futura para publicarse.</CardDescription>
          </div>
          {editable && <Button onClick={() => openSession()}>Agregar sesión</Button>}
        </CardHeader>
        <CardContent>
          {loaded.sessions.length === 0 && <p className="text-sm text-muted-foreground">Aún no hay sesiones.</p>}
          <ul className="divide-y">
            {loaded.sessions.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-sm text-muted-foreground">{formatRange(s.startsAt, s.endsAt, loaded.timezone)}</p>
                  {s.venue && (
                    <p className="text-sm text-muted-foreground">
                      {s.venue.name}
                      {s.venue.city ? `, ${s.venue.city}` : ""}
                    </p>
                  )}
                </div>
                {editable && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openSession(s)}>
                      Editar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => removeSession.mutate(s.id)} disabled={removeSession.isPending}>
                      Quitar
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <TicketTypesCard event={loaded} orgId={orgId} editable={editable} />

      <Dialog open={!!session} onOpenChange={(o) => !o && setSession(null)}>
        <DialogContent>
          {session && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSessionError(null);
                saveSession.mutate(session);
              }}
              className="space-y-4"
            >
              <DialogHeader>
                <DialogTitle>{session.id ? "Editar sesión" : "Nueva sesión"}</DialogTitle>
                <DialogDescription>Horas en la zona {loaded.timezone}.</DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="session-name">Nombre</Label>
                <Input id="session-name" required maxLength={120} value={session.name} onChange={(e) => setSession({ ...session, name: e.target.value })} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="session-start">Inicio</Label>
                  <Input id="session-start" type="datetime-local" required value={session.start} onChange={(e) => setSession({ ...session, start: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="session-end">Fin</Label>
                  <Input id="session-end" type="datetime-local" required value={session.end} onChange={(e) => setSession({ ...session, end: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Lugar</Label>
                <Select value={session.venueId} onValueChange={(v) => setSession({ ...session, venueId: v })}>
                  <SelectTrigger className="w-full" aria-label="Lugar">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_VENUE}>Sin lugar definido</SelectItem>
                    {venues.data?.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                        {v.city ? ` — ${v.city}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {venues.data?.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Aún no tienes lugares. <Link href="/venues" className="underline">Crea uno</Link>.
                  </p>
                )}
              </div>
              <FormError message={sessionError} />
              <DialogFooter>
                <Button type="submit" disabled={saveSession.isPending}>
                  {saveSession.isPending ? "Guardando…" : "Guardar sesión"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar evento</DialogTitle>
            <DialogDescription>Esta acción no se puede deshacer. El enlace público mostrará que el evento fue cancelado.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="cancel-reason">Motivo (opcional)</Label>
            <Textarea id="cancel-reason" maxLength={500} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="destructive" onClick={() => cancel.mutate()} disabled={cancel.isPending}>
              Cancelar evento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar borrador</DialogTitle>
            <DialogDescription>Se eliminarán el evento, sus sesiones y su portada. No se puede deshacer.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="destructive" onClick={() => remove.mutate()} disabled={remove.isPending}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailsCard({ event, editable, orgId, onSaved }: { event: EventResponse; editable: boolean; orgId: string; onSaved: () => void }) {
  // Estado inicial desde el evento cargado; tras guardar, el estado local ya es el valor vigente.
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description ?? "");
  const [timezone, setTimezone] = useState(event.timezone);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await updateEvent({ path: { organizationId: orgId, eventId: event.id }, body: { title, description, timezone } });
      if (error) throw new Error(errorMessage(error));
    },
    onSuccess: () => {
      setError(null);
      toast.success("Cambios guardados");
      onSaved();
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Detalles</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            save.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="title">Título</Label>
            <Input id="title" required minLength={3} maxLength={150} disabled={!editable} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea id="description" rows={5} maxLength={10000} disabled={!editable} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="timezone">Zona horaria del evento</Label>
            <Select value={timezone} onValueChange={setTimezone} disabled={!editable}>
              <SelectTrigger id="timezone" className="w-full sm:w-80" aria-label="Zona horaria del evento">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Intl.supportedValuesOf("timeZone").map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Las horas de las sesiones se interpretan en esta zona.</p>
          </div>
          <FormError message={error} />
          {editable && (
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Guardando…" : "Guardar cambios"}
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
