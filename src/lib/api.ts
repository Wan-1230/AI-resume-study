import { Question, Category, Collection, ImportData } from '@/types';
import { useStore } from '@/store';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

// 将后端/静态 JSON 格式转换为前端 Question 格式
function transformQuestions(data: any[]): Question[] {
  return data.map((q: any, index: number) => ({
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
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    category: {
      id: q.category || '未分类',
      name: q.category || '未分类',
      description: `${q.category}相关题目`,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
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

export const api = {
  categories: {
    async getAll(): Promise<Category[]> {
      const questions = await fetchQuestionsFromBackend();
      return extractCategories(questions);
    },
    async getById(id: string): Promise<Category | null> {
      const categories = await this.getAll();
      return categories.find(c => c.id === id) || null;
    },
    async create(data: Omit<Category, 'id' | 'created_at' | 'updated_at'>): Promise<Category> {
      await delay(500);
      const newCategory: Category = {
        ...data,
        id: Date.now().toString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      return newCategory;
    },
    async update(id: string, data: Partial<Omit<Category, 'id' | 'created_at' | 'updated_at'>>): Promise<Category | null> {
      await delay(300);
      const categories = await this.getAll();
      const category = categories.find(c => c.id === id);
      if (!category) return null;
      return { ...category, ...data, updated_at: new Date().toISOString() };
    },
    async delete(_id: string): Promise<boolean> {
      await delay(300);
      return true;
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

    async create(data: Omit<Question, 'id' | 'created_at' | 'updated_at' | 'category'>): Promise<Question> {
      await delay(500);
      const newQuestion: Question = {
        ...data,
        id: Date.now().toString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        category: {
          id: data.category_id,
          name: data.category_id,
          description: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      };
      return newQuestion;
    },

    async update(id: string, data: Partial<Omit<Question, 'id' | 'created_at' | 'updated_at' | 'category'>>): Promise<Question | null> {
      await delay(300);
      const questions = await fetchQuestionsFromBackend();
      const question = questions.find(q => q.id === id);
      if (!question) return null;
      return {
        ...question,
        ...data,
        updated_at: new Date().toISOString(),
      };
    },

    async delete(_id: string): Promise<boolean> {
      await delay(300);
      return true;
    },

    async importQuestions(data: ImportData[], _userId: string): Promise<Question[]> {
      await delay(1000);
      const createdQuestions: Question[] = [];
      
      for (const item of data) {
        const question: Question = {
          id: Date.now().toString() + Math.random(),
          user_id: 'user-1',
          category_id: item.category,
          title: item.title,
          content: item.content,
          options: item.options,
          answer: item.answer,
          explanation: item.explanation,
          difficulty: (item.difficulty as 'easy' | 'medium' | 'hard') || 'medium',
          is_public: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          category: {
            id: item.category,
            name: item.category,
            description: '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        };
        createdQuestions.push(question);
      }

      return createdQuestions;
    },
  },

  collections: {
    async getAll(_userId: string): Promise<Collection[]> {
      await delay(500);
      return [];
    },

    async create(userId: string, questionId: string): Promise<Collection> {
      await delay(300);
      return {
        id: Date.now().toString(),
        user_id: userId,
        question_id: questionId,
        created_at: new Date().toISOString(),
      };
    },

    async delete(_userId: string, _questionId: string): Promise<boolean> {
      await delay(300);
      return true;
    },

    async isCollected(_userId: string, _questionId: string): Promise<boolean> {
      await delay(200);
      return false;
    },
  },
};
