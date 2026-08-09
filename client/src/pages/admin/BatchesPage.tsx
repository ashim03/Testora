import { EmptyState } from "../../components/ui/feedback";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";

export function BatchesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Batches</h1>
        <p className="text-sm text-muted-foreground">Group students into batches by course</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Batch management</CardTitle></CardHeader>
        <CardContent>
          <EmptyState title="Coming soon" description="Batch creation and assignment are managed by teachers. Course-based grouping will appear here." />
        </CardContent>
      </Card>
    </div>
  );
}