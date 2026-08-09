import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiGet, apiPost, apiPut } from "../../api/client";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { Spinner } from "../ui/feedback";
import { ImageUpload } from "./ImageUpload";
import { useBrandingStore, type Branding } from "../../store/branding";
import { getErrorMessage } from "../../utils";

export function BrandingEditor() {
  const { setBranding } = useBrandingStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    tagline: "",
    address: "",
    email: "",
    phone: "",
    website: "",
    logoUrl: null as string | null,
    social: { facebook: "", twitter: "", instagram: "", linkedin: "" },
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await apiGet<Branding>("/branding/mine");
        if (res.data) {
          setForm({
            name: res.data.name,
            tagline: res.data.tagline || "",
            address: res.data.address || "",
            email: res.data.email || "",
            phone: res.data.phone || "",
            website: res.data.website || "",
            logoUrl: res.data.logoUrl ?? null,
            social: {
              facebook: res.data.social?.facebook || "",
              twitter: res.data.social?.twitter || "",
              instagram: res.data.social?.instagram || "",
              linkedin: res.data.social?.linkedin || "",
            },
          });
        }
      } catch {
        /* no branding yet */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save(extra?: Partial<typeof form>) {
    setSaving(true);
    try {
      const payload = { ...form, ...extra };
      const res = await apiPut<Branding>("/branding", payload);
      if (res.data) setBranding(res.data);
      toast.success("Branding saved");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function onLogo(url: string) {
    setForm((f) => ({ ...f, logoUrl: url }));
    await save({ logoUrl: url });
  }

  async function removeLogo() {
    try {
      await apiPost("/branding/logo/clear");
      setForm((f) => ({ ...f, logoUrl: null }));
      useBrandingStore.setState((s) => ({ ...s, branding: s.branding ? { ...s.branding, logoUrl: null } : s.branding }));
      toast.success("Logo removed");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10"><Spinner /></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Consultancy branding</CardTitle>
        <CardDescription>Logo and details shown across the platform</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Consultancy logo</Label>
          <div className="mt-2">
            <ImageUpload
              value={form.logoUrl}
              onChange={(url) => void onLogo(url)}
              onRemove={removeLogo}
              kind="LOGO"
              shape="square"
              label="Upload logo"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Consultancy name</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Tagline</Label>
            <Input value={form.tagline} onChange={(e) => set("tagline", e.target.value)} placeholder="e.g. Your success partner" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Address</Label>
          <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={form.email} onChange={(e) => set("email", e.target.value)} type="email" />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Website</Label>
          <Input value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Facebook</Label>
            <Input value={form.social.facebook || ""} onChange={(e) => set("social", { ...form.social, facebook: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Instagram</Label>
            <Input value={form.social.instagram || ""} onChange={(e) => set("social", { ...form.social, instagram: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>LinkedIn</Label>
            <Input value={form.social.linkedin || ""} onChange={(e) => set("social", { ...form.social, linkedin: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Twitter / X</Label>
            <Input value={form.social.twitter || ""} onChange={(e) => set("social", { ...form.social, twitter: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={() => save()} disabled={saving || !form.name.trim()}>
            {saving ? <Spinner className="size-4" /> : null} Save branding
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}