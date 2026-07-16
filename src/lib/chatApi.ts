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

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  timestamp: number;
}

export interface Source {
  title: string;
  category: string;
  url?: string;
  source: 'article' | 'question';
  content: string;
}

export interface ChatResponse {
  answer: string;
  sources: Source[];
}

export async function sendMessage(
  message: string,
  history: ChatMessage[] = []
): Promise<ChatResponse> {
  const response = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      message,
      history: history.map(msg => ({
        role: msg.role,
        content: msg.content
      }))
    })
  });

  if (!response.ok) {
    throw new Error('请求失败');
  }

  return response.json();
}

export async function sendMessageStream(
  message: string,
  history: ChatMessage[] = [],
  onChunk: (chunk: string) => void,
  onSources: (sources: Source[]) => void
): Promise<void> {
  const response = await fetch(`${API_BASE}/api/chat/stream`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      message,
      history: history.map(msg => ({
        role: msg.role,
        content: msg.content
      }))
    })
  });

  if (!response.ok) {
    throw new Error('请求失败');
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
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          
          switch (data.type) {
            case 'sources':
              onSources(data.sources);
              break;
            case 'chunk':
              onChunk(data.content);
              break;
            case 'error':
              throw new Error(data.error);
          }
        } catch (e) {
          // 忽略解析错误
        }
      }
    }
  }
}

export async function checkHealth(): Promise<{
  status: string;
  documents_count: number;
  has_llm: boolean;
}> {
  const response = await fetch(`${API_BASE}/api/health`);
  return response.json();
}
