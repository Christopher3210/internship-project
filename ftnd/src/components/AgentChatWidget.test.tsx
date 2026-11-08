import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ChatSession } from '@/lib/ai-agent';
import { AgentChatWidget } from './AgentChatWidget';

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('@/lib/ai-agent', () => ({ aiFetch: mocks.fetch, apiBaseUrl: 'http://local.test', AI_ACCESS_TOKEN_KEY: 'test-token', readApiError: async () => 'Failed test request' }));
vi.mock('./AgentMessageRenderer', () => ({ AgentMessageRenderer: ({ content }: { content: string }) => <div>{content}</div> }));
const fixture = (id: string): ChatSession => ({ id, title: `Chat ${id}`, provider: 'mock', model: 'mock', messages: [], createdAt: '', updatedAt: '' });
const response = (value: unknown) => ({ ok: true, json: async () => value });
let finishReply: (value: unknown) => void;
let rejectReply: (reason: unknown) => void;

beforeEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
  mocks.fetch.mockImplementation(async (url: string, init?: { method?: string }) => {
    if (url.endsWith('/providers')) return response([{ id: 'mock', label: 'Demo', configured: true }]);
    if (url.endsWith('/messages')) return new Promise((resolve, reject) => { finishReply = resolve; rejectReply = reject; });
    if (url.endsWith('/sessions') && init?.method === 'POST') return response(fixture('C'));
    if (url.endsWith('/sessions')) return response({ items: [fixture('A'), fixture('B')] });
    if (url.endsWith('/close')) return response({ closed: true });
    return response(fixture(url.split('/').at(-1)!));
  });
});
afterEach(cleanup);

async function openAndSend() {
  render(<AgentChatWidget />);
  fireEvent.click(screen.getByLabelText('Open AI assistant'));
  await waitFor(() => expect(screen.getAllByRole('combobox')[1].textContent).toContain('Chat A'));
  const input = screen.getByPlaceholderText('Type a message (Enter to send, Shift+Enter for newline)');
  fireEvent.change(input, { target: { value: 'question A' } });
  fireEvent.click(screen.getByLabelText('Send message'));
  await waitFor(() => expect(mocks.fetch.mock.calls.some(([url]) => url.endsWith('/A/messages'))).toBe(true));
  return input;
}
async function chooseB() {
  fireEvent.mouseDown(screen.getAllByRole('combobox')[1]);
  fireEvent.click(await screen.findByRole('option', { name: 'Chat B' }));
  await waitFor(() => expect(screen.getAllByRole('combobox')[1].textContent).toContain('Chat B'));
}
const reply = { ...fixture('A'), messages: [{ id: 'reply', role: 'assistant', content: 'reply for A', createdAt: '' }] };

describe('Conversation race regressions', () => {
  it('does not jump back to A or overwrite B draft when A finishes', async () => {
    const input = await openAndSend();
    await chooseB();
    fireEvent.change(input, { target: { value: 'B draft' } });
    await act(async () => finishReply(response(reply)));
    expect(screen.getAllByRole('combobox')[1].textContent).toContain('Chat B');
    expect((input as HTMLInputElement).value).toBe('B draft');
    expect(screen.queryByText('reply for A')).toBeNull();
    expect(window.localStorage.getItem('internship-admin-ai-session')).toBe('B');
  });
  it('does not restore failed A input into B', async () => {
    const input = await openAndSend();
    await chooseB();
    fireEvent.change(input, { target: { value: 'B draft' } });
    await act(async () => rejectReply(new Error('A failed')));
    expect((input as HTMLInputElement).value).toBe('B draft');
    expect(screen.queryByText('A failed')).toBeNull();
  });
  it('keeps a newly created conversation selected after an old response', async () => {
    await openAndSend();
    fireEvent.click(screen.getByLabelText('New chat'));
    await waitFor(() => expect(screen.getAllByRole('combobox')[1].textContent).toContain('Chat C'));
    await act(async () => finishReply(response(reply)));
    expect(screen.getAllByRole('combobox')[1].textContent).toContain('Chat C');
  });
});
