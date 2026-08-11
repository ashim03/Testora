import { ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
import { Button } from "./button";
import { Input } from "./input";
import { Skeleton } from "./skeleton";
import { EmptyState } from "./feedback";

interface PaginationProps {
  page: number;
  pages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, pages, onPageChange }: PaginationProps) {
  return (
    <div className="mt-4 flex items-center justify-between gap-2">
      <p className="text-sm text-muted-foreground">
        Page {page} of {Math.max(1, pages)}
      </p>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Previous page">
          <ChevronLeft />
        </Button>
        <Button variant="outline" size="icon" disabled={page >= pages} onClick={() => onPageChange(page + 1)} aria-label="Next page">
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}

interface ToolbarProps {
  searchPlaceholder?: string;
  search?: string;
  onSearchChange?: (value: string) => void;
  children?: React.ReactNode;
}

export function TableToolbar({ search, onSearchChange, searchPlaceholder, children }: ToolbarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {onSearchChange ? (
        <div className="relative w-full max-w-xs">
          <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder || "Search..."}
            className="pl-9"
            value={search || ""}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label={searchPlaceholder || "Search"}
          />
        </div>
      ) : (
        <div />
      )}
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

export function TableEmptyState({ colSpan, title, description }: { colSpan: number; title?: string; description?: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="p-4">
        <EmptyState title={title || "No records found"} description={description || "Try adjusting your search or filters."} />
      </td>
    </tr>
  );
}

export function PanelEmptyState({ title, description }: { title?: string; description?: string }) {
  return (
    <div className="p-4">
      <EmptyState title={title || "No records found"} description={description || "Try adjusting your search or filters."} />
    </div>
  );
}
