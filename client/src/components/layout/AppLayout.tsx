import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LogOut, Bell, ChevronLeft, ChevronRight, Search, Sun, Moon, Monitor, MessageSquare, LayoutDashboard, User, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import portalBackdrop from "../../assets/portal-ai-background.png";
import { useAuthStore } from "../../store/auth";
import { useBrandingStore, type Branding } from "../../store/branding";
import { navGroupsFor, homePathForRole } from "../../config/navigation";
import { cn, initialOf } from "../../utils";
import { apiGet, apiPatch, apiPost } from "../../api/client";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { notificationTarget } from "../../utils/notificationTargets";

interface NotificationRow {
  _id: string;
  type?: string;
  title: string;
  body?: string;
  message?: string;
  data?: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  useActiveBranding();

  return (
    <div className="portal-shell min-h-screen bg-background" style={{ "--portal-backdrop": `url(${portalBackdrop})` } as CSSProperties}>
      <div className="portal-background" aria-hidden="true" />
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <div className={cn("relative z-10 flex min-h-screen flex-col transition-all", collapsed ? "lg:pl-16" : "lg:pl-60")}>
        <Topbar />
        <main className="mx-auto flex w-full max-w-[1440px] flex-1 px-4 py-5 pb-28 sm:px-6 lg:px-8 lg:py-7 lg:pb-8">
          <div className="w-full">{children}</div>
        </main>
      </div>
      <MobileNav />
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
        "fixed inset-y-0 left-0 z-40 hidden flex-col border-r bg-card/90 shadow-[1px_0_0_rgb(15_23_42/0.02),0_24px_60px_-44px_rgb(15_23_42/0.55)] backdrop-blur-xl transition-all lg:flex",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div className={cn("flex h-16 items-center gap-2 border-b px-4", collapsed && "justify-center px-0")}>
        <Brand compact={collapsed} />
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight">{branding?.name || "Testora"}</p>
            {branding?.tagline ? <p className="truncate text-[11px] text-muted-foreground">{branding.tagline}</p> : null}
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto scrollbar-thin p-3">
        {groups.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase text-muted-foreground">
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
          "flex h-9 w-full items-center gap-3 rounded-md border-l-2 border-transparent px-2 text-sm transition-all hover:bg-muted/80",
          current ? "border-primary bg-primary/10 font-semibold text-primary" : "text-muted-foreground",
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
        "mb-1 flex h-9 w-full items-center gap-2 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:bg-muted/80",
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
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/80 px-4 shadow-[0_14px_40px_-34px_rgb(15_23_42/0.65)] backdrop-blur-xl sm:px-6">
      <div className="flex min-w-0 items-center gap-2 md:flex">
        <Brand compact={false} />
        <div className="hidden min-w-0 min-[420px]:block">
          <p className="truncate text-sm font-semibold leading-tight">{branding?.name || "Testora"}</p>
          <p className="truncate text-[11px] text-muted-foreground leading-tight">{branding?.tagline || (user?.role ?? "").toLowerCase()}</p>
        </div>
      </div>

      <form
        className="hidden w-72 sm:block"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`);
        }}
      >
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search..." className="h-10 pl-9" aria-label="Search" />
        </div>
      </form>

      <div className="ms-auto flex items-center gap-1">
        <ThemeToggle />
        <NotificationsDropdown />
        <Button variant="ghost" size="icon" aria-label="Messages" onClick={() => navigate(`${home}/chat`)}>
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
          <DropdownMenuContent align="end" className="w-72 border bg-popover/95 p-2 shadow-card-hover backdrop-blur-xl">
            <DropdownMenuLabel className="p-2">
              <div className="flex items-center gap-3">
                <Avatar className="size-10">
                  <AvatarImage src={user?.avatarUrl ?? undefined} />
                  <AvatarFallback>{initialOf(user?.firstName)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{user?.firstName} {user?.lastName}</div>
                  <div className="truncate text-xs font-normal text-muted-foreground">{user?.email}</div>
                </div>
              </div>
              <div className="mt-3 inline-flex rounded-md bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary">
                {roleLabel(user?.role)}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="-mx-2 my-2 h-px bg-border" />
            <DropdownMenuItem onClick={() => navigate(home)}>
              <LayoutDashboard className="size-4" /> Dashboard
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate(`${home}/profile`)}>
              <User className="size-4" /> My profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate(`${home}/chat`)}>
              <MessageSquare className="size-4" /> Messages
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate(`${home}/notifications`)}>
              <Bell className="size-4" /> Notifications
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate(`${home}/settings`)}>
              <Settings className="size-4" /> Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator className="-mx-2 my-2 h-px bg-border" />
            <DropdownMenuItem onClick={logout} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
              <LogOut className="size-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

function roleLabel(role?: string): string {
  if (role === "SUPER_ADMIN") return "Super Admin";
  if (role === "TEACHER") return "Teacher";
  if (role === "STUDENT") return "Student";
  return "Account";
}

function MobileNav() {
  const user = useAuthStore((s) => s.user);
  const groups = navGroupsFor(user?.role);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const items = groups.flatMap((group) => group.items).slice(0, 5);

  if (!items.length) return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] pt-1.5 shadow-[0_-10px_30px_-24px_rgb(15_23_42/0.35)] backdrop-blur lg:hidden">
      <ul className="grid grid-cols-5 gap-1">
        {items.map((item) => {
          const current = item.end ? pathname === item.to : pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <li key={item.to}>
              <button
                type="button"
                onClick={() => navigate(item.to)}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex h-14 w-full flex-col items-center justify-center gap-1 rounded-md px-1 text-[11px] font-medium transition-colors",
                  current ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/80",
                )}
              >
                <Icon className="size-4" />
                <span className="w-full truncate text-center">{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
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
  const qc = useQueryClient();
  const home = homePathForRole(user?.role);

  const { data, isLoading } = useQuery({
    queryKey: ["header", "notifications"],
    queryFn: async () => {
      const res = await apiGet<NotificationRow[]>("/notifications", { limit: 5 });
      return res.data ?? [];
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  const unread = data?.filter((n) => !n.read).length ?? 0;
  const markAllRead = useMutation({
    mutationFn: async () => apiPost("/notifications/read-all"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["header", "notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["student", "notifications"] });
    },
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => apiPatch(`/notifications/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["header", "notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["student", "notifications"] });
    },
  });

