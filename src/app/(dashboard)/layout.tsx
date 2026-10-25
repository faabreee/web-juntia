import { DashboardShell } from "@/components/dashboard/dashboard-shell";

// El panel depende de la sesión del usuario (cliente), así que no se valida como navegación instantánea.
export const instant = false;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
