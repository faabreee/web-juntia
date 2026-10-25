import { NewOrganizationPage } from "@/components/dashboard/pages/new-organization-page";

// Depende de la sesión del usuario (cliente): no se valida como navegación instantánea.
export const instant = false;

export default function Page() {
  return <NewOrganizationPage />;
}
