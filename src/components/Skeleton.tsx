import { cn } from '@/lib/utils';

/**
 * 加载骨架。用 animate-pulse 而不是转圈：列表页等待时给出"这里马上会有内容"的形状，
 * 比一个居中的 spinner 更少跳动（布局不会在数据到达时二次跳变）。
 */
export default function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-raised', className)} aria-hidden="true" />;
}

/** 一列卡片骨架，用于题库/我的题目/管理端列表 */
export function SkeletonList({ rows = 4, cardClassName }: { rows?: number; cardClassName?: string }) {
  return (
    <div className="space-y-3" role="status" aria-label="加载中">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={cn('rounded-2xl border border-line bg-surface p-5', cardClassName)}>
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="mt-3 h-3 w-2/3" />
          <div className="mt-4 flex space-x-2">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}
