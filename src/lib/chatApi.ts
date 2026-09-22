/**
 * 对话 API 客户端
 */

import { useStore } from '@/store';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

function getAuthHeaders(): Record<string, string> {
  const token = useStore.getState().token;
  if (token) {
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  }
  return { 'Content-Type': 'application/json' };
}

/**
 * 把服务端给的原因透出来（限流的"请 X 秒后再试"、LLM 不可达等），
 * 否则用户只会看到一句没有信息量的"请求失败"。
 */
async function readChatError(response: Response): Promise<Error> {
  const detail = await response.json().catch(() => null);
  const reason = detail && typeof detail.error === 'string' ? detail.error : null;
  if (reason) return new Error(reason);
  return new Error(response.status === 429 ? '请求太频繁，请稍后再试' : `请求失败（${response.status}）`);
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  timestamp: number;
  /** 流式输出中：渲染光标，结束后由调用方置回 false */
  streaming?: boolean;
  /** 落库后的服务端消息 id；赞/踩要有它才认 */
  serverId?: string;
  feedback?: 'up' | 'down' | null;
}

export interface Source {
  /** 语料里的文档 id（题目 q123 / 文章 a45），来源同一文档的分块会共享它 */
  id?: string | null;
  title: string;
  category: string;
  url?: string;
  source: 'article' | 'question';
  content: string;
  /** cosine 相似度，0~1 */
  score?: number | null;
}

export interface ChatResponse {
  answer: string;
  sources: Source[];
  /** true = 知识库检索一条没过阈值，答案模型压根没调用 */
  abstained?: boolean;
}

/** POST 到对话接口；fetch 抛异常代表请求没发出去（后端没起），与 401/429 是不同排查方向 */
async function postChat(path: string, message: string, history: ChatMessage[]): Promise<Response> {
  try {
    return await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        message,
        history: history.map(msg => ({ role: msg.role, content: msg.content }))
      })
    });
  } catch {
    throw new Error('无法连接后端服务，请确认 http://localhost:3001 已启动');
  }
}

export async function sendMessageStream(
  message: string,
  history: ChatMessage[] = [],
  onChunk: (chunk: string) => void,
  onSources: (sources: Source[]) => void
): Promise<void> {
  const response = await postChat('/api/chat/stream', message, history);

  if (!response.ok) {
    throw await readChatError(response);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('无法读取响应流');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;

      // 只有"这一行不是完整 JSON"可以跳过；事件处理里的异常必须冒泡，
      // 否则服务端明确发来的 error 事件会被一起吞掉
      let data: { type?: string; sources?: Source[]; content?: string; error?: string };
      try {
        data = JSON.parse(line.slice(6));
      } catch {
        continue;
      }

      switch (data.type) {
        case 'sources':
          if (data.sources) onSources(data.sources);
          break;
        case 'chunk':
          if (typeof data.content === 'string' && data.content) onChunk(data.content);
          break;
        case 'error':
          throw new Error(data.error || '服务端返回错误');
      }
    }
  }
}

export interface HealthStatus {
  status: string;
  documents_count: number;
  vector_backend: string | null;
  embedding?: string;
  llm_model?: string;
  has_llm: boolean;
  /** ready | unreachable | disabled —— 决定页面是"AI 回答"还是"只有检索结果" */
  llm_status?: 'ready' | 'unreachable' | 'disabled';
  llm_error?: string | null;
}

export async function checkHealth(): Promise<HealthStatus> {
  const response = await fetch(`${API_BASE}/api/health`);
  return response.json();
}
