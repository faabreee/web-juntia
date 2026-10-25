"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

import { AuthCard } from "@/components/auth/auth-card";
import { buttonVariants } from "@/components/ui/button";
import { acceptInvitation } from "@/lib/api";
import { errorMessage } from "@/lib/api-client";
import { organizationsKey, useMe } from "@/lib/queries";
import { storeCurrentOrganization } from "@/components/dashboard/org-context";

function Accept() {
  const router = useRouter();
  const token = useSearchParams().get("token");
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useMe();
  const started = useRef(false);
  const [error, setError] = useState<string | null>(token ? null : "Falta el token de invitación.");

  useEffect(() => {
    if (isLoading || !token) return;
    if (!user) {
      const next = `/accept-invitation?token=${encodeURIComponent(token)}`;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
      return;
    }
    if (started.current) return;
    started.current = true; // el token es de un solo uso
    acceptInvitation({ body: { token } }).then(async ({ data, error }) => {
      if (error || !data) {
        setError(errorMessage(error, "Invitación inválida o expirada."));
        return;
      }
      if (data.id) storeCurrentOrganization(data.id);
      await queryClient.invalidateQueries({ queryKey: organizationsKey });
      router.replace("/dashboard");
    });
  }, [isLoading, user, token, router, queryClient]);

  return (
    <AuthCard
      title={error ? "No se pudo aceptar la invitación" : "Aceptando invitación…"}
      description={error ?? "Un momento, te estamos agregando a la organización."}
    >
      {error && (
        <Link href="/dashboard" className={buttonVariants({ className: "w-full" })}>
          Ir al panel
        </Link>
      )}
    </AuthCard>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense>
      <Accept />
    </Suspense>
  );
}
