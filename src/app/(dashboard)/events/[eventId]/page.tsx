import { Suspense } from "react";

import { EventEditorPage } from "@/components/dashboard/pages/event-editor-page";

// Depende de la sesión del usuario (cliente): no se valida como navegación instantánea.
export const instant = false;

export default function Page() {
  return (
    <Suspense>
      <EventEditorPage />
    </Suspense>
  );
}
