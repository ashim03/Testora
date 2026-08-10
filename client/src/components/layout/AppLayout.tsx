import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LogOut, Bell, ChevronLeft, ChevronRight, Search, Sun, Moon, Monitor, MessageSquare, LayoutDashboard, User, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuthStore } from "../../store/auth";
import { useBrandingStore, type Branding } from "../../store/branding";
import { navGroupsFor, homePathForRole } from "../../config/navigation";
import { cn, initialOf } from "../../utils";
import { apiGet, apiPost } from "../../api/client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { useTheme } from "../../hooks/useTheme";
import { PageSpinner } from "../ui/feedback";

interface NotificationRow {
  _id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  useActiveBranding();

  return (
    <div className="min-h-screen bg-background">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <div className={cn("flex min-h-screen flex-col transition-all", collapsed ? "lg:pl-16" : "lg:pl-60")}>
        <Topbar />
        <main className="flex-1 px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:pb-6">{children}</main>
      </div>
    </div>
  );
}

function useActiveBranding() {
  const setBranding = useBrandingStore((s) => s.setBranding);
  const loaded = useBrandingStore((s) => s.loaded);
  const user = useAuthStore((s) => s.user);
  useEffect(() => {
    if (!user || loaded) return;
    apiGet<Branding>("/branding")
      .then((res) => setBranding(res.data ?? null))
      .catch(() => setBranding(null));
  }, [user, loaded, setBranding]);
}

function Brand({ compact }: { compact: boolean }) {
  const branding = useBrandingStore((s) => s.branding);
  if (branding?.logoUrl) {
    return (
      <img
        src={branding.logoUrl}
        alt={branding.name || "logo"}
        className={cn("size-8 shrink-0 rounded-lg object-cover", compact && "mx-auto")}
      />
    );
  }
  return (
    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-600 to-accent-500 text-sm font-bold text-white", compact && "mx-auto")}>
      {branding?.name ? initialOf(branding.name) : "T"}
    </span>
  );
}

function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const user = useAuthStore((s) => s.user);
  const branding = useBrandingStore((s) => s.branding);
  const groups = navGroupsFor(user?.role);
  const navigate = useNavigate();

  const logout = async () => {
    await apiPost("/auth/logout").catch(() => undefined);
    useAuthStore.getState().logout();
    toast.success("Signed out");
    navigate("/login");
  };

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 hidden flex-col border-r bg-card transition-all lg:flex",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div className={cn("flex h-14 items-center gap-2 border-b px-4", collapsed && "justify-center px-0")}>
        <Brand compact={collapsed} />
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight">{branding?.name || "Testora"}</p>
            {branding?.tagline ? <p className="truncate text-[11px] text-muted-foreground">{branding.tagline}</p> : null}
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto scrollbar-thin p-3">
        {groups.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </p>
            )}
            <ul className="space-y-1">
              {group.items.map((item) => (
                <NavButton key={item.to} to={item.to} end={item.end} collapsed={collapsed} icon={item.icon} label={item.label} />
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t p-3">
        <ItemButton collapsed={collapsed} icon={collapsed ? ChevronRight : ChevronLeft} label="Collapse" onClick={onToggle} />
        <ItemButton collapsed={collapsed} icon={LogOut} label="Logout" onClick={logout} destructive />
      </div>
    </aside>
  );
}

function NavButton({
  to,
  end,
  collapsed,
  icon: Icon,
  label,
}: {
  to: string;
  end?: boolean;
  collapsed: boolean;
  icon: LucideIcon;
  label: string;
}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const current = end ? pathname === to : pathname.startsWith(to);
  return (
    <li>
      <button
        onClick={() => navigate(to)}
        title={label}
        aria-current={current ? "page" : undefined}
        className={cn(
          "flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-muted",
          current ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground",
          collapsed && "justify-center px-0",
        )}
      >
        <Icon className="size-4 shrink-0" />
        {!collapsed && <span className="truncate">{label}</span>}
      </button>
    </li>
  );
}

function ItemButton({
  collapsed,
  icon: Icon,
  label,
  onClick,
  destructive,
}: {
  collapsed: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "mb-1 flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted",
        destructive && "hover:text-destructive",
        collapsed && "justify-center px-0",
      )}
      title={label}
    >
      <Icon className="size-4 shrink-0" />
      {!collapsed && <span>{label}</span>}
    </button>
  );
}

