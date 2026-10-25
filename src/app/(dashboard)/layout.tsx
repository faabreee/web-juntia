import { Suspense } from "react";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";

// El panel depende de la sesión del usuario (cliente), así que no se valida como navegación instantánea.
export const instant = false;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Suspense: el shell lee la ruta (usePathname), que en rutas dinámicas se resuelve en el navegador.
  return (
    <Suspense>
      <DashboardShell>{children}</DashboardShell>
    </Suspense>
  );
}
