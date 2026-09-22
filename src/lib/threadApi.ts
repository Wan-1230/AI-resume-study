import { getStoredToken } from '@/lib/authApi';
import type { Source } from '@/lib/chatApi';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

export interface ThreadSummary {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface StoredMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources: Source[];
  feedback: 'up' | 'down' | null;
  created_at: string;
}

export type MessageFeedback = 'up' | 'down' | null;

export class ThreadApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ThreadApiError';
    this.status = status;
  }
}

async function request<T>(path: string, { method = 'GET', body }: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = getStoredToken();
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/chat/threads${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ThreadApiError('无法连接后端服务，请确认后端已启动', 0);
  }

  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    if (response.status === 401) throw new ThreadApiError('登录后才会保存对话历史', 401);
    throw new ThreadApiError((detail as { error?: string })?.error || `请求失败（${response.status}）`, response.status);
  }
  return response.json() as Promise<T>;
}

export const threadApi = {
  list: (limit = 30) => request<{ items: ThreadSummary[] }>(`?limit=${limit}`).then((r) => r.items),
  create: () => request<{ item: ThreadSummary }>('/', { method: 'POST' }).then((r) => r.item),
  read: (id: string) => request<{ thread: ThreadSummary; messages: StoredMessage[] }>(`/${id}`),
  rename: (id: string, title: string) => request<{ title: string }>(`/${id}`, { method: 'PATCH', body: { title } }),
  remove: (id: string) => request<{ removed: boolean }>(`/${id}`, { method: 'DELETE' }),
  append: (id: string, messages: { role: string; content: string; sources?: Source[] }[]) =>
    request<{ items: StoredMessage[] }>(`/${id}/messages`, { method: 'POST', body: { messages } }).then((r) => r.items),
  feedback: (threadId: string, messageId: string, feedback: MessageFeedback) =>
    request<{ feedback: MessageFeedback }>(`/${threadId}/messages/${messageId}/feedback`, {
      method: 'POST',
      body: { feedback },
    }),
};
