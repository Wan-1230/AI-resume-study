import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';
import { useToasts, type ToastKind } from '@/lib/toast';

const STYLE: Record<ToastKind, { icon: typeof Info; ring: string; text: string }> = {
  info: { icon: Info, ring: 'border-edge', text: 'text-bright' },
  success: { icon: CheckCircle, ring: 'border-emerald-500/30', text: 'text-success' },
  error: { icon: AlertCircle, ring: 'border-rose-500/30', text: 'text-danger' },
};

/**
 * 全局提示出口。挂在 App 顶层一次即可，页面只管调用 notify()。
 * aria-live 让屏幕阅读器也能读到 —— 原来那些 alert() 至少还能强制打断，
 * 换成 toast 如果不补可访问性，等于把提示从"必然看到"降级成"可能看到"。
 */
export default function ToastViewport() {
  const { items, dismiss } = useToasts();
  if (!items.length) return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 space-y-2 px-4" role="status" aria-live="polite">
      {items.map((item) => {
        const style = STYLE[item.kind];
        const Icon = style.icon;
        return (
          <div
            key={item.id}
            className={`flex max-w-md items-start space-x-2.5 rounded-xl border bg-surface/95 px-4 py-3 shadow-xl shadow-black/40 backdrop-blur ${style.ring}`}
          >
            <Icon className={`mt-0.5 w-4 h-4 shrink-0 ${style.text}`} />
            <p className="flex-1 text-sm leading-relaxed text-bright">{item.text}</p>
            <button
              onClick={() => dismiss(item.id)}
              className="p-0.5 text-faint hover:text-muted transition-colors"
              title="关掉这条提示"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
