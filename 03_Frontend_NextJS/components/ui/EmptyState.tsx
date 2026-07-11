import type { ReactNode } from 'react';

export function EmptyState({ icon, title, description }: { icon: ReactNode; title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-ink-50 text-ink-400">
        {icon}
      </div>
      <p className="text-sm font-medium text-ink-800">{title}</p>
      {description && <p className="mt-1 text-sm text-ink-400">{description}</p>}
    </div>
  );
}
