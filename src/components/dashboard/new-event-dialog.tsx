"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { FormError } from "@/components/auth/auth-card";
import { useDashboard } from "@/components/dashboard/org-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createEvent } from "@/lib/api";
import { errorMessage } from "@/lib/api-client";

export function NewEventDialog() {
  const router = useRouter();
  const { organization } = useDashboard();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!organization) return;
    setPending(true);
    setError(null);
    const { data, error } = await createEvent({
      path: { organizationId: organization.id },
      body: { title, description, timezone: organization.timezone },
    });
    setPending(false);
    if (error || !data) {
      setError(errorMessage(error));
      return;
    }
    setOpen(false);
    router.push(`/events/${data.id}`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Nuevo evento</Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Nuevo evento</DialogTitle>
            <DialogDescription>Se crea como borrador. Luego agregas sesiones, portada y lo publicas.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="event-title">Título</Label>
            <Input id="event-title" required minLength={3} maxLength={150} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="event-description">Descripción</Label>
            <Textarea id="event-description" rows={4} maxLength={10000} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <FormError message={error} />
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Creando…" : "Crear borrador"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
