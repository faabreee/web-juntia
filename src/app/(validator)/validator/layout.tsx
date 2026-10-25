import { Suspense } from "react";

import { ValidatorShell } from "@/components/validator/validator-shell";

// Depende de la sesión del usuario (cliente): no se valida como navegación instantánea.
export const instant = false;

export default function ValidatorLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <ValidatorShell>{children}</ValidatorShell>
    </Suspense>
  );
}
