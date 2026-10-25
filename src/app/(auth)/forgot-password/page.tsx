"use client";

import Link from "next/link";
import { useState } from "react";

import { AuthCard, Field, FormError } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { forgotPassword } from "@/lib/api";
import { errorMessage } from "@/lib/api-client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { error } = await forgotPassword({ body: { email } });
    setPending(false);
    if (error) setError(errorMessage(error));
    else setSent(true);
  }

  return (
    <AuthCard
      title="Recuperar contraseña"
      description={sent ? "Si existe una cuenta con ese correo, te enviamos un enlace para elegir una nueva contraseña." : "Te enviaremos un enlace para elegir una nueva."}
      footer={
        <Link href="/login" className="underline">
          Volver a iniciar sesión
        </Link>
      }
    >
      {!sent && (
        <form onSubmit={onSubmit} className="space-y-4">
          <Field id="email" label="Correo" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <FormError message={error} />
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Enviando…" : "Enviar enlace"}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
