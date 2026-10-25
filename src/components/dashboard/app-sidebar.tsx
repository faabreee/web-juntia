"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Building2, CalendarDays, ChevronsUpDown, LayoutDashboard, LogOut, MapPin, Plus, Receipt, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { useDashboard } from "@/components/dashboard/org-context";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { logout } from "@/lib/api";
import { meKey, organizationsKey } from "@/lib/queries";

const NAV = [
  { href: "/dashboard", label: "Resumen", icon: LayoutDashboard },
  { href: "/events", label: "Eventos", icon: CalendarDays },
  { href: "/sales", label: "Ventas", icon: Receipt },
  { href: "/venues", label: "Lugares", icon: MapPin },
  { href: "/members", label: "Miembros", icon: Users },
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, organizations, organization, selectOrganization } = useDashboard();

  async function onLogout() {
    await logout();
    queryClient.setQueryData(meKey, null);
    queryClient.removeQueries({ queryKey: organizationsKey });
    router.replace("/login");
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" aria-label="Cambiar organización">
                  <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                    <Building2 className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left leading-tight">
                    <span className="truncate text-sm font-medium">{organization?.name ?? "Sin organización"}</span>
                    <span className="truncate text-xs text-muted-foreground">{organization?.role ?? "Crea una para empezar"}</span>
                  </div>
                  <ChevronsUpDown className="size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuLabel>Organizaciones</DropdownMenuLabel>
                {organizations.map((o) => (
                  <DropdownMenuItem key={o.id} onClick={() => selectOrganization(o.id)}>
                    <Building2 /> <span className="truncate">{o.name}</span>
                    {o.id === organization?.id && <span className="ml-auto text-xs text-muted-foreground">Actual</span>}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push("/organizations/new")}>
                  <Plus /> Crear organización
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map(({ href, label, icon: Icon }) => (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton asChild isActive={pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`))}>
                    <Link href={href}>
                      <Icon />
                      <span>{label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton size="lg" className="flex-1" aria-label="Menú de usuario">
                <Avatar className="size-8">
                  <AvatarFallback>{initials(user.displayName)}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-sm font-medium">{user.displayName}</span>
                  <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                </div>
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem onClick={onLogout}>
                <LogOut /> Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <ThemeToggle />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
