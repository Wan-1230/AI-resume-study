import { getStoredToken } from '@/lib/authApi';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

export interface InterviewDirectionOption {
  key: string;
  name: string;
  available: number;
}

export interface InterviewItem {
  id: string;
  kind: 'mcq' | 'open';
  question: string;
  category: string;
  /** 选择题的选项，形如 "A. xxx"；开放题为空 */
  options: string[];
}

export interface AnswerResult {
  item_id: string;
  /** 开放题没有对错，恒为 null —— 不用 0/1 冒充"答错了" */
  correct: boolean | null;
  chosen: string | null;
  correct_answer: string | null;
  feedback: string | null;
  follow_up: string | null;
  reference: string;
}

export interface CategoryScore {
  category: string;
  total: number;
  correct: number;
  open: number;
}

export interface ObjectiveSummary {
  total: number;
  answered: number;
  mcq_correct: number;
  mcq_answered: number;
  categories: CategoryScore[];
}

export interface DimensionScore {
  key: string;
  name: string;
  score: number | null;
  reason: string | null;
}

export interface InterviewReport {
  dimensions?: DimensionScore[];
  score_total?: number | null;
  strengths?: string[];
  improvements?: { priority: number; what: string; how: string }[];
  summary?: string | null;
  objective: ObjectiveSummary;
  skipped?: number;
  /** 评审不可用时才有：客观题成绩照常给出，不编六维分数 */
  error?: string;
}

export interface TranscriptEntry {
  item_id: string;
  kind: 'mcq' | 'open';
  category: string;
  question: string;
  answer: string;
  chosen: string | null;
  correct_answer: string | null;
  correct: boolean | null;
  reference: string;
  feedback: string | null;
  follow_up: string | null;
  follow_up_answer: string | null;
  answered_at: string;
}

export interface InterviewSessionView {
  id: string;
  direction: string;
  visibility: string;
  created_at: string;
  finished_at: string | null;
  score_total: number | null;
  report: InterviewReport | null;
  objective: ObjectiveSummary;
  items: (InterviewItem & { answer?: string | null; reference?: string })[];
  transcript: TranscriptEntry[];
}

export interface SessionSummary {
  id: string;
  direction: string;
  score_total: number | null;
  answered: number;
  finished: boolean;
  visibility: string;
  created_at: string;
}

export class InterviewApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'InterviewApiError';
    this.status = status;
  }
}

async function request<T>(path: string, { method = 'GET', body }: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = getStoredToken();
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new InterviewApiError('无法连接后端服务，请确认后端已启动', 0);
  }

  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new InterviewApiError((detail as { error?: string }).error || `请求失败（${response.status}）`, response.status);
  }
  return response.json() as Promise<T>;
}

export const interviewApi = {
  directions: () =>
    request<{ directions: InterviewDirectionOption[]; grader_ready: boolean }>('/api/interview/directions'),

  start: (direction: string) =>
    request<{ session: { id: string; direction: string; grader_ready: boolean; items: InterviewItem[] } }>(
      '/api/interview/sessions',
      { method: 'POST', body: { direction } }
    ).then((r) => r.session),

  answer: (sessionId: string, itemId: string, answer: string) =>
    request<{ item: AnswerResult; progress: { answered: number; total: number } }>(
      `/api/interview/sessions/${sessionId}/answer`,
      { method: 'POST', body: { item_id: itemId, answer } }
    ),

  followUp: (sessionId: string, itemId: string, answer: string) =>
    request<{ ok: boolean }>(`/api/interview/sessions/${sessionId}/followup`, {
      method: 'POST',
      body: { item_id: itemId, answer },
    }),

  finish: (sessionId: string) =>
    request<{ report: InterviewReport }>(`/api/interview/sessions/${sessionId}/finish`, { method: 'POST' }).then(
      (r) => r.report
    ),

  list: (limit = 10) =>
    request<{ items: SessionSummary[] }>(`/api/interview/sessions?limit=${limit}`).then((r) => r.items),

  get: (sessionId: string) =>
    request<{ report: InterviewSessionView }>(`/api/interview/sessions/${sessionId}`).then((r) => r.report),

  share: (sessionId: string, enabled: boolean) =>
    request<{ visibility: string; path: string | null }>(`/api/interview/sessions/${sessionId}/share`, {
      method: 'POST',
      body: { enabled },
    }),

  /** 公开分享链接，无需登录 */
  shared: (sessionId: string) =>
    request<{ report: InterviewSessionView }>(`/api/interview/shared/${sessionId}`).then((r) => r.report),
};
