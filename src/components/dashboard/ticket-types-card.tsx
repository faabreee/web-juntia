"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { FormError } from "@/components/auth/auth-card";
import { useDashboard } from "@/components/dashboard/org-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createTicketType, deleteTicketType, listTicketTypes, updateTicketType } from "@/lib/api";
import type { EventResponse, TicketTypeRequest, TicketTypeResponse } from "@/lib/api";
import { errorMessage } from "@/lib/api-client";
import { instantToZonedLocal, zonedLocalToInstant } from "@/lib/datetime";
import { describeAccess, formatPrice, minorToPriceText, priceToMinor, TEMPLATES } from "@/lib/tickets";
import type { Scope, Template } from "@/lib/tickets";

type Draft = {
  id?: string;
  template: Template;
  name: string;
  description: string;
  price: string;
  quota: string;
  maxPerOrder: string;
  salesStart: string;
  salesEnd: string;
  active: boolean;
  earlyEntry: string;
  // reglas según plantilla
  singleSessionId: string;
  sessionIds: string[];
  uses: string;
  reentry: boolean;
  scope: Scope;
  maxTotalUses: string;
  maxUsesPerSession: string;
};

const SALE_LABEL = { NOT_STARTED: "Aún no empieza", ON_SALE: "En venta", ENDED: "Venta finalizada" } as const;
const intOrUndefined = (s: string) => (s.trim() === "" ? undefined : Number(s));

function emptyDraft(template: Template, event: EventResponse): Draft {
  const firstSession = event.sessions[0]?.id ?? "";
  const names = { SINGLE: "Entrada única", MULTI_DAY: `Pase ${event.sessions.length} días`, N_USES: "Pase de 3 usos", CUSTOM: "" } as const;
  return {
    template,
    name: names[template],
    description: "",
    price: "",
    quota: "",
    maxPerOrder: "10",
    salesStart: "",
    salesEnd: "",
    active: true,
    earlyEntry: "60",
    singleSessionId: firstSession,
    sessionIds: event.sessions.map((s) => s.id),
    uses: "3",
    reentry: false,
    scope: "ALL_SESSIONS",
    maxTotalUses: "",
    maxUsesPerSession: "",
  };
}

function draftFromType(t: TicketTypeResponse, event: EventResponse): Draft {
  const d = emptyDraft(t.template, event);
  return {
    ...d,
    id: t.id,
    name: t.name,
    description: t.description ?? "",
    price: minorToPriceText(t.priceMinor ?? 0, t.currency),
    quota: t.quota == null ? "" : String(t.quota),
    maxPerOrder: String(t.maxPerOrder ?? 10),
    salesStart: t.salesStart ? instantToZonedLocal(t.salesStart, event.timezone) : "",
    salesEnd: t.salesEnd ? instantToZonedLocal(t.salesEnd, event.timezone) : "",
    active: t.active ?? true,
    earlyEntry: String(t.earlyEntryMinutes ?? 60),
    singleSessionId: t.sessionIds[0] ?? d.singleSessionId,
    sessionIds: t.scope === "SELECTED_SESSIONS" ? t.sessionIds : event.sessions.map((s) => s.id),
    uses: String(t.maxTotalUses ?? 3),
    reentry: t.maxUsesPerSession == null,
    scope: t.scope,
    maxTotalUses: t.maxTotalUses == null ? "" : String(t.maxTotalUses),
    maxUsesPerSession: t.maxUsesPerSession == null ? "" : String(t.maxUsesPerSession),
  };
}

/** Traduce la plantilla elegida a los parámetros de la regla (ADR 0004). */
function toRequest(d: Draft, priceMinor: number, tz: string): TicketTypeRequest {
  let rule: Pick<TicketTypeRequest, "scope" | "sessionIds" | "maxTotalUses" | "maxUsesPerSession">;
  switch (d.template) {
    case "SINGLE":
      rule = { scope: "SELECTED_SESSIONS", sessionIds: [d.singleSessionId], maxTotalUses: 1, maxUsesPerSession: 1 };
      break;
    case "MULTI_DAY":
      rule = { scope: "SELECTED_SESSIONS", sessionIds: d.sessionIds, maxTotalUses: undefined, maxUsesPerSession: 1 };
      break;
    case "N_USES":
      rule = { scope: "ALL_SESSIONS", sessionIds: [], maxTotalUses: Number(d.uses), maxUsesPerSession: d.reentry ? undefined : 1 };
      break;
    default:
      rule = {
        scope: d.scope,
        sessionIds: d.scope === "SELECTED_SESSIONS" ? d.sessionIds : [],
        maxTotalUses: intOrUndefined(d.maxTotalUses),
        maxUsesPerSession: intOrUndefined(d.maxUsesPerSession),
      };
  }
  return {
    name: d.name,
    description: d.description || undefined,
    template: d.template,
    priceMinor,
    quota: intOrUndefined(d.quota),
    maxPerOrder: intOrUndefined(d.maxPerOrder),
    salesStart: d.salesStart ? zonedLocalToInstant(d.salesStart, tz) : undefined,
    salesEnd: d.salesEnd ? zonedLocalToInstant(d.salesEnd, tz) : undefined,
    earlyEntryMinutes: intOrUndefined(d.earlyEntry),
    active: d.active,
    ...rule,
  };
}

