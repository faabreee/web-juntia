"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { FormError } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { pay, paymentConfig } from "@/lib/api";
import type { OrderResponse, PaymentResponse } from "@/lib/api";
import { errorMessage } from "@/lib/api-client";
import { formatPrice } from "@/lib/tickets";

// Resultados que ofrece la pasarela simulada (solo desarrollo): el token decide qué ocurre.
const SIMULATED_CARDS = [
  { token: "tok_success", label: "Tarjeta aprobada", hint: "El cobro se aprueba al instante" },
  { token: "tok_declined", label: "Tarjeta rechazada", hint: "El banco rechaza el cobro" },
  { token: "tok_insufficient_funds", label: "Fondos insuficientes", hint: "Rechazo por falta de fondos" },
  { token: "tok_pending", label: "Pago pendiente", hint: "Queda a la espera de confirmación" },
] as const;

/** Panel de pago de una orden pendiente. */
export function PaymentPanel({ order }: { order: OrderResponse }) {
  const queryClient = useQueryClient();
  const config = useQuery({
    queryKey: ["payment-config"],
    queryFn: async () => {
      const { data, error } = await paymentConfig();
      if (error || !data) throw new Error(errorMessage(error));
      return data;
    },
    staleTime: Infinity,
  });

  const [token, setToken] = useState<string>(SIMULATED_CARDS[0].token);
  const [result, setResult] = useState<PaymentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Una clave por intento: un doble clic o un reintento de red no cobra dos veces.
  const keyRef = useRef<{ token: string; key: string } | null>(null);

  const charge = useMutation({
    mutationFn: async () => {
      if (keyRef.current?.token !== token) keyRef.current = { token, key: crypto.randomUUID() };
      const { data, error } = await pay({
        path: { orderId: order.id },
        headers: { "Idempotency-Key": keyRef.current.key },
        body: { sourceToken: token },
      });
      if (error || !data) throw new Error(errorMessage(error));
      return data;
    },
    onSuccess: (payment) => {
      setResult(payment);
      setError(null);
      if (payment.status === "FAILED") keyRef.current = null; // el siguiente intento es uno nuevo
      queryClient.invalidateQueries({ queryKey: ["order", order.id] });
      queryClient.invalidateQueries({ queryKey: ["my-orders"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const total = formatPrice(order.totalMinor ?? 0, order.currency);

  if (config.isLoading) return <p className="text-sm text-muted-foreground">Cargando métodos de pago…</p>;
  if (config.isError || !config.data) return <FormError message="No se pudo cargar la configuración de pago." />;

  if (config.data.provider !== "simulated") {
    return (
      <div className="space-y-2 rounded-lg border p-4">
        <p className="font-medium">Pago con tarjeta ({config.data.provider})</p>
        <p className="text-sm text-muted-foreground">
          El formulario de tarjeta de esta pasarela todavía no está integrado en la interfaz. El backend ya está listo para recibir el token (ver ADR 0007).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div>
        <p className="font-medium">Pago de prueba</p>
        <p className="text-sm text-muted-foreground">Pasarela simulada: no se mueve dinero. Elige el resultado que quieres probar.</p>
      </div>
      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="sr-only">Resultado de la prueba</legend>
        {SIMULATED_CARDS.map((card) => (
          <label key={card.token} className={`flex cursor-pointer flex-col rounded-md border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-accent`}>
            <span className="flex items-center gap-2 font-medium">
              <input type="radio" name="simulated-card" value={card.token} checked={token === card.token} onChange={() => setToken(card.token)} />
              {card.label}
            </span>
            <span className="pl-6 text-muted-foreground">{card.hint}</span>
          </label>
        ))}
      </fieldset>

      {result?.status === "FAILED" && (
        <p role="alert" className="text-sm text-destructive">
          El pago fue rechazado{result.failureMessage ? `: ${result.failureMessage}` : ""}. Puedes intentarlo de nuevo.
        </p>
      )}
      {result?.status === "PENDING" && (
        <p role="status" className="text-sm text-muted-foreground">
          Estamos esperando la confirmación de tu pago. Esta página se actualizará sola.
        </p>
      )}
      <FormError message={error} />
      <Button onClick={() => charge.mutate()} disabled={charge.isPending || result?.status === "PENDING"} className="w-full sm:w-auto">
        {charge.isPending ? "Procesando…" : `Pagar ${total}`}
      </Button>
    </div>
  );
}
