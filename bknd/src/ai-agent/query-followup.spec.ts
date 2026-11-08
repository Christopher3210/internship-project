import { afterEach, describe, expect, it, vi } from 'vitest';
import { AiAgentService } from './ai-agent.service.js';
import { AiModelService } from './ai-model.service.js';

const actor = { id: 'owner', email: 'owner@example.test' };
const result = { code: 200, toolName: 'search_companies_table', input: { country: 'USA', levels: [3], pageSize: 20 }, resultType: 'table', data: { total: 39, page: 1, pageSize: 20, totalPages: 2, items: [{ companyCode: 'C002' }] }, message: 'Found 39' };

describe('Saved query pagination', () => {
  function setup(owner = actor.id, savedResult = result) {
    const execute = vi.fn().mockResolvedValue({ ...savedResult, data: { total: 39, page: 2 } });
    const service = Object.create(AiAgentService.prototype) as AiAgentService;
    Object.assign(service, { toolRegistry: { execute }, findSessionForActor: vi.fn().mockResolvedValue({ userId: owner, messages: [{ id: 'message', role: 'assistant', toolResults: [savedResult] }] }) });
    return { service, execute };
  }
  it('keeps original country and level filters for page two', async () => {
    const { service, execute } = setup();
    await service.getResultPage('session', 'message', 0, 2, actor);
    expect(execute).toHaveBeenCalledWith('search_companies_table', { country: 'USA', levels: [3], pageSize: 20, page: 2 }, expect.objectContaining({ actor }));
  });
  it('rejects a session belonging to another account', async () => {
    const { service, execute } = setup('another-owner');
    await expect(service.getResultPage('session', 'message', 0, 2, actor)).rejects.toThrow('Chat session not found');
    expect(execute).not.toHaveBeenCalled();
  });
  it('does not allow pagination to replay a write tool', async () => {
    const { service, execute } = setup(actor.id, { ...result, toolName: 'start_company_search_task' });
    await expect(service.getResultPage('session', 'message', 0, 2, actor)).rejects.toThrow('cannot be paginated');
    expect(execute).not.toHaveBeenCalled();
  });
});

describe('Query follow-up model context', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('sends the filtered total and original filters with assistant history', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: '39 companies' } }] }) });
    vi.stubGlobal('fetch', fetchMock);
    const config = { get: (key: string) => ({ LOCAL_LLM_BASE_URL: 'http://example.test/v1', LOCAL_LLM_MODEL: 'test' } as Record<string, string>)[key] };
    const model = new AiModelService(config as never, { getDefinitions: () => [] } as never);
    await model.generateReply('local', [
      { id: 'message', role: 'assistant', content: 'Company results', createdAt: '', toolResults: [result as never] },
      { id: 'question', role: 'user', content: '一共多少个，这就是全部了吗？', createdAt: '' },
    ]);
    const request = JSON.parse(fetchMock.mock.calls[0][1].body);
    const history = request.messages.find((message: { role: string }) => message.role === 'assistant').content;
    expect(history).toContain('"total":39');
    expect(history).toContain('"country":"USA"');
    expect(history).toContain('"levels":[3]');
  });
});
