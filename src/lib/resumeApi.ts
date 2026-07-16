/**
 * 简历优化 API 客户端
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

export interface ResumeOptimizeRequest {
  jd: string;
  resume: string;
}

export interface ResumeOptimizeResult {
  optimizedResume: string;
  suggestions: string[];
}

export async function optimizeResume(
  jd: string,
  resume: string,
  onChunk: (chunk: string) => void
): Promise<void> {
  const response = await fetch(`${API_BASE}/api/resume/optimize`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ jd, resume })
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
