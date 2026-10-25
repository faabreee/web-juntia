"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { OrderStatusBadge } from "@/components/buyer/order-status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cancelOrder, getOrder } from "@/lib/api";
import type { OrderResponse } from "@/lib/api";
import { errorMessage } from "@/lib/api-client";
import { formatPrice } from "@/lib/tickets";

function useCountdown(expiresAt: string | undefined, active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  if (!expiresAt || !active) return null;
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000));
}

function format(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function OrderPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const queryClient = useQueryClient();
  const key = ["order", orderId];

  const order = useQuery({
    queryKey: key,
    queryFn: async (): Promise<OrderResponse> => {
      const { data, error } = await getOrder({ path: { orderId } });
      if (error || !data) throw new Error(errorMessage(error, "Orden no encontrada"));
      return data;
    },
    // Mientras está pendiente se revisa de vez en cuando: puede expirar o confirmarse.
    refetchInterval: (query) => (query.state.data?.status === "PENDING" ? 10_000 : false),
  });

  const pending = order.data?.status === "PENDING";
  const remaining = useCountdown(order.data?.expiresAt, pending);

  // Al llegar a cero, se vuelve a consultar el estado real.
  useEffect(() => {
    if (pending && remaining === 0) {
      const id = setTimeout(() => queryClient.invalidateQueries({ queryKey: key }), 2000);
      return () => clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, remaining, queryClient, orderId]);

  const cancel = useMutation({
    mutationFn: async () => {
      const { error } = await cancelOrder({ path: { orderId } });
      if (error) throw new Error(errorMessage(error));
    },
    onSuccess: () => {
      toast.success("Orden cancelada");
      queryClient.invalidateQueries({ queryKey: key });
      queryClient.invalidateQueries({ queryKey: ["my-orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (order.isLoading) return <Skeleton className="h-64 w-full" />;
  if (order.isError || !order.data) {
    return (
      <div className="space-y-4">
        <p className="text-destructive">No se encontró la orden.</p>
        <Link href="/orders" className="text-sm underline">
          Volver a mis órdenes
        </Link>
      </div>
    );
  }
  const o = order.data;

  return (
    <div className="space-y-6">
      <Link href="/orders" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
        ← Mis órdenes
      </Link>
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-3">
            {o.eventTitle} <OrderStatusBadge status={o.status} />
          </CardTitle>
          <CardDescription>Orden {o.id.slice(0, 8)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="divide-y">
            {o.items.map((i) => (
              <li key={i.ticketTypeId} className="flex items-center justify-between gap-4 py-2">
                <span>
                  {i.quantity ?? 0} × {i.name}
                </span>
                <span className="text-muted-foreground">{formatPrice((i.unitPriceMinor ?? 0) * (i.quantity ?? 0), o.currency)}</span>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between border-t pt-4 text-lg font-semibold">
            <span>Total</span>
            <span>{formatPrice(o.totalMinor ?? 0, o.currency)}</span>
          </div>

          {pending && (
            <div className="space-y-3 rounded-lg border p-4" role="status">
              <p className="font-medium">
                Tus entradas están reservadas
                {remaining !== null && (
                  <>
                    {" "}por <span className="tabular-nums">{format(remaining)}</span>
                  </>
                )}
                .
              </p>
              <p className="text-sm text-muted-foreground">Si no completas el pago a tiempo, la reserva se libera.</p>
              <div className="flex flex-wrap gap-2">
                <Button disabled title="El pago en línea estará disponible pronto">
                  Pagar (próximamente)
                </Button>
                <Button variant="outline" onClick={() => cancel.mutate()} disabled={cancel.isPending}>
                  Cancelar orden
                </Button>
              </div>
            </div>
          )}
          {o.status === "PAID" && (
            <p className="rounded-lg border border-primary/40 p-4 text-sm" role="status">
              {(o.totalMinor ?? 0) === 0 ? "Tus entradas gratuitas están confirmadas." : "Pago confirmado."} Tus boletos estarán disponibles pronto.
            </p>
          )}
          {o.status === "EXPIRED" && (
            <p className="text-sm text-muted-foreground" role="status">
              La reserva expiró y las entradas volvieron a estar disponibles.
            </p>
          )}
          {(o.status === "EXPIRED" || o.status === "CANCELLED") && (
            <Link href={`/e/${o.eventSlug}`} className={buttonVariants({ variant: "outline" })}>
              Volver al evento
            </Link>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
