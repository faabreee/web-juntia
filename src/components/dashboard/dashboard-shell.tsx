"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { DashboardProvider } from "@/components/dashboard/org-context";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useMe, useOrganizations } from "@/lib/queries";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: user, isLoading: loadingUser } = useMe();
  const { data: organizations, isLoading: loadingOrgs, isError } = useOrganizations(!!user);

  const noOrganizations = !!organizations && organizations.length === 0;

  useEffect(() => {
    if (!loadingUser && !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    } else if (noOrganizations && pathname !== "/organizations/new") {
      router.replace("/organizations/new");
    }
  }, [loadingUser, user, noOrganizations, pathname, router]);

  if (loadingUser || loadingOrgs || !user) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <Skeleton className="h-32 w-full max-w-md" />
      </div>
    );
  }
  if (isError || !organizations) {
    return <p className="p-8 text-sm text-destructive">No se pudo cargar tu información. Recarga la página.</p>;
  }

  return (
    <DashboardProvider user={user} organizations={organizations}>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-14 items-center gap-2 border-b px-4">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-5" />
          </header>
          <div className="flex-1 p-4 md:p-6">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </DashboardProvider>
  );
}
