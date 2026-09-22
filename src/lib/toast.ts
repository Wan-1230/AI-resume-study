import { create } from 'zustand';

/**
 * 轻量提示（toast）。
 *
 * 之前有 4 处用 window.alert / confirm：alert 会阻塞整个页面并且长得像调试代码，
 * confirm 更是把"删除确认"这种交互交给浏览器皮肤。这里只解决提示这一半，
 * 删除确认走行内两步按钮（见 MyQuestionsPage），不需要弹窗也能防误删。
 */

export type ToastKind = 'info' | 'success' | 'error';

export interface ToastItem {
  id: number;
  kind: ToastKind;
  text: string;
}

interface ToastState {
  items: ToastItem[];
  notify: (text: string, kind?: ToastKind) => number;
  dismiss: (id: number) => void;
}

let seq = 0;
const LIFETIME_MS = 4200;

export const useToasts = create<ToastState>((set, get) => ({
  items: [],
  notify: (text, kind = 'info') => {
    const id = ++seq;
    set({ items: [...get().items.slice(-3), { id, kind, text }] });
    // 定时移除而不是靠组件卸载：同一文本连点两次也要各自消失
    setTimeout(() => get().dismiss(id), LIFETIME_MS);
    return id;
  },
  dismiss: (id) => set({ items: get().items.filter((item) => item.id !== id) }),
}));

/** 给非组件代码（Promise catch 里）用的快捷入口 */
export const notify = (text: string, kind: ToastKind = 'info') => useToasts.getState().notify(text, kind);
