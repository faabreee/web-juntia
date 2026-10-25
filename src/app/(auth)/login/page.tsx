"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";

import { AuthCard, Field, FormError } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { login, resendVerification } from "@/lib/api";
import { errorMessage } from "@/lib/api-client";
import { meKey } from "@/lib/queries";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setNeedsVerification(false);
    const { data, error, response } = await login({ body: { email, password } });
    setPending(false);
    if (response?.status === 403) {
      setNeedsVerification(true);
      setError(errorMessage(error, "Debes verificar tu correo antes de entrar."));
      return;
    }
    if (error || !data) {
      setError(errorMessage(error, "Credenciales inválidas."));
      return;
    }
    queryClient.setQueryData(meKey, data);
    const next = params.get("next");
    router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
  }

  async function resend() {
    await resendVerification({ body: { email } });
    toast.success("Si la cuenta existe, te enviamos un nuevo enlace.");
  }

  return (
    <AuthCard
      title="Iniciar sesión"
      description="Entra a tu panel de organizador."
      footer={
        <>
          <Link href="/forgot-password" className="underline">
            ¿Olvidaste tu contraseña?
          </Link>
          <span>
            ¿No tienes cuenta?{" "}
            <Link href="/register" className="underline">
              Regístrate
            </Link>
          </span>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field id="email" label="Correo" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field id="password" label="Contraseña" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <FormError message={error} />
        {needsVerification && (
          <Button type="button" variant="outline" className="w-full" onClick={resend}>
            Reenviar correo de verificación
          </Button>
        )}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Entrando…" : "Entrar"}
        </Button>
      </form>
    </AuthCard>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
