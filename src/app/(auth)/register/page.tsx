"use client";

import Link from "next/link";
import { useState } from "react";

import { AuthCard, Field, FormError } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { register } from "@/lib/api";
import { errorMessage } from "@/lib/api-client";

export default function RegisterPage() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { error } = await register({ body: { displayName, email, password } });
    setPending(false);
    if (error) {
      setError(errorMessage(error));
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <AuthCard
        title="Revisa tu correo"
        description={`Te enviamos un enlace de verificación a ${email}. Confírmalo para poder entrar.`}
        footer={
          <Link href="/login" className="underline">
            Ir a iniciar sesión
          </Link>
        }
      >
        <p className="text-sm text-muted-foreground">El enlace es válido por 24 horas.</p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Crear cuenta"
      description="Empieza a vender entradas con Juntia."
      footer={
        <span>
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="underline">
            Inicia sesión
          </Link>
        </span>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field id="displayName" label="Nombre" autoComplete="name" required maxLength={100} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        <Field id="email" label="Correo" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field id="password" label="Contraseña (mínimo 10 caracteres)" type="password" autoComplete="new-password" required minLength={10} maxLength={72} value={password} onChange={(e) => setPassword(e.target.value)} />
        <FormError message={error} />
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Creando…" : "Crear cuenta"}
        </Button>
      </form>
    </AuthCard>
  );
}
