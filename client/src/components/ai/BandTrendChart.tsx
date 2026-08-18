import { useMemo } from "react";
import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

export interface BandPoint {
  label: string;
  ielts: number | null;
  pte: number | null;
}

export function BandTrendChart({ points }: { points: BandPoint[] }) {
  const visible = useMemo(() => points.filter((p) => p.ielts != null || p.pte != null), [points]);
  if (visible.length < 2) return null;
  const hasIelts = visible.some((p) => p.ielts != null);
  const hasPte = visible.some((p) => p.pte != null);
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="size-4 text-primary" /> Band progress</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={visible} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            {hasIelts && <YAxis yAxisId="ielts" domain={[0, 9]} tick={{ fontSize: 11 }} />}
            {hasPte && <YAxis yAxisId="pte" orientation="right" domain={[0, 90]} tick={{ fontSize: 11 }} />}
            <Tooltip />
            {hasIelts && <Line yAxisId="ielts" type="monotone" dataKey="ielts" name="IELTS band" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} connectNulls />}
            {hasPte && <Line yAxisId="pte" type="monotone" dataKey="pte" name="PTE estimate" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} connectNulls />}
          </LineChart>
        </ResponsiveContainer>
        <p className="mt-2 text-xs text-muted-foreground">Formative estimates only — not official IELTS or PTE Academic scores.</p>
      </CardContent>
    </Card>
  );
}