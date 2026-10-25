"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { logout } from "@/lib/api";
import { meKey, useMe } from "@/lib/queries";

/** Marco para compradores: cualquier cuenta con sesión, sin necesidad de pertenecer a una organización. */
export function BuyerShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useMe();

  useEffect(() => {
    if (!isLoading && !user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [isLoading, user, pathname, router]);

  async function onLogout() {
    await logout();
    queryClient.setQueryData(meKey, null);
    router.replace("/login");
  }

  if (isLoading || !user) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <Skeleton className="h-32 w-full max-w-md" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-4">
            <Link href="/orders" className="font-semibold tracking-tight">
              Juntia
            </Link>
            <Link href="/orders" className="text-sm text-muted-foreground hover:text-foreground">
              Mis órdenes
            </Link>
            <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
              Panel de organizador
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground sm:inline">{user.displayName}</span>
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={onLogout}>
              Cerrar sesión
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 p-4 md:py-8">{children}</main>
    </div>
  );
}
