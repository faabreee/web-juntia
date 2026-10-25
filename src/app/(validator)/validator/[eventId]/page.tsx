"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";

import { FormError } from "@/components/auth/auth-card";
import { AttendeeSearch } from "@/components/validator/attendee-search";
import { feedback as playFeedback } from "@/components/validator/feedback";
import { ResultOverlay } from "@/components/validator/result-overlay";
import type { ScanFeedback } from "@/components/validator/result-overlay";
import { useQrScanner } from "@/components/validator/use-qr-scanner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getCheckInSummary, getEvent, registerDevice, scanTicket } from "@/lib/api";
import { errorMessage } from "@/lib/api-client";

const AUTO = "auto";
type Input_ = { token?: string; code?: string; ticketId?: string };

function readDevice(orgId: string): string | null {
  try {
    return localStorage.getItem(`juntia.device.${orgId}`);
  } catch {
    return null;
  }
}
function storeDevice(orgId: string, id: string | null) {
  try {
    if (id) localStorage.setItem(`juntia.device.${orgId}`, id);
    else localStorage.removeItem(`juntia.device.${orgId}`);
  } catch {
    // sin almacenamiento: tendrá que registrar la puerta cada vez
  }
}

function Scanner() {
  const { eventId } = useParams<{ eventId: string }>();
  const orgId = useSearchParams().get("org") ?? "";

  const event = useQuery({
    queryKey: ["validator-event", orgId, eventId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await getEvent({ path: { organizationId: orgId, eventId } });
      if (error || !data) throw new Error(errorMessage(error, "Evento no encontrado"));
      return data;
    },
  });
  const summary = useQuery({
    queryKey: ["checkin-summary", orgId, eventId],
    enabled: !!orgId,
    refetchInterval: 8000,
    queryFn: async () => {
      const { data } = await getCheckInSummary({ path: { organizationId: orgId, eventId } });
      return data ?? null;
    },
  });

  const [deviceId, setDeviceId] = useState<string | null>(() => (orgId ? readDevice(orgId) : null));
  const [deviceName, setDeviceName] = useState("Puerta 1");
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState(AUTO);
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState<ScanFeedback | null>(null);
  const [manual, setManual] = useState("");
  const [searching, setSearching] = useState(false);
  const manualRef = useRef<HTMLInputElement>(null);

  const submitRef = useRef<(input: Input_) => Promise<void>>(async () => undefined);
  const submit = useCallback(
    async (input: Input_) => {
      if (!deviceId) return;
      setBusy(true);
      // Una sola identidad para todos los reintentos de esta lectura: si la red falla a medias, el servidor no la cuenta dos veces.
      const scanId = crypto.randomUUID();
      const attempt = async () => {
        const { data, error, response } = await scanTicket({
          path: { organizationId: orgId, eventId },
          body: { scanId, deviceId, sessionId: sessionId === AUTO ? undefined : sessionId, ...input },
        });
        return { data, error, status: response?.status };
      };
      let last: Awaited<ReturnType<typeof attempt>> | null = null;
      for (let i = 0; i < 3; i++) {
        try {
          last = await attempt();
          if (last.status === undefined || last.status < 500) break;
        } catch {
          last = null;
        }
        await new Promise((r) => setTimeout(r, 400 * (i + 1)));
      }
      setBusy(false);
      if (!last) {
        setShown({ kind: "error", message: "No hay conexión con el servidor. Revisa tu red y reintenta: la lectura no se contará dos veces.", retry: () => void submitRef.current(input) });
        return;
      }
      if (last.data) {
        playFeedback(last.data.result === "ACCEPTED");
        setShown({ kind: "result", data: last.data });
        summary.refetch();
        return;
      }
      if (last.status === 403) {
        storeDevice(orgId, null);
        setDeviceId(null);
        setShown(null);
        setDeviceError("Esta puerta ya no está autorizada. Regístrala de nuevo.");
        return;
      }
      setShown({ kind: "error", message: errorMessage(last.error, "No se pudo validar el boleto."), retry: () => void submitRef.current(input) });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deviceId, orgId, eventId, sessionId],
  );

  useEffect(() => {
    submitRef.current = submit;
  }, [submit]);

  const [videoRef, scanner] = useQrScanner((value) => void submit({ token: value }), { paused: busy || shown !== null || searching });

  function dismiss() {
    setShown(null);
    manualRef.current?.focus();
  }

  async function register(e: React.FormEvent) {
    e.preventDefault();
    setDeviceError(null);
    const { data, error } = await registerDevice({ path: { organizationId: orgId }, body: { name: deviceName } });
    if (error || !data) {
      setDeviceError(errorMessage(error));
      return;
    }
    storeDevice(orgId, data.id);
    setDeviceId(data.id);
  }

  // Un lector USB o Bluetooth "escribe" el código y pulsa Enter: se envía solo.
  function onManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = manual.trim();
    if (!value || busy) return;
    setManual("");
    void submit(value.startsWith("JT1.") ? { token: value } : { code: value });
  }

  useEffect(() => {
    if (deviceId) manualRef.current?.focus();
  }, [deviceId]);

  if (!orgId) return <p className="text-destructive">Falta la organización. Vuelve a elegir el evento.</p>;
  if (event.isError) return <p className="text-destructive">No se encontró el evento.</p>;

  if (!deviceId) {
    return (
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div>
            <h1 className="text-xl font-semibold">Registra esta puerta</h1>
            <p className="text-sm text-muted-foreground">Cada lectura queda anotada con el nombre de la puerta que la hizo.</p>
          </div>
          <form onSubmit={register} className="space-y-3">
            <Label htmlFor="device-name">Nombre de la puerta</Label>
            <Input id="device-name" required minLength={2} maxLength={60} value={deviceName} onChange={(e) => setDeviceName(e.target.value)} />
            <FormError message={deviceError} />
            <Button type="submit">Registrar y continuar</Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  const e = event.data;
  return (
    <div className="space-y-4">
      <div>
        <Link href="/validator" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          ← Eventos
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">{e?.title ?? "Cargando…"}</h1>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {summary.data ? `${summary.data.ticketsEntered} de ${summary.data.validTickets} boletos ya ingresaron · ${summary.data.entries} ingresos` : ""}
        </p>
      </div>

      <div className="space-y-2">
        <Label>Sesión que estás validando</Label>
        <Select value={sessionId} onValueChange={setSessionId}>
          <SelectTrigger className="w-full" aria-label="Sesión">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={AUTO}>Automática (la que está en curso)</SelectItem>
            {e?.sessions.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="relative aspect-square w-full overflow-hidden rounded-2xl border bg-black">
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" aria-label="Vista de la cámara" />
        {scanner.active && <div aria-hidden className="pointer-events-none absolute inset-[18%] rounded-2xl border-4 border-white/80" />}
        {!scanner.active && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
            <p className="text-sm text-white/80">La cámara está apagada.</p>
            <Button onClick={() => void scanner.start()}>Activar cámara</Button>
            {scanner.error && <p className="text-sm text-amber-300">{scanner.error}</p>}
          </div>
        )}
        {busy && <div className="absolute inset-x-0 bottom-0 bg-black/70 p-2 text-center text-sm text-white">Validando…</div>}
      </div>
      {scanner.active && (
        <Button variant="ghost" size="sm" onClick={scanner.stop}>
          Apagar cámara
        </Button>
      )}

      <form onSubmit={onManualSubmit} className="space-y-2">
        <Label htmlFor="manual">Código del boleto o lector</Label>
        <div className="flex gap-2">
          <Input
            id="manual"
            ref={manualRef}
            value={manual}
            onChange={(ev) => setManual(ev.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            placeholder="ABCD-EFGH, o escanea con un lector"
          />
          <Button type="submit" disabled={busy || !manual.trim()}>
            Validar
          </Button>
        </div>
      </form>
      <Button variant="outline" className="w-full" onClick={() => setSearching(true)}>
        Buscar asistente
      </Button>
      <p className="text-center text-xs text-muted-foreground">Puerta registrada en este dispositivo.</p>

      <AttendeeSearch
        open={searching}
        onOpenChange={setSearching}
        organizationId={orgId}
        eventId={eventId}
        onPick={(ticketId) => void submit({ ticketId })}
      />
      {shown && <ResultOverlay feedback={shown} onDismiss={dismiss} />}
    </div>
  );
}

export default function ValidatorEventPage() {
  return (
    <Suspense>
      <Scanner />
    </Suspense>
  );
}
