import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

/**
 * 空状态。之前这个组件只会渲染一个字面 "Empty"（并且没有任何页面用它）。
 * 现在强制传 title：空列表要说什么，说清楚才算是设计，不然只是个占位框。
 */
export default function Empty({ title, description, action, icon, className }: EmptyProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[#2a2a38] px-6 py-12 text-center', className)}>
      <span className="text-[#5a5a6e]">{icon ?? <Inbox className="w-7 h-7" />}</span>
      <p className="text-sm font-medium text-[#e8e8ed]">{title}</p>
      {description && <p className="max-w-sm text-xs leading-relaxed text-[#8b8b9a]">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
