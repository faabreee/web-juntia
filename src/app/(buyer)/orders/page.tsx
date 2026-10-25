"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { OrderStatusBadge } from "@/components/buyer/order-status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { listMyOrders } from "@/lib/api";
import type { OrderResponse } from "@/lib/api";
import { formatPrice } from "@/lib/tickets";

export default function OrdersPage() {
  const orders = useQuery({
    queryKey: ["my-orders"],
    queryFn: async (): Promise<OrderResponse[]> => {
      const { data, error } = await listMyOrders();
      if (error || !data) throw new Error("No se pudieron cargar tus órdenes");
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Mis órdenes</h1>
      {orders.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {orders.isError && <p className="text-sm text-destructive">No se pudieron cargar tus órdenes.</p>}
      {orders.data?.length === 0 && <p className="text-muted-foreground">Aún no tienes órdenes.</p>}
      <ul className="space-y-3">
        {orders.data?.map((o) => (
          <li key={o.id}>
            <Link href={`/orders/${o.id}`} className="block">
              <Card className="transition-colors hover:bg-accent">
                <CardContent className="flex items-center justify-between gap-4 pt-6">
                  <div className="space-y-1">
                    <p className="font-medium">{o.eventTitle}</p>
                    <p className="text-sm text-muted-foreground">
                      {o.items.reduce((n, i) => n + (i.quantity ?? 0), 0)} entrada(s) · {new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short" }).format(new Date(o.createdAt))}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="font-semibold">{formatPrice(o.totalMinor ?? 0, o.currency)}</span>
                    <OrderStatusBadge status={o.status} />
                  </div>
                </CardContent>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
