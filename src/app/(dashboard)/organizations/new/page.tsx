"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Field, FormError } from "@/components/auth/auth-card";
import { useDashboard, storeCurrentOrganization } from "@/components/dashboard/org-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createOrganization } from "@/lib/api";
import { errorMessage } from "@/lib/api-client";
import { organizationsKey } from "@/lib/queries";

// Países con su moneda habitual; el usuario puede cambiar la moneda después.
const COUNTRIES: Record<string, string> = {
  AR: "ARS", BO: "BOB", BR: "BRL", CL: "CLP", CO: "COP", CR: "CRC", EC: "USD", ES: "EUR",
  GT: "GTQ", MX: "MXN", PA: "USD", PE: "PEN", PY: "PYG", US: "USD", UY: "UYU",
};

export default function NewOrganizationPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { organizations } = useDashboard();

  const [name, setName] = useState("");
  const [type, setType] = useState<"PERSON" | "COMPANY">("COMPANY");
  const [country, setCountry] = useState("PE");
  const [currency, setCurrency] = useState("PEN");
  const [timezone, setTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const countryNames = useMemo(() => new Intl.DisplayNames(["es"], { type: "region" }), []);
  const timezones = useMemo(() => Intl.supportedValuesOf("timeZone"), []);
  const currencies = useMemo(() => Intl.supportedValuesOf("currency"), []);

  function onCountryChange(code: string) {
    setCountry(code);
    setCurrency(COUNTRIES[code] ?? currency);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { data, error } = await createOrganization({ body: { name, type, country, currency, timezone } });
    if (error || !data) {
      setPending(false);
      setError(errorMessage(error));
      return;
    }
    if (data.id) storeCurrentOrganization(data.id);
    await queryClient.invalidateQueries({ queryKey: organizationsKey });
    router.push("/dashboard");
  }

  return (
    <div className="mx-auto max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle>{organizations.length === 0 ? "Crea tu primera organización" : "Nueva organización"}</CardTitle>
          <CardDescription>Aquí vivirán tus eventos, tu equipo y tus ventas.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <Field id="name" label="Nombre" required minLength={2} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />

            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as "PERSON" | "COMPANY")}>
                <SelectTrigger className="w-full" aria-label="Tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="COMPANY">Empresa</SelectItem>
                  <SelectItem value="PERSON">Persona</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>País</Label>
              <Select value={country} onValueChange={onCountryChange}>
                <SelectTrigger className="w-full" aria-label="País">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(COUNTRIES).map((code) => (
                    <SelectItem key={code} value={code}>
                      {countryNames.of(code)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Moneda</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="w-full" aria-label="Moneda">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Zona horaria</Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger className="w-full" aria-label="Zona horaria">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {timezones.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {tz}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <FormError message={error} />
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Creando…" : "Crear organización"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
