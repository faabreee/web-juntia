"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { FormError } from "@/components/auth/auth-card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { getTicket, setAttendee } from "@/lib/api";
import type { TicketDetailResponse } from "@/lib/api";
import { errorMessage } from "@/lib/api-client";
import { formatRange } from "@/lib/datetime";

type WakeLockSentinelLike = { release: () => Promise<void> };

export default function TicketPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const queryClient = useQueryClient();
  const key = ["ticket", ticketId];
  const stage = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const ticket = useQuery({
    queryKey: key,
    queryFn: async (): Promise<TicketDetailResponse> => {
      const { data, error } = await getTicket({ path: { ticketId } });
      if (error || !data) throw new Error(errorMessage(error, "Boleto no encontrado"));
      return data;
    },
  });

  const [name, setName] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const saveName = useMutation({
    mutationFn: async (value: string) => {
      const { error } = await setAttendee({ path: { ticketId }, body: { name: value } });
      if (error) throw new Error(errorMessage(error));
    },
    onSuccess: () => {
      setNameError(null);
      setName(null);
      toast.success("Nombre guardado");
      queryClient.invalidateQueries({ queryKey: key });
      queryClient.invalidateQueries({ queryKey: ["my-tickets"] });
    },
    onError: (e: Error) => setNameError(e.message),
  });

  // En pantalla completa se mantiene la pantalla encendida para que el QR no se apague en la puerta.
  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === stage.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  useEffect(() => {
    if (!fullscreen) return;
    let lock: WakeLockSentinelLike | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> } };
    nav.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => undefined);
    return () => {
      lock?.release().catch(() => undefined);
    };
  }, [fullscreen]);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await stage.current?.requestFullscreen();
    } catch {
      toast.error("Tu navegador no permite la pantalla completa.");
    }
  }

  if (ticket.isLoading) return <Skeleton className="h-96 w-full" />;
  if (ticket.isError || !ticket.data) {
    return (
      <div className="space-y-4">
        <p className="text-destructive">No se encontró el boleto.</p>
        <Link href="/tickets" className="text-sm underline">
          Volver a mis boletos
        </Link>
      </div>
    );
  }

  const d = ticket.data;
  const t = d.ticket;
  const valid = t.status === "VALID" && !!t.qrToken;

  return (
    <div className="mx-auto max-w-md space-y-6">
      <Link href="/tickets" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
        ← Mis boletos
      </Link>

      <div
        ref={stage}
        className={`flex flex-col items-center gap-4 rounded-2xl border bg-white p-6 text-black ${fullscreen ? "min-h-screen justify-center rounded-none border-0" : ""}`}
      >
        <div className="text-center">
          <h1 className="text-xl font-semibold">{t.eventTitle}</h1>
          <p className="text-sm text-neutral-600">{t.ticketTypeName}</p>
          {t.attendeeName && <p className="mt-1 text-sm font-medium">{t.attendeeName}</p>}
        </div>

        {valid ? (
          <>
            <div className="rounded-xl bg-white p-3 ring-1 ring-neutral-200">
              <QRCodeSVG
                value={t.qrToken as string}
                level="M"
                marginSize={2}
                className="h-auto w-[min(78vw,340px)]"
                aria-label={`Código QR del boleto ${t.code}`}
                role="img"
              />
            </div>
            <p className="font-mono text-3xl font-bold tracking-[0.2em]" aria-label={`Código ${t.code}`}>
              {t.code}
            </p>
            <p className="text-center text-xs text-neutral-600">Muestra este código en la entrada. Sube el brillo de tu pantalla.</p>
          </>
        ) : (
          <div className="py-8 text-center" role="status">
            <Badge variant="outline" className="border-neutral-400 text-neutral-700">
              Boleto anulado
            </Badge>
            <p className="mt-3 text-sm text-neutral-600">Este boleto ya no es válido (la orden fue reembolsada).</p>
          </div>
        )}

        {valid && (
          <Button type="button" variant="outline" className="border-neutral-300 bg-white text-black hover:bg-neutral-100" onClick={toggleFullscreen}>
            {fullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
          </Button>
        )}
      </div>

      {valid && t.nominative && (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                setNameError(null);
                saveName.mutate((name ?? t.attendeeName ?? "").trim());
              }}
            >
              <Label htmlFor="attendee">Nombre del asistente</Label>
              <Input id="attendee" required minLength={2} maxLength={120} value={name ?? t.attendeeName ?? ""} onChange={(e) => setName(e.target.value)} placeholder="Nombre y apellido" />
              <p className="text-xs text-muted-foreground">Este boleto es nominativo: registra quién lo usará.</p>
              <FormError message={nameError} />
              <Button type="submit" disabled={saveName.isPending}>
                {saveName.isPending ? "Guardando…" : "Guardar nombre"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-3 pt-6">
          <h2 className="font-medium">Qué cubre este boleto</h2>
          <ul className="divide-y">
            {d.sessions.map((s) => (
              <li key={s.id} className="space-y-0.5 py-2">
                <p className="font-medium">{s.name}</p>
                <p className="text-sm text-muted-foreground">{formatRange(s.startsAt, s.endsAt, t.timezone)}</p>
                {s.venue?.name && (
                  <p className="text-sm text-muted-foreground">
                    {s.venue.name}
                    {s.venue.city ? `, ${s.venue.city}` : ""}
                  </p>
                )}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            {d.maxTotalUses == null ? "Ingresos ilimitados" : `${d.maxTotalUses} ${d.maxTotalUses === 1 ? "ingreso" : "ingresos"} en total`} ·{" "}
            {d.maxUsesPerSession == null ? "reingreso libre" : d.maxUsesPerSession === 1 ? "un ingreso por sesión" : `${d.maxUsesPerSession} ingresos por sesión`} · puedes entrar desde{" "}
            {d.earlyEntryMinutes ?? 60} min antes. Organiza {d.organizationName}.
          </p>
          {valid && (
            <a href={`/api/tickets/${t.id}/pdf`} className={buttonVariants({ variant: "outline" })} download>
              Descargar PDF
            </a>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
