import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AgentMessageRenderer } from './AgentMessageRenderer';
import type { ToolResult } from '@/lib/ai-agent';
const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('@/lib/ai-agent', () => ({ aiFetch: mocks.fetch, apiBaseUrl: 'http://local.test', readApiError: async () => 'Request denied' }));
vi.mock('react-chartjs-2', () => ({ Doughnut: () => <div>level chart</div>, Line: () => <div>year chart</div> }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const company = (page = 1): ToolResult => ({ code: 200, toolName: 'search_companies_table', input: { country: 'Japan' }, resultType: 'table', message: '找到 2 家公司。', data: { total: 2, page, totalPages: 2, pageSize: 1, items: [{ companyCode: `C${page}`, companyName: `Company ${page}`, level: 2, country: 'Japan', profitabilityEfficiency: 100, details: { city: 'Tokyo', annualRevenue: 200, employees: 2 } }] } });
const show = (result: ToolResult) => render(<AgentMessageRenderer message={undefined} content="Query completed" toolResults={[result]} sessionId="session" messageId="message" />);
describe('Agent structured results', () => {
  it('renders company table and opens details', () => {
    show(company()); expect(screen.getByText('Company 1')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    expect(screen.getByText('City: Tokyo')).toBeDefined();
  });
  it('loads page two from the saved query endpoint', async () => {
    mocks.fetch.mockResolvedValue({ ok: true, json: async () => company(2) });
    show(company()); fireEvent.click(screen.getByRole('button', { name: '下一页' }));
    await waitFor(() => expect(screen.getByText('Company 2')).toBeDefined());
    expect(mocks.fetch.mock.calls[0][0]).toContain('/sessions/session/messages/message/results/0?page=2');
  });
  it('renders user table', () => {
    show({ code: 200, resultType: 'table', message: 'One user', data: { items: [{ name: 'Demo member', email: 'demo@example.test', role: 'Member', status: 'Active' }], total: 1 } });
    expect(screen.getByText('Demo member')).toBeDefined(); expect(screen.getByText('demo@example.test')).toBeDefined();
  });
  it('renders metrics and both chart containers', () => {
    show({ code: 200, resultType: 'report', message: 'Statistics', data: { summary: { companyCount: 8, totalRevenue: 200, countryCount: 1, employeeCount: 10 }, levels: [{ level: 2, companyCount: 8, percentage: 100 }], years: [{ year: 2000, cumulativeCompanies: 8 }] } });
    expect(screen.getByText('8')).toBeDefined(); expect(screen.getByText('level chart')).toBeDefined(); expect(screen.getByText('year chart')).toBeDefined();
  });
  it('shows permission errors instead of a success table', () => {
    show({ code: 403, resultType: 'table', message: 'Permission denied', data: null });
    expect(screen.getByRole('alert').textContent).toContain('Permission denied'); expect(screen.queryByRole('table')).toBeNull();
  });
});
