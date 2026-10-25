import { OverviewPage } from "@/components/dashboard/pages/overview-page";

// Depende de la sesión del usuario (cliente): no se valida como navegación instantánea.
export const instant = false;

export default function Page() {
  return <OverviewPage />;
}
