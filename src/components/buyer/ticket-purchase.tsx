"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { FormError } from "@/components/auth/auth-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createOrder } from "@/lib/api";
import type { PublicEventResponse } from "@/lib/api";
import { errorMessage } from "@/lib/api-client";
import { formatInZone } from "@/lib/datetime";
import { describeAccess, formatPrice } from "@/lib/tickets";
import { useMe } from "@/lib/queries";

type Props = Pick<PublicEventResponse, "slug" | "timezone" | "sessions" | "ticketTypes">;

/** Selección de entradas y creación de la orden desde la página pública. */
export function TicketPurchase({ slug, timezone, sessions, ticketTypes }: Props) {
  const router = useRouter();
  const { data: user } = useMe();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Una clave de idempotencia por intento de compra: si la petición se repite (red, doble clic) no se duplica la orden.
  const keyRef = useRef<{ signature: string; key: string } | null>(null);

  const lines = ticketTypes.filter((t) => (quantities[t.id] ?? 0) > 0).map((t) => ({ ticketTypeId: t.id, quantity: quantities[t.id] }));
  const selected = ticketTypes.filter((t) => (quantities[t.id] ?? 0) > 0);
  const currency = selected[0]?.currency ?? ticketTypes[0]?.currency ?? "USD";
  const totalMinor = selected.reduce((sum, t) => sum + (t.priceMinor ?? 0) * quantities[t.id], 0);
  const mixedCurrency = selected.some((t) => t.currency !== currency);

  // Actualización funcional: dos clics seguidos siempre suman, aunque React aún no haya vuelto a renderizar.
  function changeQuantity(id: string, delta: number, max: number) {
    setError(null);
    setQuantities((q) => ({ ...q, [id]: Math.max(0, Math.min(max, (q[id] ?? 0) + delta)) }));
  }

  async function onBuy() {
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(`/e/${slug}`)}`);
      return;
    }
    const signature = JSON.stringify(lines);
    if (keyRef.current?.signature !== signature) keyRef.current = { signature, key: crypto.randomUUID() };
    setPending(true);
    setError(null);
    const { data, error } = await createOrder({
      headers: { "Idempotency-Key": keyRef.current.key },
      body: { eventSlug: slug, items: lines },
    });
    if (error || !data) {
      setPending(false);
      setError(errorMessage(error));
      return;
    }
    router.push(`/orders/${data.id}`);
  }

  return (
    <section aria-labelledby="tickets" className="space-y-3">
      <h2 id="tickets" className="text-xl font-semibold">
        Entradas
      </h2>
      <ul className="divide-y rounded-lg border">
        {ticketTypes.map((t) => {
          const available = t.saleStatus === "ON_SALE" && !t.soldOut;
          const max = t.maxPerOrder ?? 10;
          const qty = quantities[t.id] ?? 0;
          return (
            <li key={t.id} className="flex flex-wrap items-start justify-between gap-4 p-4">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {t.name}
                  {t.soldOut && <Badge variant="destructive">Agotado</Badge>}
                </p>
                {t.description && <p className="text-sm">{t.description}</p>}
                <p className="text-sm text-muted-foreground">{describeAccess(t, sessions)}</p>
                {t.saleStatus === "NOT_STARTED" && t.salesStart && (
                  <p className="text-xs text-muted-foreground">
                    Venta desde {formatInZone(t.salesStart, timezone, { dateStyle: "medium", timeStyle: "short", timeZone: timezone })}
                  </p>
                )}
                {t.saleStatus === "ENDED" && <p className="text-xs text-muted-foreground">Venta finalizada</p>}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <p className="font-semibold">{formatPrice(t.priceMinor ?? 0, t.currency)}</p>
                {available && (
                  <div className="flex items-center gap-2" role="group" aria-label={`Cantidad de ${t.name}`}>
                    <Button type="button" variant="outline" size="icon" aria-label={`Quitar una ${t.name}`} disabled={qty === 0} onClick={() => changeQuantity(t.id, -1, max)}>
                      −
                    </Button>
                    <span className="w-6 text-center tabular-nums" aria-live="polite">
                      {qty}
                    </span>
                    <Button type="button" variant="outline" size="icon" aria-label={`Agregar una ${t.name}`} disabled={qty >= max} onClick={() => changeQuantity(t.id, 1, max)}>
                      +
                    </Button>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {lines.length > 0 && (
        <div className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{lines.reduce((n, l) => n + l.quantity, 0)} entrada(s)</span>
            <span className="text-lg font-semibold">{mixedCurrency ? "—" : formatPrice(totalMinor, currency)}</span>
          </div>
          <FormError message={error} />
          <Button className="w-full" onClick={onBuy} disabled={pending || mixedCurrency}>
            {pending ? "Reservando…" : user ? (totalMinor === 0 ? "Reservar entradas gratis" : "Reservar y continuar") : "Inicia sesión para comprar"}
          </Button>
          <p className="text-xs text-muted-foreground">Reservamos tus entradas por unos minutos mientras completas la compra. Si corresponde, el cargo por servicio se muestra antes de pagar.</p>
        </div>
      )}
      {lines.length === 0 && error && <FormError message={error} />}
    </section>
  );
}
