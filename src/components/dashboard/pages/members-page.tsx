"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Field, FormError } from "@/components/auth/auth-card";
import { useDashboard } from "@/components/dashboard/org-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  changeRole,
  inviteMember,
  listInvitations,
  listMembers,
  removeMember,
  revokeInvitation,
} from "@/lib/api";
import type { InvitationResponse, MemberResponse } from "@/lib/api";
import { errorMessage } from "@/lib/api-client";

type Member = Required<MemberResponse>;
type Invitation = Required<InvitationResponse>;
type AssignableRole = "ADMIN" | "MEMBER";

const ROLE_LABEL = { OWNER: "Propietario", ADMIN: "Administrador", MEMBER: "Miembro" } as const;

export function MembersPage() {
  const { organization, user } = useDashboard();
  const queryClient = useQueryClient();
  const orgId = organization?.id ?? "";
  const myRole = organization?.role;
  const canManage = myRole === "OWNER" || myRole === "ADMIN";
  const isOwner = myRole === "OWNER";

  const membersKey = ["members", orgId];
  const invitationsKey = ["invitations", orgId];

  const members = useQuery({
    queryKey: membersKey,
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await listMembers({ path: { organizationId: orgId } });
      if (error || !data) throw new Error(errorMessage(error));
      return data as Member[];
    },
  });

  const invitations = useQuery({
    queryKey: invitationsKey,
    enabled: !!orgId && canManage,
    queryFn: async () => {
      const { data, error } = await listInvitations({ path: { organizationId: orgId } });
      if (error || !data) throw new Error(errorMessage(error));
      return data as Invitation[];
    },
  });

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AssignableRole>("MEMBER");
  const [inviteError, setInviteError] = useState<string | null>(null);

  const invite = useMutation({
    mutationFn: async () => {
      const { error } = await inviteMember({
        path: { organizationId: orgId },
        body: { email: inviteEmail, role: inviteRole },
      });
      if (error) throw new Error(errorMessage(error));
    },
    onSuccess: () => {
      toast.success(`Invitación enviada a ${inviteEmail}`);
      setInviteEmail("");
      setInviteError(null);
      queryClient.invalidateQueries({ queryKey: invitationsKey });
    },
    onError: (e: Error) => setInviteError(e.message),
  });

  const onActionError = (e: Error) => toast.error(e.message);

  const updateRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AssignableRole }) => {
      const { error } = await changeRole({ path: { organizationId: orgId, userId }, body: { role } });
      if (error) throw new Error(errorMessage(error));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: membersKey }),
    onError: onActionError,
  });

  const remove = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await removeMember({ path: { organizationId: orgId, userId } });
      if (error) throw new Error(errorMessage(error));
    },
    onSuccess: () => {
      toast.success("Miembro eliminado");
      queryClient.invalidateQueries({ queryKey: membersKey });
    },
    onError: onActionError,
  });

  const revoke = useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await revokeInvitation({ path: { organizationId: orgId, invitationId } });
      if (error) throw new Error(errorMessage(error));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: invitationsKey }),
    onError: onActionError,
  });

  if (!organization) return null;

  function canRemove(m: Member) {
    if (m.role === "OWNER") return false;
    if (m.userId === user.id) return true; // salir
    return isOwner || (myRole === "ADMIN" && m.role === "MEMBER");
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Miembros</h1>
        <p className="text-muted-foreground">Equipo de {organization.name}.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Equipo</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Correo</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.data?.map((m) => (
                <TableRow key={m.userId}>
                  <TableCell className="font-medium">{m.displayName}</TableCell>
                  <TableCell>{m.email}</TableCell>
                  <TableCell>
                    {isOwner && m.role !== "OWNER" ? (
                      <Select value={m.role} onValueChange={(role) => updateRole.mutate({ userId: m.userId, role: role as AssignableRole })}>
                        <SelectTrigger size="sm" className="w-40" aria-label={`Rol de ${m.displayName}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ADMIN">Administrador</SelectItem>
                          <SelectItem value="MEMBER">Miembro</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant={m.role === "OWNER" ? "default" : "secondary"}>{ROLE_LABEL[m.role]}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {canRemove(m) && (
                      <Button variant="ghost" size="sm" onClick={() => remove.mutate(m.userId)} disabled={remove.isPending}>
                        {m.userId === user.id ? "Salir" : "Quitar"}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {members.isError && <p className="pt-4 text-sm text-destructive">No se pudieron cargar los miembros.</p>}
        </CardContent>
      </Card>

      {canManage && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Invitar</CardTitle>
              <CardDescription>La persona recibirá un correo y debe entrar con ese mismo correo para aceptar.</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setInviteError(null);
                  invite.mutate();
                }}
                className="flex flex-col gap-4 sm:flex-row sm:items-end"
              >
                <div className="flex-1">
                  <Field id="invite-email" label="Correo" type="email" required value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Rol</Label>
                  <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as AssignableRole)}>
                    <SelectTrigger className="w-40" aria-label="Rol de la invitación">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MEMBER">Miembro</SelectItem>
                      <SelectItem value="ADMIN">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" disabled={invite.isPending}>
                  {invite.isPending ? "Enviando…" : "Enviar invitación"}
                </Button>
              </form>
              <div className="pt-2">
                <FormError message={inviteError} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Invitaciones pendientes</CardTitle>
            </CardHeader>
            <CardContent>
              {invitations.data?.length === 0 && <p className="text-sm text-muted-foreground">No hay invitaciones pendientes.</p>}
              <ul className="divide-y">
                {invitations.data?.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-4 py-3">
                    <div>
                      <p className="font-medium">{i.email}</p>
                      <p className="text-sm text-muted-foreground">
                        {ROLE_LABEL[i.role]} · vence {new Date(i.expiresAt).toLocaleDateString("es")}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => revoke.mutate(i.id)} disabled={revoke.isPending}>
                      Revocar
                    </Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
