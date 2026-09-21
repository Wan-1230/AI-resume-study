import { getStoredToken } from '@/lib/authApi';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

export interface FavoriteItem {
  question_id: string;
  created_at: string;
}

export interface PracticeAnswerInput {
  question_id: string;
  chosen: string;
  duration_s: number;
  /** 本次展示的选项顺序（乱序作答时必传，服务端按文本判分） */
  display_options?: string[];
}

export interface PracticeSessionInput {
  mode?: 'drill' | 'mock';
  config?: Record<string, unknown>;
  started_at?: string;
  finished_at?: string;
  answers: PracticeAnswerInput[];
}

export interface PracticeSessionRecord {
  id: string;
  mode: string;
  total: number;
  correct_count: number;
  duration_s: number;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  config: Record<string, unknown>;
}

export interface PracticeStats {
  sessions: number;
  answers: number;
  correct: number;
  accuracy: number;
  by_category: { category: string | null; total: number; correct: number; accuracy: number }[];
}

export interface WrongItem {
  question_id: string;
  title: string | null;
  category: string | null;
  chosen: string | null;
  correct_answer: string | null;
  answered_at: string;
  wrong_count: number;
}

export class LearningApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'LearningApiError';
    this.status = status;
  }
}

async function request<T>(path: string, { method = 'GET', body }: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = getStoredToken();
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new LearningApiError((detail as { error?: string }).error || `请求失败（${response.status}）`, response.status);
  }
  return response.json() as Promise<T>;
}

/**
 * 学习数据接口：服务端按题库重算对错，客户端只上报「选了哪个选项」，
 * 因此这里不传 is_correct / correct_answer。
 */
export const learningApi = {
  favorites: {
    list: () => request<{ items: FavoriteItem[] }>('/api/favorites').then((r) => r.items),
    add: (questionId: string) =>
      request<{ item: FavoriteItem }>('/api/favorites', { method: 'POST', body: { question_id: questionId } }).then((r) => r.item),
    remove: (questionId: string) =>
      request<{ removed: boolean }>(`/api/favorites/${encodeURIComponent(questionId)}`, { method: 'DELETE' }),
  },
  practice: {
    createSession: (input: PracticeSessionInput) =>
      request<{ session: { id: string; total: number; correct_count: number; accuracy: number; skipped: (string | null)[] } }>(
        '/api/practice/sessions',
        { method: 'POST', body: input }
      ).then((r) => r.session),
    listSessions: (limit = 10) =>
      request<{ items: PracticeSessionRecord[] }>(`/api/practice/sessions?limit=${limit}`).then((r) => r.items),
    stats: () => request<PracticeStats>('/api/practice/stats'),
    wrong: (limit = 50) => request<{ items: WrongItem[] }>(`/api/practice/wrong?limit=${limit}`).then((r) => r.items),
  },
};
