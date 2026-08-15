import { useQuery } from "@tanstack/react-query";
import { FileText, Printer } from "lucide-react";
import { apiGet } from "../../api/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { ErrorState, PageSpinner } from "../ui/feedback";
import { formatDateTime } from "../../utils";

export interface InvoiceData {
  invoiceNo: string;
  consultancyId: string;
  consultancyName: string;
  consultancyCode: string;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  packageName: string;
  price: number;
  currency: string;
  durationDays: number;
  studentLimit: number;
  teacherLimit: number;
  startDate: string;
  endDate: string;
  assignedAt: string;
  note?: string | null;
  total: number;
  issuedAt: string;
  dueAt: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
}

export function InvoiceDialog({ open, onOpenChange, url }: Props) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["invoice", url],
    queryFn: async () => {
      const res = await apiGet<InvoiceData>(url);
      return res.data;
    },
    enabled: open && Boolean(url),
    staleTime: 60_000,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileText className="size-4" /> Invoice</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <PageSpinner />
        ) : isError || !data ? (
          <ErrorState message={error instanceof Error ? error.message : undefined} />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-md border p-4">
              <div>
                <div className="text-xl font-bold">{data.invoiceNo}</div>
                <div className="mt-0.5 text-sm font-medium">{data.consultancyName}</div>
                <div className="text-xs text-muted-foreground">Code {data.consultancyCode}</div>
              </div>
              <div className="text-right">
                <Badge variant="secondary">Issued {formatDateTime(data.issuedAt)}</Badge>
                <div className="mt-1 text-xs text-muted-foreground">Due {formatDateTime(data.dueAt)}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <div className="flex justify-between border-t py-2"><span className="text-muted-foreground">Contact</span><span className="text-right">{data.contactName || "-"}</span></div>
              <div className="flex justify-between border-t py-2"><span className="text-muted-foreground">Email</span><span className="text-right">{data.contactEmail || "-"}</span></div>
              <div className="flex justify-between border-t py-2"><span className="text-muted-foreground">Phone</span><span className="text-right">{data.contactPhone || "-"}</span></div>
              <div className="flex justify-between border-t py-2"><span className="text-muted-foreground">Address</span><span className="text-right">{data.address || "-"}</span></div>
            </div>

            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Item</th>
                    <th className="px-4 py-2.5 font-medium">Period</th>
                    <th className="px-4 py-2.5 font-medium">Seats</th>
                    <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="divide-x">
                    <td className="px-4 py-3">
                      <div className="font-medium">{data.packageName}</div>
                      <div className="text-xs text-muted-foreground">{data.durationDays} days subscription</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{formatDateTime(data.startDate)} — {formatDateTime(data.endDate)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{data.studentLimit} students · {data.teacherLimit} teachers</td>
                    <td className="px-4 py-3 text-right font-semibold">{data.price.toLocaleString()} {data.currency}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className="border-t">
                    <td colSpan={3} className="px-4 py-2.5 text-right font-medium">Total</td>
                    <td className="px-4 py-2.5 text-right text-lg font-bold text-primary">{data.total.toLocaleString()} {data.currency}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {data.note && <p className="text-xs text-muted-foreground">Note: {data.note}</p>}

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Printer className="size-3.5" /> Print
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}