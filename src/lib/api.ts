import { Question, Category, ImportData } from '@/types';
import { useStore } from '@/store';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

// 获取认证请求头
function getAuthHeaders(): Record<string, string> {
  const token = useStore.getState().token;
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

// 从后端获取题目并转换格式
// 如果后端不可达，自动回退到 Cloudflare Pages 静态 JSON 文件
async function fetchQuestionsFromBackend(): Promise<Question[]> {
  // 优先从后端 API 获取（支持动态更新）
  try {
    const response = await fetch(`${API_BASE}/api/questions`, {
      headers: getAuthHeaders(),
    });
    if (response.ok) {
      const data = await response.json();
      return transformQuestions(data);
    }
  } catch {
    console.warn('[题库] 后端不可达，使用本地静态数据');
  }

  // 后端不可用时，从 Cloudflare Pages 同源的静态 JSON 加载
  try {
    const response = await fetch('/data/questions.json');
    if (response.ok) {
      const data = await response.json();
      console.log(`[题库] 已从本地加载 ${data.length} 道题目`);
      return transformQuestions(data);
    }
  } catch {
    console.error('[题库] 本地数据加载失败');
  }

  return [];
}

// 后端 /api/questions 与静态兜底文件共用的原始题面格式
interface RawQuestion {
  id?: string;
  title: string;
  content: string;
  options?: string[];
  answer: string;
  category?: string;
  difficulty?: string;
}

// 将后端/静态 JSON 格式转换为前端 Question 格式
function transformQuestions(data: RawQuestion[]): Question[] {
  return data.map((q, index) => ({
    id: q.id || `q${index + 1}`,
    user_id: 'system',
    category_id: q.category || '未分类',
    title: q.title,
    content: q.content,
    options: q.options || [],
    answer: q.answer,
    explanation: q.content,
    difficulty: q.difficulty as 'easy' | 'medium' | 'hard',
    is_public: true,
    created_at: null,
    updated_at: null,
    category: {
      id: q.category || '未分类',
      name: q.category || '未分类',
      description: `${q.category}相关题目`,
      created_at: null,
      updated_at: null,
    }
  }));
}

// 从题目中提取分类
function extractCategories(questions: Question[]): Category[] {
  const categoryMap = new Map<string, Category>();
  questions.forEach(q => {
    if (q.category && !categoryMap.has(q.category.id)) {
      categoryMap.set(q.category.id, q.category);
    }
  });
  return Array.from(categoryMap.values());
}

/** 单题作答统计：来自练习记录的真实聚合 */
export interface QuestionStats {
  question_id: string;
  attempts: number;
  correct: number;
  accuracy: number | null;
  median_duration_s: number | null;
}

/** 提交给用户题库的题目字段（后端会做同样的校验） */
export interface MyQuestionInput {
  title: string;
  content: string;
  options: string[];
  answer: string;
  explanation?: string;
  difficulty: string;
  category_id?: string;
  category?: string;
  source_id?: string;
}

interface MyQuestionRow {
  id: string;
  owner_user_id: string;
  title: string;
  content: string;
  options: string[];
  answer: string;
  explanation: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  source_id: string | null;
  created_at: string;
  updated_at: string;
}

function toMyQuestion(row: MyQuestionRow): Question {
  return {
    id: row.id,
    user_id: row.owner_user_id,
    category_id: row.category,
    title: row.title,
    content: row.content,
    options: row.options,
    answer: row.answer,
    explanation: row.explanation || row.content,
    difficulty: row.difficulty,
    is_public: false,
    created_at: row.created_at,
    updated_at: row.updated_at,
    category: {
      id: row.category,
      name: row.category,
      description: '我的题目',
      created_at: row.created_at,
      updated_at: row.updated_at,
    },
  };
}

async function myRequest<T>(path: string, { method = 'GET', body }: { method?: string; body?: unknown } = {}): Promise<T> {
  const response = await fetch(`${API_BASE}/api/my/questions${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error((detail as { error?: string }).error || `请求失败（${response.status}）`);
  }
  return response.json() as Promise<T>;
}

/**
 * 服务端过滤版取题。只支持 category / difficulty / limit；
 * 带 search 或 page 时返回 null，让调用方走"拉全量再本地筛"的老路径。
 * 后端不可达、或返回结构不对，同样返回 null 兜底 —— 这里宁可多拉一次全量，也不要白屏。
 */
async function fetchQuestionsFiltered(params?: {
  categoryId?: string;
  difficulty?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{ data: Question[]; total: number } | null> {
  if (params?.search || params?.page) return null;
  const query = new URLSearchParams();
  if (params?.categoryId) query.set('category', params.categoryId);
  if (params?.difficulty) query.set('difficulty', params.difficulty);
  if (params?.limit) query.set('limit', String(params.limit));
  if (!query.toString()) return null;

  try {
    const response = await fetch(`${API_BASE}/api/questions?${query.toString()}`, { headers: getAuthHeaders() });
    if (!response.ok) return null;
    const rows = await response.json();
    if (!Array.isArray(rows)) return null;
    const data = transformQuestions(rows);
    // 命中总数在 X-Total-Count 里（服务端已 exposedHeaders），拿不到就退成"这次取回多少"
    const total = Number(response.headers.get('X-Total-Count')) || data.length;
    return { data, total };
  } catch {
    return null;
  }
}

export const api = {
  /** 落地页的收录计数：拿不到就宁可不显示，也不写死一个会过期的数字 */
  async stats(): Promise<{ articles: number; questions: number }> {
    const response = await fetch(`${API_BASE}/api/stats`);
    if (!response.ok) throw new Error(`统计请求失败（${response.status}）`);
    return response.json();
  },

  categories: {
    /** 系统题库的分类由题目派生，不支持自定义增删 */
    async getAll(): Promise<Category[]> {
      const questions = await fetchQuestionsFromBackend();
      return extractCategories(questions);
    },
  },

  questions: {
    async getAll(params?: {
      categoryId?: string;
      difficulty?: string;
      search?: string;
      page?: number;
      limit?: number;
    }): Promise<{ data: Question[]; total: number }> {
      // 能交给服务端筛就先交给服务端：全量是 677KB，练习页只要一个分类时不该整份拉回浏览器
      const serverSide = await fetchQuestionsFiltered(params);
      if (serverSide) return serverSide;

      let questions = await fetchQuestionsFromBackend();

      // 过滤
      if (params?.categoryId) {
        questions = questions.filter(q => q.category_id === params.categoryId);
      }
      if (params?.difficulty) {
        questions = questions.filter(q => q.difficulty === params.difficulty);
      }
      if (params?.search) {
        const searchLower = params.search.toLowerCase();
        questions = questions.filter(q =>
          q.title.toLowerCase().includes(searchLower) ||
          q.content.toLowerCase().includes(searchLower)
        );
      }

      const total = questions.length;
      const page = params?.page || 1;
      const limit = params?.limit || 10;
      const offset = (page - 1) * limit;
      const paginated = questions.slice(offset, offset + limit);

      return { data: paginated, total };
    },

    async getById(id: string): Promise<Question | null> {
      const questions = await fetchQuestionsFromBackend();
      return questions.find(q => q.id === id) || null;
    },

    /**
     * 单题的真实作答统计（聚合值，无需登录）。
     * 拿不到就返回 null，让页面干脆不显示这行指标，而不是编一个"浏览 1.2k"。
     */
    async stats(id: string): Promise<QuestionStats | null> {
      try {
        const response = await fetch(`${API_BASE}/api/questions/${encodeURIComponent(id)}/stats`);
        if (!response.ok) return null;
        return (await response.json()) as QuestionStats;
      } catch {
        return null;
      }
    },
  },

  /** 我的题库：用户自建题，服务端按 owner 隔离，系统题库只读 */
  myQuestions: {
    async list(): Promise<Question[]> {
      const { items } = await myRequest<{ items: MyQuestionRow[] }>('');
      return items.map(toMyQuestion);
    },

    /** 新建题目；带 source_id 表示「复制系统题入库」，重复复制返回 already */
    async create(input: MyQuestionInput): Promise<{ question: Question; already: boolean }> {
      const res = await myRequest<{ item: MyQuestionRow; already?: boolean }>('', { method: 'POST', body: input });
      return { question: toMyQuestion(res.item), already: !!res.already };
    },

    async update(id: string, input: MyQuestionInput): Promise<Question> {
      const { item } = await myRequest<{ item: MyQuestionRow }>(`/${encodeURIComponent(id)}`, { method: 'PUT', body: input });
      return toMyQuestion(item);
    },

    async remove(id: string): Promise<void> {
      await myRequest<{ removed: boolean }>(`/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },

    async import(items: ImportData[]): Promise<{ created: number; failed: { index: number; title: string; error: string }[] }> {
      const res = await myRequest<{
        created_count: number;
        failed: { index: number; title: string; error: string }[];
      }>('/import', { method: 'POST', body: { items } });
      return { created: res.created_count, failed: res.failed };
    },
  },
};
