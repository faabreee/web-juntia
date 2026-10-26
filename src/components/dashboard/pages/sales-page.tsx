"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { FormError } from "@/components/auth/auth-card";
import { OrderStatusBadge } from "@/components/buyer/order-status-badge";
import { useDashboard } from "@/components/dashboard/org-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listSales, refundOrder, resendTicketsAsOrganizer } from "@/lib/api";
import type { RefundRequest, SaleResponse } from "@/lib/api";
import { errorMessage } from "@/lib/api-client";
import { formatPrice, minorToPriceText, priceToMinor } from "@/lib/tickets";

type Reason = RefundRequest["reason"];
const REASONS: { id: Reason; label: string }[] = [
  { id: "REQUESTED_BY_BUYER", label: "Lo pidió el comprador" },
  { id: "EVENT_CANCELLED", label: "Evento cancelado" },
  { id: "DUPLICATE", label: "Compra duplicada" },
  { id: "FRAUDULENT", label: "Fraude" },
  { id: "OTHER", label: "Otro" },
];

export function SalesPage() {
  const { organization } = useDashboard();
  const queryClient = useQueryClient();
  const orgId = organization?.id ?? "";
  const canManage = organization?.role === "OWNER" || organization?.role === "ADMIN";
  const key = ["sales", orgId];

  const sales = useQuery({
    queryKey: key,
    enabled: !!orgId && canManage,
    queryFn: async (): Promise<SaleResponse[]> => {
      const { data, error } = await listSales({ path: { organizationId: orgId } });
      if (error || !data) throw new Error(errorMessage(error));
      return data;
    },
  });

  const [target, setTarget] = useState<SaleResponse | null>(null);
  const [mode, setMode] = useState<"full" | "partial">("full");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState<Reason>("REQUESTED_BY_BUYER");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Una clave por intento de reembolso: un doble clic no reembolsa dos veces.
  const keyRef = useRef<string | null>(null);

  function open(sale: SaleResponse) {
    setTarget(sale);
    setMode("full");
    setAmount(minorToPriceText(sale.refundableMinor ?? 0, sale.currency));
    setReason("REQUESTED_BY_BUYER");
    setNote("");
    setError(null);
    keyRef.current = crypto.randomUUID();
  }

  const refund = useMutation({
    mutationFn: async () => {
      if (!target) return;
      const refundable = target.refundableMinor ?? 0;
      const minor = mode === "full" ? undefined : priceToMinor(amount, target.currency);
      if (mode === "partial" && (minor === null || minor === undefined || minor < 1 || minor > refundable)) {
        throw new Error(`Ingresa un monto entre 0,01 y ${formatPrice(refundable, target.currency)}`);
      }
      const { error } = await refundOrder({
        path: { organizationId: orgId, orderId: target.orderId },
        headers: { "Idempotency-Key": keyRef.current ?? crypto.randomUUID() },
        body: { amountMinor: minor ?? undefined, reason, note: note || undefined },
      });
      if (error) throw new Error(errorMessage(error));
    },
    onSuccess: () => {
      toast.success("Reembolso realizado");
      setTarget(null);
      queryClient.invalidateQueries({ queryKey: key });
    },
    onError: (e: Error) => {
      setError(e.message);
      keyRef.current = crypto.randomUUID(); // un fallo no debe bloquear el reintento con otro monto
    },
  });

  const resend = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await resendTicketsAsOrganizer({ path: { organizationId: orgId, orderId } });
      if (error) throw new Error(errorMessage(error));
    },
    onSuccess: () => toast.success("Reenviando los boletos al comprador"),
    onError: (e: Error) => toast.error(e.message),
  });

  if (!organization) return null;
  if (!canManage) {
    return <p className="text-muted-foreground">Solo los propietarios y administradores pueden ver las ventas.</p>;
  }

  const fmt = new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ventas</h1>
        <p className="text-muted-foreground">Órdenes de {organization.name} y reembolsos.</p>
      </div>
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Comprador</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead className="text-right">Comisión</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Reembolsado</TableHead>
                <TableHead className="w-56" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.data?.map((s) => (
                <TableRow key={s.orderId}>
                  <TableCell>
                    <span className="font-medium">{s.buyerName}</span>
                    <span className="block text-xs text-muted-foreground">{s.buyerEmail}</span>
                    <span className="block text-xs text-muted-foreground">{fmt.format(new Date(s.createdAt))}</span>
                  </TableCell>
                  <TableCell>{s.eventTitle}</TableCell>
                  <TableCell>
                    <OrderStatusBadge status={s.status as "PENDING" | "PAID" | "EXPIRED" | "CANCELLED" | "REFUNDED"} />
                  </TableCell>
                  <TableCell className="text-right">{formatPrice(s.subtotalMinor ?? 0, s.currency)}</TableCell>
                  <TableCell className="text-right">
                    {formatPrice(s.feeMinor ?? 0, s.currency)}
                    <span className="block text-xs text-muted-foreground">{s.feeMode === "ABSORBED" ? "la absorbes tú" : "la paga el comprador"}</span>
                  </TableCell>
                  <TableCell className="text-right">{formatPrice(s.totalMinor ?? 0, s.currency)}</TableCell>
                  <TableCell className="text-right">{(s.refundedMinor ?? 0) > 0 ? formatPrice(s.refundedMinor ?? 0, s.currency) : "—"}</TableCell>
                  <TableCell className="text-right">
                    {s.status === "PAID" && (
                      <Button variant="ghost" size="sm" onClick={() => resend.mutate(s.orderId)} disabled={resend.isPending}>
                        Reenviar boletos
                      </Button>
                    )}
                    {(s.refundableMinor ?? 0) > 0 && (
                      <Button variant="outline" size="sm" onClick={() => open(s)}>
                        Reembolsar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {sales.data?.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Aún no hay ventas.</p>}
          {sales.isError && <p className="pt-4 text-sm text-destructive">No se pudieron cargar las ventas.</p>}
        </CardContent>
      </Card>

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          {target && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);
                refund.mutate();
              }}
              className="space-y-4"
            >
              <DialogHeader>
                <DialogTitle>Reembolsar a {target.buyerName}</DialogTitle>
                <DialogDescription>
                  Se pueden reembolsar hasta {formatPrice(target.refundableMinor ?? 0, target.currency)}. Un reembolso total cancela las entradas y las devuelve al inventario.
                </DialogDescription>
              </DialogHeader>
              <div className="flex gap-4" role="radiogroup" aria-label="Tipo de reembolso">
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="refund-mode" checked={mode === "full"} onChange={() => setMode("full")} /> Total
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="refund-mode" checked={mode === "partial"} onChange={() => setMode("partial")} /> Parcial
                </label>
              </div>
              {mode === "partial" && (
                <div className="space-y-2">
                  <Label htmlFor="refund-amount">Monto ({target.currency})</Label>
                  <Input id="refund-amount" inputMode="decimal" required value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
              )}
              <div className="space-y-2">
                <Label>Motivo</Label>
                <Select value={reason} onValueChange={(v) => setReason(v as Reason)}>
                  <SelectTrigger className="w-full" aria-label="Motivo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REASONS.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="refund-note">Nota (opcional)</Label>
                <Input id="refund-note" maxLength={255} value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
              <FormError message={error} />
              <DialogFooter>
                <Button type="submit" variant="destructive" disabled={refund.isPending}>
                  {refund.isPending ? "Reembolsando…" : "Confirmar reembolso"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
