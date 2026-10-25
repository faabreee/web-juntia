"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

import type { CurrentUser, Organization } from "@/lib/queries";

const STORAGE_KEY = "juntia.currentOrganization";

export function storeCurrentOrganization(id: string) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // almacenamiento no disponible: se usa la primera organización
  }
}

function readStoredOrganization(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

type DashboardContextValue = {
  user: CurrentUser;
  organizations: Organization[];
  /** Organización seleccionada; null si el usuario aún no tiene ninguna. */
  organization: Organization | null;
  selectOrganization: (id: string) => void;
};

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({
  user,
  organizations,
  children,
}: {
  user: CurrentUser;
  organizations: Organization[];
  children: React.ReactNode;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(() => readStoredOrganization());

  const organization = useMemo(
    () => organizations.find((o) => o.id === selectedId) ?? organizations[0] ?? null,
    [organizations, selectedId],
  );

  const selectOrganization = useCallback((id: string) => {
    storeCurrentOrganization(id);
    setSelectedId(id);
  }, []);

  const value = useMemo(
    () => ({ user, organizations, organization, selectOrganization }),
    [user, organizations, organization, selectOrganization],
  );
  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard debe usarse dentro de DashboardProvider");
  return ctx;
}
