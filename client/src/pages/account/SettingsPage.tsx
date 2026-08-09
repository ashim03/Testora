import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Moon, Sun, Monitor, Trash2 } from "lucide-react";
import { apiPatch, apiPost } from "../../api/client";
import { useAuthStore } from "../../store/auth";
import { useTheme, type Theme } from "../../hooks/useTheme";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Switch } from "../../components/ui/switch";
import { Spinner } from "../../components/ui/feedback";
import { BrandingEditor } from "../../components/shared/BrandingEditor";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "../../components/ui/dialog";
import { getErrorMessage, cn } from "../../utils";

const THEMES: Array<{ key: Theme; label: string; icon: typeof Sun }> = [
  { key: "light", label: "Light", icon: Sun },
  { key: "dark", label: "Dark", icon: Moon },
  { key: "system", label: "System", icon: Monitor },
];

const NOTIF_OPTIONS = [
  { key: "results", label: "Results & grades" },
  { key: "assignments", label: "Assignments" },
  { key: "exams", label: "Exams & mock tests" },
  { key: "feedbacks", label: "Teacher feedback" },
  { key: "announcements", label: "Announcements" },
  { key: "marketing", label: "Product & offers" },
];

export function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem("notif-prefs") || "{}");
    } catch {
      return {};
    }
  });
  const [shareData, setShareData] = useState(() => localStorage.getItem("share-data") !== "false");
  const [deleteOpen, setDeleteOpen] = useState(false);

  function toggleNotif(key: string, val: boolean) {
    setNotifPrefs((prev) => {
      const next = { ...prev, [key]: val };
      localStorage.setItem("notif-prefs", JSON.stringify(next));
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage appearance, notifications and account</p>
      </div>

      {user?.role === "TEACHER" || user?.role === "SUPER_ADMIN" ? <BrandingEditor /> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Appearance</CardTitle>
            <CardDescription>Choose how Testora looks for you</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              {THEMES.map((t) => {
                const Icon = t.icon;
                const active = theme === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTheme(t.key)}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-lg border p-4 text-sm transition-colors hover:bg-muted",
                      active && "border-brand-500 bg-brand-50 dark:bg-brand-950/30",
                    )}
                    aria-pressed={active}
                  >
                    <Icon className="size-5" />
                    {t.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Select "System" to follow your OS preference.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notifications</CardTitle>
            <CardDescription>Choose what you want to be notified about</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {NOTIF_OPTIONS.map((o) => (
              <label key={o.key} className="flex items-center justify-between gap-3">
                <span className="text-sm">{o.label}</span>
                <Switch checked={notifPrefs[o.key] !== false} onCheckedChange={(v) => toggleNotif(o.key, v)} />
              </label>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Privacy</CardTitle>
            <CardDescription>Control how your data is used</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm">Share study data with my teachers</div>
                <div className="text-xs text-muted-foreground">Helpers teachers personalise your practice</div>
              </div>
              <Switch
                checked={shareData}
                onCheckedChange={(v) => { setShareData(v); localStorage.setItem("share-data", String(v)); }}
              />
            </label>
            <p className="text-xs text-muted-foreground">Testora respects your privacy. See your data controls any time.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Security</CardTitle>
            <CardDescription>Update your password to keep your account secure</CardDescription>
          </CardHeader>
          <CardContent>
            <SecurityForm />
          </CardContent>
        </Card>
      </div>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base text-destructive">Danger zone</CardTitle>
          <CardDescription>Permanently delete your account and all associated data</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-lg text-sm text-muted-foreground">Deleting your account removes your profile, results and practice history. This can't be undone.</p>
          <Button variant="destructive" onClick={() => setDeleteOpen(true)}><Trash2 className="size-4" /> Delete account</Button>
        </CardContent>
      </Card>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete your account?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will delete your {user?.role.toLowerCase()} account on Testora. Are you sure you want to continue?
          </p>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
            <Button
              variant="destructive"
              onClick={async () => {
                try {
                  await apiPost("/auth/delete-account");
                  useAuthStore.getState().logout();
                  toast.success("Account deleted");
                  navigate("/login");
                } catch (err) {
                  toast.error(getErrorMessage(err));
                }
              }}
            >
              Yes, delete my account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SecurityForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await apiPatch("/auth/change-password", { currentPassword: current, newPassword: next });
      toast.success("Password changed");
      setCurrent("");
      setNext("");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Current password</Label>
        <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
      </div>
      <div className="space-y-1.5">
        <Label>New password</Label>
        <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
      </div>
      <div className="flex justify-end">
        <Button onClick={submit} disabled={busy || !current || !next}>
          {busy ? <Spinner className="size-4" /> : null} Update password
        </Button>
      </div>
    </div>
  );
}