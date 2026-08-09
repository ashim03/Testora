import { EmptyState } from "../../components/ui/feedback";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";

export function StudentPractice() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Practice tests</h1>
        <p className="text-sm text-muted-foreground">Self-paced practice materials</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Practice library</CardTitle></CardHeader>
        <CardContent>
          <EmptyState title="Coming soon" description="Optional self-paced practice tests will appear here." />
        </CardContent>
      </Card>
    </div>
  );
}