  async function openNotification(notification: NotificationRow) {
    if (!notification.read) {
      await apiPatch(`/notifications/${notification._id}/read`).catch(() => undefined);
      qc.invalidateQueries({ queryKey: ["header", "notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["student", "notifications"] });
    }
    navigate(notificationTarget(notification, user?.role));
  }

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
      <DropdownMenuContent align="end" className="w-[calc(100vw-1.5rem)] max-w-96 border bg-popover/95 p-2 shadow-card-hover backdrop-blur-xl">
        <DropdownMenuLabel className="flex items-center justify-between gap-3 p-2">
          <span className="text-sm font-semibold">Notifications</span>
          {unread > 0 ? (
            <button
              type="button"
              onClick={() => markAllRead.mutate()}
              className="rounded-md px-2 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
            >
              Mark all read
            </button>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-72 overflow-y-auto">
          {isLoading ? (
            <div className="px-2 py-3 text-sm text-muted-foreground"><PageSpinner /></div>
          ) : !data?.length ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">No notifications yet.</div>
          ) : (
            data.map((n) => (
              <div key={n._id} className={cn("flex gap-3 rounded-md px-2 py-2 text-sm", !n.read && "bg-primary/5")}>
                <span className={cn("mt-2 size-2 shrink-0 rounded-full", n.read ? "bg-muted-foreground/30" : "bg-primary")} />
                <div className="min-w-0 flex-1">
                  <button type="button" onClick={() => void openNotification(n)} className="block w-full text-left">
                    <p className="truncate font-medium">{n.title}</p>
                    <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">{n.body || n.message}</p>
                  </button>
                  {!n.read ? (
                    <button
                      type="button"
                      onClick={() => markRead.mutate(n._id)}
                      className="mt-1 text-xs font-semibold text-primary hover:underline"
                    >
                      Mark as read
                    </button>
                  ) : null}
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