function Topbar() {
  const user = useAuthStore((s) => s.user);
  const branding = useBrandingStore((s) => s.branding);
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const home = homePathForRole(user?.role);

  const logout = async () => {
    await apiPost("/auth/logout").catch(() => undefined);
    useAuthStore.getState().logout();
    navigate("/login");
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur sm:px-6">
      <div className="hidden min-w-0 items-center gap-2 md:flex">
        <Brand compact={false} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">{branding?.name || "Testora"}</p>
          <p className="truncate text-[11px] text-muted-foreground leading-tight">{branding?.tagline || (user?.role ?? "").toLowerCase()}</p>
        </div>
      </div>

      <form
        className="hidden w-64 sm:block"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`);
        }}
      >
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search..." className="pl-9" aria-label="Search" />
        </div>
      </form>

      <div className="ms-auto flex items-center gap-1">
        <ThemeToggle />
        <NotificationsDropdown />
        <Button variant="ghost" size="icon" aria-label="Messages" onClick={() => navigate(`${home}/notifications`)}>
          <MessageSquare className="size-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="ml-1 rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring" aria-label="Account menu">
              <Avatar>
                <AvatarImage src={user?.avatarUrl ?? undefined} />
                <AvatarFallback>{initialOf(user?.firstName)}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="px-2">
              <div className="font-semibold">{user?.firstName} {user?.lastName}</div>
              <div className="text-xs font-normal text-muted-foreground">{user?.email}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate(home)} className="px-2 py-1.5 text-sm outline-none hover:bg-muted cursor-pointer">
              <LayoutDashboard className="size-4" /> Dashboard
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate(`${home}/profile`)} className="px-2 py-1.5 text-sm outline-none hover:bg-muted cursor-pointer">
              <User className="size-4" /> My profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate(`${home}/notifications`)} className="px-2 py-1.5 text-sm outline-none hover:bg-muted cursor-pointer">
              <Bell className="size-4" /> Notifications
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate(`${home}/settings`)} className="px-2 py-1.5 text-sm outline-none hover:bg-muted cursor-pointer">
              <Settings className="size-4" /> Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="px-2 py-1.5 text-sm outline-none hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer text-destructive">
              <LogOut className="size-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Toggle theme">
          {theme === "dark" ? <Moon className="size-4" /> : theme === "light" ? <Sun className="size-4" /> : <Monitor className="size-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")} className="px-2 py-1.5 text-sm cursor-pointer">Light</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")} className="px-2 py-1.5 text-sm cursor-pointer">Dark</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")} className="px-2 py-1.5 text-sm cursor-pointer">System</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotificationsDropdown() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const home = homePathForRole(user?.role);

  const { data, isLoading } = useQuery({
    queryKey: ["header", "notifications"],
    queryFn: async () => {
      const res = await apiGet<NotificationRow[]>("/notifications", { limit: 5 });
      return res.data ?? [];
    },
    enabled: !!user,
  });

  const unread = data?.filter((n) => !n.read).length ?? 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
              {unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-72 overflow-y-auto">
          {isLoading ? (
            <div className="px-2 py-3 text-sm text-muted-foreground"><PageSpinner /></div>
          ) : !data?.length ? (
            <div className="px-2 py-3 text-sm text-muted-foreground">No notifications yet.</div>
          ) : (
            data.map((n) => (
              <div key={n._id} className="flex gap-2 border-b px-2 py-2 text-sm last:border-0">
                <span className={cn("mt-1 size-2 shrink-0 rounded-full", n.read ? "bg-muted-foreground/40" : "bg-brand-500")} />
                <div className="min-w-0">
                  <p className="font-medium">{n.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{n.message}</p>
                </div>
              </div>
            ))
          )}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate(`${home}/notifications`)} className="px-2 py-1.5 text-sm cursor-pointer">
          <ChevronRight className="size-4" /> View all
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}