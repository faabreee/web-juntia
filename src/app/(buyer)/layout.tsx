import { Suspense } from "react";

import { BuyerShell } from "@/components/buyer/buyer-shell";

// Depende de la sesión del usuario (cliente): no se valida como navegación instantánea.
export const instant = false;

export default function BuyerLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <BuyerShell>{children}</BuyerShell>
    </Suspense>
  );
}
