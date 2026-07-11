import type { ReactNode } from 'react';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  trend?: { value: string; positive: boolean };
  accent?: 'primary' | 'accent' | 'neutral';
}

const ACCENT_STYLES = {
  primary: 'bg-primary-50 text-primary-600',
  accent: 'bg-accent-50 text-accent-600',
  neutral: 'bg-ink-50 text-ink-600',
};

export function StatCard({ label, value, icon, trend, accent = 'neutral' }: StatCardProps) {
  return (
    <Card className="flex items-start justify-between">
      <div>
        <p className="mb-1 text-sm text-ink-400">{label}</p>
        <p className="font-display text-2xl font-semibold text-ink-900">{value}</p>
        {trend && (
          <p className={cn('mt-1 text-xs font-medium', trend.positive ? 'text-primary-600' : 'text-red-600')}>
            {trend.value}
          </p>
        )}
      </div>
      <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', ACCENT_STYLES[accent])}>
        {icon}
      </div>
    </Card>
  );
}
