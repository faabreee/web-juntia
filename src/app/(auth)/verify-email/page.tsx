"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

import { AuthCard } from "@/components/auth/auth-card";
import { buttonVariants } from "@/components/ui/button";
import { verifyEmail } from "@/lib/api";
import { errorMessage } from "@/lib/api-client";

function Verify() {
  const token = useSearchParams().get("token");
  const started = useRef(false);
  const [state, setState] = useState<"loading" | "ok" | "error">(token ? "loading" : "error");
  const [message, setMessage] = useState(token ? "" : "Falta el token de verificación.");

  useEffect(() => {
    // El token es de un solo uso: evita la doble ejecución de React en desarrollo.
    if (!token || started.current) return;
    started.current = true;
    verifyEmail({ body: { token } }).then(({ error }) => {
      if (error) {
        setState("error");
        setMessage(errorMessage(error, "Enlace inválido o expirado."));
      } else {
        setState("ok");
      }
    });
  }, [token]);

  return (
    <AuthCard
      title={state === "ok" ? "Correo verificado" : state === "error" ? "No se pudo verificar" : "Verificando…"}
      description={state === "ok" ? "Ya puedes iniciar sesión." : message}
    >
      {state !== "loading" && (
        <Link href="/login" className={buttonVariants({ className: "w-full" })}>
          Ir a iniciar sesión
        </Link>
      )}
    </AuthCard>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <Verify />
    </Suspense>
  );
}
