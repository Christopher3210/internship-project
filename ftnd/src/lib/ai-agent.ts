export const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
export const AI_ACCESS_TOKEN_KEY = 'internship-admin-access-token';

export function aiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const token = window.localStorage.getItem(AI_ACCESS_TOKEN_KEY);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}

export type AiProviderName = 'mock' | 'deepseek' | 'qwen' | 'openai' | 'kimi' | 'local';

export type AiProvider = {
  id: AiProviderName;
  label: string;
  model: string;
  configured: boolean;
};

export type ChatAttachment = {
  name: string;
  type: string;
  size: number;
  textContent?: string;
};

export type StructuredMessage =
  | { type: 'text'; text: string }
  | { type: 'table'; title?: string; columns: string[]; rows: Array<Array<string | number>> }
  | { type: 'chart'; title: string; labels: string[]; values: number[] }
  | { type: 'report'; title: string; summary: string; sections: Array<{ title: string; content: string }> }
  | { type: 'confirmation'; title: string; message: string; confirmLabel?: string };

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  attachments?: ChatAttachment[];
  structured?: StructuredMessage;
};

export type ChatSession = {
  id: string;
  title: string;
  provider: AiProviderName | null;
  model: string | null;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
};

export async function readApiError(response: Response) {
  try {
    const body = await response.json() as { message?: string | string[] };
    return Array.isArray(body.message) ? body.message.join('；') : body.message || `请求失败（${response.status}）`;
  } catch {
    return `请求失败（${response.status}）`;
  }
}
