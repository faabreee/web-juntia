"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe } from "@/lib/queries";

/** Marco del modo validador: exige sesión y registra el service worker (solo en producción) para que sea instalable. */
export function ValidatorShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: user, isLoading } = useMe();

  useEffect(() => {
    if (!isLoading && !user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [isLoading, user, pathname, router]);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/validator" }).catch(() => undefined);
    }
  }, []);

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
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3 px-4 py-2">
          <Link href="/validator" className="font-semibold tracking-tight">
            Juntia · Validador
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
              Panel
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-xl flex-1 p-4">{children}</main>
    </div>
  );
}
