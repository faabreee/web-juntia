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
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2">
          <Link href="/tickets" className="font-semibold tracking-tight">
            Juntia
          </Link>
          {/* En el celular los enlaces bajan a su propia fila; en pantallas anchas van junto a la marca. */}
          <nav aria-label="Principal" className="order-3 flex w-full gap-4 overflow-x-auto whitespace-nowrap pb-1 text-sm sm:order-none sm:w-auto sm:flex-1 sm:pb-0">
            <Link href="/tickets" className="text-muted-foreground hover:text-foreground">
              Mis boletos
            </Link>
            <Link href="/orders" className="text-muted-foreground hover:text-foreground">
              Mis órdenes
            </Link>
            <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
              Panel de organizador
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground md:inline">{user.displayName}</span>
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
