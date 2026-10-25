import { Badge } from "@/components/ui/badge";

const LABEL = { DRAFT: "Borrador", PUBLISHED: "Publicado", CANCELLED: "Cancelado" } as const;
const VARIANT = { DRAFT: "secondary", PUBLISHED: "default", CANCELLED: "destructive" } as const;

export function EventStatusBadge({ status }: { status: keyof typeof LABEL }) {
  return <Badge variant={VARIANT[status]}>{LABEL[status]}</Badge>;
}
