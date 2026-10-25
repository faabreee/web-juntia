"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { AuthCard, Field, FormError } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { resetPassword } from "@/lib/api";
import { errorMessage } from "@/lib/api-client";

function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(token ? null : "Falta el token de recuperación.");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { error } = await resetPassword({ body: { token, password } });
    setPending(false);
    if (error) setError(errorMessage(error, "Enlace inválido o expirado."));
    else setDone(true);
  }

  if (done) {
    return (
      <AuthCard title="Contraseña actualizada" description="Cerramos tus otras sesiones. Inicia sesión con tu nueva contraseña.">
        <Link href="/login" className="text-sm underline">
          Ir a iniciar sesión
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Nueva contraseña" description="Elige una contraseña de al menos 10 caracteres.">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field id="password" label="Nueva contraseña" type="password" autoComplete="new-password" required minLength={10} maxLength={72} value={password} onChange={(e) => setPassword(e.target.value)} />
        <FormError message={error} />
        <Button type="submit" className="w-full" disabled={pending || !token}>
          {pending ? "Guardando…" : "Guardar contraseña"}
        </Button>
      </form>
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
