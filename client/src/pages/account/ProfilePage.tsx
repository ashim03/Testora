import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiGet, apiPatch } from "../../api/client";
import { useAuthStore } from "../../store/auth";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "../../components/ui/avatar";
import { Badge } from "../../components/ui/badge";
import { Spinner } from "../../components/ui/feedback";
import { ImageUpload } from "../../components/shared/ImageUpload";
import { getErrorMessage, initialOf } from "../../utils";
import { GENDERS, COUNTRIES, TIMEZONES, toLocalDateInput, profileCompletion, type AccountProfile } from "../../lib/profile";

export function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avUpdating, setAvUpdating] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiGet<AccountProfile>("/auth/me/full");
        if (res.data) setProfile(res.data);
      } catch (err) {
        toast.error(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <PageSpin />;
  if (!profile) return null;

  const completion = profileCompletion(profile);

  function set(k: keyof AccountProfile, v: unknown) {
    setProfile((p) => (p ? { ...p, [k]: v } : p));
  }

  async function save() {
    if (!profile) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
        phone: profile.phone,
        dateOfBirth: profile.dateOfBirth || null,
        gender: profile.gender || "",
        address: profile.address || null,
        country: profile.country || null,
        timezone: profile.timezone || null,
        examType: profile.examType || "",
        targetScore: profile.targetScore || null,
        currentLevel: profile.currentLevel || null,
        preferredTestDate: profile.preferredTestDate || null,
      };
      const res = await apiPatch<AccountProfile>("/auth/me", payload);
      if (res.data) {
        setProfile(res.data);
        setUser({
          id: res.data.id,
          firstName: res.data.firstName,
          lastName: res.data.lastName,
          email: res.data.email,
          role: user?.role || "STUDENT",
          status: res.data.status || "ACTIVE",
          avatarUrl: res.data.avatarUrl ?? null,
        });
        toast.success("Profile saved");
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function uploadAvatar(url: string | null) {
    setAvUpdating(true);
    try {
      const res = await apiPatch<AccountProfile>("/auth/me", { avatarUrl: url });
      if (res.data) {
        setProfile(res.data);
        setUser({
          id: res.data.id,
          firstName: res.data.firstName,
          lastName: res.data.lastName,
          email: res.data.email,
          role: user?.role || "STUDENT",
          status: res.data.status || "ACTIVE",
          avatarUrl: url || null,
        });
        toast.success(url ? "Photo updated" : "Photo removed");
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setAvUpdating(false);
    }
  }

  function removeAvatar() {
    void uploadAvatar(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My profile</h1>
        <p className="text-sm text-muted-foreground">Manage your personal and academic information</p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-5 py-5">
          <div className="relative">
            <Avatar className="size-20">
              <AvatarImage src={profile.avatarUrl ?? undefined} />
              <AvatarFallback className="text-xl">{initialOf(`${profile.firstName} ${profile.lastName}`)}</AvatarFallback>
            </Avatar>
            {avUpdating && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2"><Spinner className="size-4" /></span>}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-lg font-semibold">{profile.firstName} {profile.lastName}</p>
            <p className="text-sm text-muted-foreground">{profile.email}</p>
            <Badge variant="secondary">{profile.role}</Badge>
          </div>
          <div className="w-full sm:w-56">
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Profile completion</span>
              <span className="font-semibold">{completion}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-brand-600" style={{ width: `${completion}%` }} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Personal information</CardTitle>
            <CardDescription>Photo, basic contact and location details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Profile photo</Label>
              <div className="mt-2">
                <ImageUpload
                  value={profile.avatarUrl}
                  onChange={(url) => void uploadAvatar(url)}
                  onRemove={() => removeAvatar()}
                  shape="circle"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>First name</Label>
                <Input value={profile.firstName} onChange={(e) => set("firstName", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Last name</Label>
                <Input value={profile.lastName} onChange={(e) => set("lastName", e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={profile.email} onChange={(e) => set("email", e.target.value)} type="email" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={profile.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Date of birth</Label>
                <Input type="date" value={toLocalDateInput(profile.dateOfBirth)} onChange={(e) => set("dateOfBirth", e.target.value ? new Date(e.target.value).toISOString() : null)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Gender</Label>
                <select className="w-full rounded-md border px-3 py-2 text-sm" value={profile.gender ?? ""} onChange={(e) => set("gender", e.target.value || null)}>
                  <option value="">Prefer not to say</option>
                  {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Country</Label>
                <select className="w-full rounded-md border px-3 py-2 text-sm" value={profile.country ?? ""} onChange={(e) => set("country", e.target.value || null)}>
                  <option value="">Select country</option>
                  {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Time zone</Label>
                <select className="w-full rounded-md border px-3 py-2 text-sm" value={profile.timezone ?? ""} onChange={(e) => set("timezone", e.target.value || null)}>
                  <option value="">Select time zone</option>
                  {TIMEZONES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input value={profile.address ?? ""} onChange={(e) => set("address", e.target.value)} />
            </div>
            <div className="flex justify-end">
              <Button onClick={save} disabled={saving}>{saving ? <Spinner className="size-4" /> : null} Save changes</Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {user?.role === "STUDENT" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Exam details</CardTitle>
                <CardDescription>Set your target to personalise practice</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Exam type</Label>
                    <select className="w-full rounded-md border px-3 py-2 text-sm" value={profile.examType ?? ""} onChange={(e) => set("examType", e.target.value)}>
                      <option value="">Not set</option>
                      <option value="IELTS">IELTS</option>
                      <option value="PTE">PTE</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Target score / band</Label>
                    <Input value={profile.targetScore ?? ""} onChange={(e) => set("targetScore", e.target.value)} placeholder="e.g. Band 7.5 / 65+" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Current level</Label>
                    <Input value={profile.currentLevel ?? ""} onChange={(e) => set("currentLevel", e.target.value)} placeholder="e.g. Intermediate" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Preferred test date</Label>
                    <Input type="date" value={toLocalDateInput(profile.preferredTestDate)} onChange={(e) => set("preferredTestDate", e.target.value ? new Date(e.target.value).toISOString() : null)} />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={save} disabled={saving}>{saving ? <Spinner className="size-4" /> : null} Save</Button>
                </div>
              </CardContent>
            </Card>
          )}

          <ChangePasswordCard />
        </div>
      </div>
    </div>
  );
}

function ChangePasswordCard() {
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
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Change password</CardTitle>
        <CardDescription>Use a strong password you don't use elsewhere</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label>Current password</Label>
          <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>New password</Label>
          <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} />
        </div>
        <div className="flex justify-end">
          <Button onClick={submit} disabled={busy || !current || !next}>{busy ? <Spinner className="size-4" /> : null} Change password</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PageSpin() {
  return (
    <div className="flex items-center justify-center py-20">
      <Spinner className="size-6" />
    </div>
  );
}