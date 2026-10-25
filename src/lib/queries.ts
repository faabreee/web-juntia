"use client";

import { useQuery } from "@tanstack/react-query";

import { listMyOrganizations, me } from "@/lib/api";
import type { MeResponse, OrganizationResponse } from "@/lib/api";

export type CurrentUser = Required<MeResponse>;
export type Organization = Required<OrganizationResponse>;

export const meKey = ["me"] as const;
export const organizationsKey = ["organizations"] as const;

/** Usuario con sesión, o null si no hay sesión (401). */
export function useMe() {
  return useQuery({
    queryKey: meKey,
    queryFn: async (): Promise<CurrentUser | null> => {
      const { data, response } = await me();
      if (response?.status === 401 || !data) return null;
      return data as CurrentUser;
    },
    staleTime: 60_000,
  });
}

export function useOrganizations(enabled: boolean) {
  return useQuery({
    queryKey: organizationsKey,
    enabled,
    queryFn: async (): Promise<Organization[]> => {
      const { data, error } = await listMyOrganizations();
      if (error || !data) throw new Error("No se pudieron cargar las organizaciones");
      return data as Organization[];
    },
  });
}
