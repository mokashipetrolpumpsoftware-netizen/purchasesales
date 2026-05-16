import { ReactNode } from "react";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 mb-4 sm:mb-6 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight break-words">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1 break-words">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 md:justify-end [&>button]:max-sm:flex-1 [&>a]:max-sm:flex-1">{actions}</div>}
    </div>
  );
}
