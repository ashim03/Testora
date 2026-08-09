import { Link } from "react-router-dom";
import { User, Bell, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";

export function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your account and preferences</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
          <CardDescription>Update your personal details and preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Link to="/admin/profile" className="flex items-center justify-between rounded-md border px-3 py-2.5 text-sm transition-colors hover:bg-muted">
            <span className="flex items-center gap-2"><User className="size-4 text-muted-foreground" /> Profile</span>
            <ArrowRight className="size-4 text-muted-foreground" />
          </Link>
          <Link to="/admin/notifications" className="flex items-center justify-between rounded-md border px-3 py-2.5 text-sm transition-colors hover:bg-muted">
            <span className="flex items-center gap-2"><Bell className="size-4 text-muted-foreground" /> Notifications</span>
            <ArrowRight className="size-4 text-muted-foreground" />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
