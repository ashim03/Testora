import { Fragment } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "../../utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn("flex items-center gap-1.5 text-sm text-muted-foreground", className)}>
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <Fragment key={`${item.label}-${i}`}>
            {i > 0 && <ChevronRight className="size-3.5 shrink-0" />}
            {item.href && !isLast ? (
              <Link to={item.href} className="flex items-center gap-1 hover:text-foreground">
                {i === 0 && <Home className="size-3.5" />}
                {item.label}
              </Link>
            ) : (
              <span className={cn("flex items-center gap-1", isLast && "font-medium text-foreground")}>
                {i === 0 && <Home className="size-3.5" />}
                {item.label}
              </span>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}