import { Badge } from "@/components/ui/badge";

const LABEL = { PENDING: "Pendiente de pago", PAID: "Confirmada", EXPIRED: "Expirada", CANCELLED: "Cancelada", REFUNDED: "Reembolsada" } as const;
const VARIANT = { PENDING: "secondary", PAID: "default", EXPIRED: "outline", CANCELLED: "outline", REFUNDED: "outline" } as const;

export function OrderStatusBadge({ status }: { status: keyof typeof LABEL }) {
  return <Badge variant={VARIANT[status]}>{LABEL[status]}</Badge>;
}