export function TicketTypesCard({ event, orgId, editable }: { event: EventResponse; orgId: string; editable: boolean }) {
  const queryClient = useQueryClient();
  const key = ["ticket-types", orgId, event.id];
  const currency = useOrganizationCurrency();

  const types = useQuery({
    queryKey: key,
    queryFn: async (): Promise<TicketTypeResponse[]> => {
      const { data, error } = await listTicketTypes({ path: { organizationId: orgId, eventId: event.id } });
      if (error || !data) throw new Error(errorMessage(error));
      return data;
    },
  });

  const [picking, setPicking] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async (d: Draft) => {
      const priceMinor = priceToMinor(d.price, currency);
      if (priceMinor === null) throw new Error("El precio no es válido");
      const body = toRequest(d, priceMinor, event.timezone);
      const path = { organizationId: orgId, eventId: event.id };
      const result = d.id
        ? await updateTicketType({ path: { ...path, ticketTypeId: d.id }, body })
        : await createTicketType({ path, body });
      if (result.error) throw new Error(errorMessage(result.error));
    },
    onSuccess: () => {
      setDraft(null);
      queryClient.invalidateQueries({ queryKey: key });
      // una sesión incluida en una entrada ya no se puede eliminar: refresca el evento
      queryClient.invalidateQueries({ queryKey: ["event", orgId, event.id] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const remove = useMutation({
    mutationFn: async (ticketTypeId: string) => {
      const { error } = await deleteTicketType({ path: { organizationId: orgId, eventId: event.id, ticketTypeId } });
      if (error) throw new Error(errorMessage(error));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
    onError: (e: Error) => toast.error(e.message),
  });

  function startNew(template: Template) {
    setPicking(false);
    setError(null);
    setDraft(emptyDraft(template, event));
  }

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));
  const toggleSession = (id: string, checked: boolean) =>
    setDraft((d) => (d ? { ...d, sessionIds: checked ? [...d.sessionIds, id] : d.sessionIds.filter((s) => s !== id) } : d));

  const noSessions = event.sessions.length === 0;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div className="space-y-1.5">
          <CardTitle>Entradas</CardTitle>
          <CardDescription>Tipos de entrada con precio, cupo y regla de acceso. Agrega primero las sesiones.</CardDescription>
        </div>
        {editable && (
          <Button disabled={noSessions} onClick={() => setPicking(true)}>
            Agregar entrada
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {types.data?.length === 0 && <p className="text-sm text-muted-foreground">Aún no hay entradas.</p>}
        {types.isError && <p className="text-sm text-destructive">No se pudieron cargar las entradas.</p>}
        <ul className="divide-y">
          {types.data?.map((t) => (
            <li key={t.id} className="flex items-start justify-between gap-4 py-3">
              <div className="space-y-1">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {t.name}
                  <span className="text-sm font-normal text-muted-foreground">{formatPrice(t.priceMinor ?? 0, t.currency)}</span>
                  {!t.active && <Badge variant="secondary">Oculta</Badge>}
                  <Badge variant="outline">{SALE_LABEL[t.saleStatus]}</Badge>
                </p>
                <p className="text-sm text-muted-foreground">{describeAccess(t, event.sessions)}</p>
                <p className="text-xs text-muted-foreground">
                  {t.quota == null ? "Cupo ilimitado" : `Cupo ${t.quota}`} · máx. {t.maxPerOrder} por orden
                </p>
              </div>
              {editable && (
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setError(null);
                      setDraft(draftFromType(t, event));
                    }}
                  >
                    Editar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => remove.mutate(t.id)} disabled={remove.isPending}>
                    Quitar
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </CardContent>

      <Dialog open={picking} onOpenChange={setPicking}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Qué tipo de entrada quieres?</DialogTitle>
            <DialogDescription>Elige una plantilla; luego puedes ajustar los detalles.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => startNew(t.id)}
                className="rounded-lg border p-4 text-left transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <p className="font-medium">{t.title}</p>
                <p className="text-sm text-muted-foreground">{t.description}</p>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          {draft && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);
                save.mutate(draft);
              }}
              className="space-y-4"
            >
              <DialogHeader>
                <DialogTitle>
                  {draft.id ? "Editar entrada" : "Nueva entrada"} · {TEMPLATES.find((t) => t.id === draft.template)?.title}
                </DialogTitle>
                <DialogDescription>Precios en {currency}. Horas en la zona {event.timezone}.</DialogDescription>
              </DialogHeader>

              <div className="space-y-2">
                <Label htmlFor="tt-name">Nombre</Label>
                <Input id="tt-name" required maxLength={120} value={draft.name} onChange={(e) => set("name", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tt-description">Descripción (opcional)</Label>
                <Textarea id="tt-description" rows={2} maxLength={500} value={draft.description} onChange={(e) => set("description", e.target.value)} />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="tt-price">Precio ({currency})</Label>
                  <Input id="tt-price" inputMode="decimal" placeholder="0 = gratis" value={draft.price} onChange={(e) => set("price", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tt-quota">Cupo</Label>
                  <Input id="tt-quota" type="number" min={1} placeholder="Ilimitado" value={draft.quota} onChange={(e) => set("quota", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tt-per-order">Máx. por orden</Label>
                  <Input id="tt-per-order" type="number" min={1} max={50} required value={draft.maxPerOrder} onChange={(e) => set("maxPerOrder", e.target.value)} />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="tt-sales-start">Venta desde (opcional)</Label>
                  <Input id="tt-sales-start" type="datetime-local" value={draft.salesStart} onChange={(e) => set("salesStart", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tt-sales-end">Venta hasta (opcional)</Label>
                  <Input id="tt-sales-end" type="datetime-local" value={draft.salesEnd} onChange={(e) => set("salesEnd", e.target.value)} />
                </div>
              </div>

              <fieldset className="space-y-3 rounded-lg border p-4">
                <legend className="px-1 text-sm font-medium">Acceso</legend>

                {draft.template === "SINGLE" && (
                  <div className="space-y-2">
                    <Label>Sesión</Label>
                    <Select value={draft.singleSessionId} onValueChange={(v) => set("singleSessionId", v)}>
                      <SelectTrigger className="w-full" aria-label="Sesión">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {event.sessions.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Un solo ingreso a esta sesión.</p>
                  </div>
                )}

                {draft.template === "MULTI_DAY" && (
                  <SessionChecklist event={event} selected={draft.sessionIds} onToggle={toggleSession} hint="Un ingreso por cada día elegido." />
                )}

                {draft.template === "N_USES" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="tt-uses">Número de ingresos</Label>
                      <Input id="tt-uses" type="number" min={1} required value={draft.uses} onChange={(e) => set("uses", e.target.value)} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox id="tt-reentry" checked={draft.reentry} onCheckedChange={(c) => set("reentry", c === true)} />
                      <Label htmlFor="tt-reentry" className="font-normal">
                        Permitir varios ingresos en la misma sesión
                      </Label>
                    </div>
                    <p className="text-xs text-muted-foreground">Válido en cualquier sesión del evento.</p>
                  </>
                )}

                {draft.template === "CUSTOM" && (
                  <>
                    <div className="space-y-2">
                      <Label>Sesiones</Label>
                      <Select value={draft.scope} onValueChange={(v) => set("scope", v as Scope)}>
                        <SelectTrigger className="w-full" aria-label="Alcance">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL_SESSIONS">Todas las sesiones</SelectItem>
                          <SelectItem value="SELECTED_SESSIONS">Solo algunas sesiones</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {draft.scope === "SELECTED_SESSIONS" && <SessionChecklist event={event} selected={draft.sessionIds} onToggle={toggleSession} />}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="tt-total">Máx. ingresos en total</Label>
                        <Input id="tt-total" type="number" min={1} placeholder="Ilimitado" value={draft.maxTotalUses} onChange={(e) => set("maxTotalUses", e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="tt-per-session">Máx. ingresos por sesión</Label>
                        <Input id="tt-per-session" type="number" min={1} placeholder="Reingreso libre" value={draft.maxUsesPerSession} onChange={(e) => set("maxUsesPerSession", e.target.value)} />
                      </div>
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label htmlFor="tt-early">Se puede ingresar desde (minutos antes del inicio)</Label>
                  <Input id="tt-early" type="number" min={0} max={1440} required value={draft.earlyEntry} onChange={(e) => set("earlyEntry", e.target.value)} />
                </div>
              </fieldset>

              <div className="flex items-center gap-2">
                <Checkbox id="tt-active" checked={draft.active} onCheckedChange={(c) => set("active", c === true)} />
                <Label htmlFor="tt-active" className="font-normal">
                  Visible para el público
                </Label>
              </div>

              <FormError message={error} />
              <DialogFooter>
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending ? "Guardando…" : "Guardar entrada"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function SessionChecklist({
  event,
  selected,
  onToggle,
  hint,
}: {
  event: EventResponse;
  selected: string[];
  onToggle: (id: string, checked: boolean) => void;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>Sesiones incluidas</Label>
      {event.sessions.map((s) => (
        <div key={s.id} className="flex items-center gap-2">
          <Checkbox id={`tt-session-${s.id}`} checked={selected.includes(s.id)} onCheckedChange={(c) => onToggle(s.id, c === true)} />
          <Label htmlFor={`tt-session-${s.id}`} className="font-normal">
            {s.name}
          </Label>
        </div>
      ))}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function useOrganizationCurrency(): string {
  // La moneda de la organización activa; el backend la aplica a cada entrada.
  return useDashboard().organization?.currency ?? "USD";
}
