"use client";

interface ViewHeaderProps {
  title: string;
  children?: React.ReactNode;
}

export function ViewHeader({ title, children }: ViewHeaderProps) {
  return (
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border-base bg-surface px-4 py-3 md:px-6 md:py-4">
      <h1 className="text-xl font-semibold lowercase tracking-tight md:text-2xl">{title}</h1>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </header>
  );
}
