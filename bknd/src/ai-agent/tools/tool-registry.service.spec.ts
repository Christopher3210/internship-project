import { ConfigService } from '@nestjs/config';
import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { BaseTool, type AiToolContext, type AiToolInput, type AiToolPayload } from './base-tool.js';
import { ToolRegistryService } from './tool-registry.service.js';

class TestQueryTool extends BaseTool {
  readonly name = 'test_query';
  readonly description = 'Test query tool';
  readonly intent = 'QUERY_DATA' as const;
  readonly requiredPermission = 'test:query';
  readonly parameters = { type: 'object' as const, properties: {}, additionalProperties: false };
  execute = vi.fn(async (_input: AiToolInput, _context: AiToolContext): Promise<AiToolPayload> => ({
    data: [{ value: 1 }],
    message: '查询完成',
    resultType: 'table',
  }));
}

function createRegistry(tools: BaseTool[] = [new TestQueryTool()], disabled = '') {
  const config = { get: vi.fn(() => disabled) } as unknown as ConfigService;
  const toolExecutionAudit = { recordInvocation: vi.fn(async () => undefined) };
  const permissionAllowed = { value: false };
  const permissions = {
    assertCanExecute: vi.fn(async () => {
      if (!permissionAllowed.value) throw new ForbiddenException('Forbidden');
    }),
  };
  return {
    registry: new ToolRegistryService(config, tools, toolExecutionAudit as never, permissions as never),
    toolExecutionAudit,
    permissionAllowed,
  };
}

describe('ToolRegistryService', () => {
  it('uses cached reads without reexecuting business logic, but still checks permissions and audits', async () => {
    const tool = new TestQueryTool();
    const audit = { recordInvocation: vi.fn() };
    const permissions = { assertCanExecute: vi.fn() };
    const cached = { code: 200, data: [{ value: 7 }], message: 'cached', resultType: 'table' };
    const redis = { get: vi.fn(async () => cached), set: vi.fn() };
    const registry = new ToolRegistryService({ get: () => '' } as never, [tool], audit as never, permissions as never, { key: async () => ({ key: 'fixture', ttl: 600 }) } as never, redis as never);
    const context = { actor: { id: 'owner', email: 'owner@example.test' } };
    expect(await registry.execute('test_query', {}, context)).toMatchObject({ cacheHit: true, data: [{ value: 7 }] });
    expect(tool.execute).not.toHaveBeenCalled();
    permissions.assertCanExecute.mockRejectedValue(new ForbiddenException());
    expect((await registry.execute('test_query', {}, context)).code).toBe(403);
    expect(redis.get).toHaveBeenCalledOnce(); expect(audit.recordInvocation).toHaveBeenCalledTimes(2);
  });
  it('registers tools and finds enabled tools by name or intent', () => {
    const { registry } = createRegistry();

    expect(registry.findByName('test_query')?.name).toBe('test_query');
    expect(registry.findByIntent('QUERY_DATA')).toHaveLength(1);
    expect(registry.findByIntent('STATISTICS_ANALYSIS')).toHaveLength(0);
  });

  it('supports environment disable and runtime enable/disable overrides', () => {
    const { registry } = createRegistry([new TestQueryTool()], 'test_query');

    expect(registry.findByName('test_query')).toBeUndefined();
    registry.setEnabled('test_query', true);
    expect(registry.findByName('test_query')).toBeDefined();
    registry.setEnabled('test_query', false);
    expect(registry.findByName('test_query')).toBeUndefined();
  });

  it('requires user identity and the tool permission before execution', async () => {
    const tool = new TestQueryTool();
    const { registry, toolExecutionAudit, permissionAllowed } = createRegistry([tool]);

    const denied = await registry.execute('test_query', {}, { actor: { id: 'user-1', email: 'user@example.com' } });
    expect(denied).toMatchObject({ code: 403, data: null, resultType: 'text' });
    expect(tool.execute).not.toHaveBeenCalled();

    permissionAllowed.value = true;
    const allowed = await registry.execute('test_query', {}, { actor: { id: 'user-1', email: 'user@example.com' } });
    expect(allowed).toMatchObject({ code: 200, data: [{ value: 1 }], resultType: 'table' });
    expect(tool.execute).toHaveBeenCalledOnce();
    expect(toolExecutionAudit.recordInvocation).toHaveBeenCalledTimes(2);
  });

  it('returns a standard error result for unknown tools', async () => {
    const { registry, toolExecutionAudit } = createRegistry();
    const result = await registry.execute('missing', {}, {
      actor: { id: 'user-1', email: 'user@example.com', permissions: [] },
    });

    expect(result).toMatchObject({ code: 404, data: null, resultType: 'text' });
    expect(toolExecutionAudit.recordInvocation).toHaveBeenCalledOnce();
  });
});
