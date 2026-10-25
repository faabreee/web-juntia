"use client";

import { useDashboard } from "@/components/dashboard/org-context";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const ROLE_LABEL = { OWNER: "Propietario", ADMIN: "Administrador", MEMBER: "Miembro" } as const;

export function OverviewPage() {
  const { organization, user } = useDashboard();
  if (!organization) return null;

  const details = [
    ["Tipo", organization.type === "COMPANY" ? "Empresa" : "Persona"],
    ["País", organization.country],
    ["Moneda", organization.currency],
    ["Zona horaria", organization.timezone],
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Hola, {user.displayName}</h1>
        <p className="text-muted-foreground">Este es el panel de {organization.name}.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {organization.name} <Badge variant="secondary">{ROLE_LABEL[organization.role]}</Badge>
          </CardTitle>
          <CardDescription>Datos de la organización</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            {details.map(([k, v]) => (
              <div key={k}>
                <dt className="text-sm text-muted-foreground">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
