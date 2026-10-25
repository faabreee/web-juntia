"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { FormError } from "@/components/auth/auth-card";
import { useDashboard } from "@/components/dashboard/org-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createVenue, deleteVenue, listVenues, updateVenue } from "@/lib/api";
import type { VenueResponse } from "@/lib/api";
import { errorMessage } from "@/lib/api-client";

type Draft = { id?: string; name: string; address: string; city: string; country: string; capacity: string };

const EMPTY: Draft = { name: "", address: "", city: "", country: "PE", capacity: "" };

export function VenuesPage() {
  const { organization } = useDashboard();
  const queryClient = useQueryClient();
  const orgId = organization?.id ?? "";
  const canManage = organization?.role === "OWNER" || organization?.role === "ADMIN";
  const key = ["venues", orgId];

  const venues = useQuery({
    queryKey: key,
    enabled: !!orgId,
    queryFn: async (): Promise<VenueResponse[]> => {
      const { data, error } = await listVenues({ path: { organizationId: orgId } });
      if (error || !data) throw new Error(errorMessage(error));
      return data;
    },
  });

  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async (d: Draft) => {
      const body = {
        name: d.name,
        address: d.address || undefined,
        city: d.city || undefined,
        country: d.country,
        capacity: d.capacity ? Number(d.capacity) : undefined,
      };
      const result = d.id
        ? await updateVenue({ path: { organizationId: orgId, venueId: d.id }, body })
        : await createVenue({ path: { organizationId: orgId }, body });
      if (result.error) throw new Error(errorMessage(result.error));
    },
    onSuccess: () => {
      setDraft(null);
      queryClient.invalidateQueries({ queryKey: key });
    },
    onError: (e: Error) => setError(e.message),
  });

  const remove = useMutation({
    mutationFn: async (venueId: string) => {
      const { error } = await deleteVenue({ path: { organizationId: orgId, venueId } });
      if (error) throw new Error(errorMessage(error));
    },
    onSuccess: () => {
      toast.success("Lugar eliminado");
      queryClient.invalidateQueries({ queryKey: key });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!organization) return null;

  function edit(v: VenueResponse) {
    setError(null);
    setDraft({ id: v.id, name: v.name, address: v.address ?? "", city: v.city ?? "", country: v.country, capacity: v.capacity ? String(v.capacity) : "" });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Lugares</h1>
          <p className="text-muted-foreground">Recintos donde se realizan tus sesiones.</p>
        </div>
        {canManage && (
          <Button
            onClick={() => {
              setError(null);
              setDraft({ ...EMPTY, country: organization.country });
            }}
          >
            Nuevo lugar
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Ciudad</TableHead>
                <TableHead>País</TableHead>
                <TableHead className="text-right">Aforo</TableHead>
                <TableHead className="w-40" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {venues.data?.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">
                    {v.name}
                    {v.address && <span className="block text-xs text-muted-foreground">{v.address}</span>}
                  </TableCell>
                  <TableCell>{v.city ?? "—"}</TableCell>
                  <TableCell>{v.country}</TableCell>
                  <TableCell className="text-right">{v.capacity ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    {canManage && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => edit(v)}>
                          Editar
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => remove.mutate(v.id)} disabled={remove.isPending}>
                          Eliminar
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {venues.data?.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Aún no tienes lugares.</p>}
          {venues.isError && <p className="pt-4 text-sm text-destructive">No se pudieron cargar los lugares.</p>}
        </CardContent>
      </Card>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent>
          {draft && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);
                save.mutate(draft);
              }}
              className="space-y-4"
            >
              <DialogHeader>
                <DialogTitle>{draft.id ? "Editar lugar" : "Nuevo lugar"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="venue-name">Nombre</Label>
                <Input id="venue-name" required maxLength={150} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="venue-address">Dirección</Label>
                <Input id="venue-address" maxLength={255} value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="venue-city">Ciudad</Label>
                  <Input id="venue-city" maxLength={100} value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="venue-country">País (código)</Label>
                  <Input id="venue-country" required maxLength={2} minLength={2} value={draft.country} onChange={(e) => setDraft({ ...draft, country: e.target.value.toUpperCase() })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="venue-capacity">Aforo</Label>
                  <Input id="venue-capacity" type="number" min={1} value={draft.capacity} onChange={(e) => setDraft({ ...draft, capacity: e.target.value })} />
                </div>
              </div>
              <FormError message={error} />
              <DialogFooter>
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending ? "Guardando…" : "Guardar"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
