import { describe, expect, it, vi } from 'vitest';
import { AiJwtAuthGuard } from './ai-jwt-auth.guard.js';
import { AdminGuard } from '../users/admin.guard.js';
import { AiAgentService } from './ai-agent.service.js';
import { AiQueryCacheService } from './ai-query-cache.service.js';
import { AiTenantScopeService } from './ai-tenant-scope.service.js';
import { ToolRegistryService } from './tools/tool-registry.service.js';
import { BaseTool } from './tools/base-tool.js';

const actor = { id: 'alice', email: 'alice@example.test' };
const config = (values: Record<string, string> = {}) => ({ get: (key: string) => values[key] });
const context = (request: object) => ({ switchToHttp: () => ({ getRequest: () => request }) });

describe('Authentication and ownership', () => {
  it('rejects missing, expired, deleted and disabled identities', async () => {
    const jwt = { verifyAsync: vi.fn().mockResolvedValue({ sub: actor.id, email: actor.email }) };
    const users = { findOneBy: vi.fn().mockResolvedValue({ ...actor, status: 'Active' }) };
    const guard = new AiJwtAuthGuard(jwt as never, users as never);
    await expect(guard.canActivate(context({ headers: {} }) as never)).rejects.toThrow('Bearer');
    const request = { headers: { authorization: 'Bearer test' } };
    expect(await guard.canActivate(context(request) as never)).toBe(true);
    for (const value of [null, { ...actor, status: 'Inactive' }]) {
      users.findOneBy.mockResolvedValueOnce(value);
      await expect(guard.canActivate(context(request) as never)).rejects.toThrow('invalid or expired');
    }
    jwt.verifyAsync.mockRejectedValueOnce(new Error('expired'));
    await expect(guard.canActivate(context(request) as never)).rejects.toThrow('invalid or expired');
  });
  it('does not allow members to manage users', async () => {
    const users = { findOneBy: vi.fn().mockResolvedValue({ role: 'Member', status: 'Active' }) };
    const guard = new AdminGuard(users as never);
    await expect(guard.canActivate(context({ user: actor }) as never)).rejects.toThrow('Administrator');
    users.findOneBy.mockResolvedValueOnce({ role: 'Admin', status: 'Active' });
    expect(await guard.canActivate(context({ user: actor }) as never)).toBe(true);
  });
  it('scopes even admin sessions and memories to their owner', async () => {
    const qb = { where: vi.fn().mockReturnThis(), andWhere: vi.fn().mockReturnThis(), getOne: vi.fn().mockResolvedValue(null) };
    const service = Object.create(AiAgentService.prototype) as AiAgentService;
    Object.assign(service, { sessions: { createQueryBuilder: () => qb }, memories: { createQueryBuilder: () => qb }, users: { findOne: async () => ({ role: 'Admin' }) } });
    await expect(service.findSession('bob-session', actor)).rejects.toThrow('not found');
    expect(qb.andWhere).toHaveBeenCalledWith('session.owner = :userId', { userId: actor.id });
    await expect(service.findMemory('bob-memory', actor)).rejects.toThrow('not found');
    expect(qb.andWhere).toHaveBeenCalledWith('memory.owner = :userId', { userId: actor.id });
  });
  it('uses a server-owned tenant mapping, with no client-selected tenant', () => {
    const tenants = new AiTenantScopeService(config({ AI_USER_TENANTS: JSON.stringify({ alice: 'tenant-a', bob: 'tenant-b' }) }) as never);
    expect(tenants.sameTenant('alice', 'bob')).toBe(false);
    expect(tenants.sameTenant('alice', 'alice')).toBe(true);
  });
  it('blocks editing execution-managed and finished task state', async () => {
    const service = Object.create(AiAgentService.prototype) as AiAgentService;
    const findTask = vi.fn();
    Object.assign(service, { findTask });
    findTask.mockResolvedValue({ taskType: 'company_search', status: 'running' });
    await expect(service.updateTask('task', { progress: 50 }, actor)).rejects.toThrow('Execution-managed');
    findTask.mockResolvedValue({ taskType: 'manual', status: 'completed' });
    await expect(service.updateTask('task', { progress: 50 }, actor)).rejects.toThrow('Finished');
    findTask.mockResolvedValue({ taskType: 'manual', status: 'queued', progress: 0 });
    await expect(service.updateTask('task', { status: 'completed', progress: 50 }, actor)).rejects.toThrow('inconsistent');
  });
  it('limits administrator audit queries to their tenant, including orphaned audit records', async () => {
    const tenants = new AiTenantScopeService(config({ AI_USER_TENANTS: JSON.stringify({ alice: 'A', bob: 'B' }) }) as never);
    const qb = { where: vi.fn().mockReturnThis(), andWhere: vi.fn().mockReturnThis(), orderBy: vi.fn().mockReturnThis(), skip: vi.fn().mockReturnThis(), take: vi.fn().mockReturnThis(), getManyAndCount: vi.fn().mockResolvedValue([[], 0]), getOne: vi.fn() };
    const service = Object.create(AiAgentService.prototype) as AiAgentService;
    Object.assign(service, { audits: { createQueryBuilder: () => qb }, tenantScope: tenants, users: { findOne: async () => ({ role: 'Admin' }), find: async () => [{ id: 'alice' }, { id: 'bob' }] } });
    await service.listAudits(actor, { page: 1, pageSize: 20 });
    expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining('tenantId'), { tenantOwnerIds: ['alice'], auditTenant: 'A' });
    await expect(service.listAudits(actor, { page: 1, pageSize: 20, userId: 'bob' })).rejects.toThrow('another tenant');
    qb.getOne.mockResolvedValueOnce({ userId: 'bob', tenantId: 'B' });
    await expect(service.findAudit('audit', actor)).rejects.toThrow('not found');
    qb.getOne.mockResolvedValueOnce({ userId: null, tenantId: 'B' });
    await expect(service.findAudit('audit', actor)).rejects.toThrow('not found');
    qb.getOne.mockResolvedValueOnce({ userId: null, tenantId: 'A' });
    expect(await service.findAudit('audit', actor)).toMatchObject({ tenantId: 'A' });
  });
  it('prevents administrators from changing users in another tenant', async () => {
    const tenants = new AiTenantScopeService(config({ AI_USER_TENANTS: JSON.stringify({ alice: 'A', bob: 'B' }) }) as never);
    const guard = new AdminGuard({ findOneBy: async () => ({ id: 'alice', role: 'Admin', status: 'Active' }) } as never, tenants);
    await expect(guard.canActivate(context({ user: actor, params: { id: 'bob' }, method: 'PATCH' }) as never)).rejects.toThrow('another tenant');
  });
  it('restores only the latest ten rounds after short-term cache expiry', async () => {
    const messages = Array.from({ length: 30 }, (_, i) => ({ id: `${i}` }));
    const redis = { get: vi.fn().mockResolvedValue(null), set: vi.fn() };
    const service = Object.create(AiAgentService.prototype) as AiAgentService;
    Object.assign(service, { redis, findSessionForActor: async () => ({ userId: actor.id, messages }) });
    const session = await service.findSession('chat', actor);
    expect(session.messages).toHaveLength(30);
    expect(redis.set).toHaveBeenCalledWith('ai:session:alice:chat', messages.slice(-20), 7200);
  });
});

describe('Business query cache', () => {
  function setup(values: Record<string, string> = {}) {
    const data = new Map<string, unknown>();
    const redis = { get: vi.fn(async (key) => data.get(key) ?? null), set: vi.fn(async (key, value) => { data.set(key, value); }), deletePattern: vi.fn() };
    const cache = new AiQueryCacheService(redis as never, config(values) as never);
    return { cache, redis };
  }
  it('isolates users, supports business TTL/disable, and never caches writes', async () => {
    const { cache } = setup({ AI_CACHE_COMPANIES_TTL_SECONDS: '45' });
    const a = await cache.key('alice', 'search_companies_table', { country: 'Japan' });
    const b = await cache.key('bob', 'search_companies_table', { country: 'Japan' });
    expect(a?.ttl).toBe(45); expect(a?.key).not.toBe(b?.key);
    for (const tool of ['start_company_search_task', 'set_task_progress', 'remember_user_preference', 'forget_user_memory']) expect(await cache.key('alice', tool, {})).toBeNull();
    expect(await setup({ AI_CACHE_COMPANIES_ENABLED: 'false' }).cache.key('alice', 'search_companies_table', {})).toBeNull();
  });
  it('changes generation after mutation so stale in-flight writes cannot be reused', async () => {
    const { cache, redis } = setup();
    const first = await cache.key('alice', 'search_companies_table', {});
    await cache.invalidate('COMPANIES');
    const next = await cache.key('alice', 'search_companies_table', {});
    expect(next?.key).not.toBe(first?.key);
    expect(redis.deletePattern).toHaveBeenCalledWith('ai:chat_cache:*:COMPANIES:*');
  });
  it('rechecks permissions before serving a cache hit', async () => {
    const { cache, redis } = setup();
    class Query extends BaseTool {
      name = 'search_companies_table'; description = 'test'; intent = 'QUERY_DATA' as const; requiredPermission = 'companies:read';
      parameters = { type: 'object' as const, properties: {} };
      execute = vi.fn(async () => ({ data: [1], message: 'ok', resultType: 'table' as const }));
    }
    const tool = new Query();
    const permissions = { assertCanExecute: vi.fn().mockResolvedValue(undefined) };
    const audit = { recordInvocation: vi.fn() };
    const registry = new ToolRegistryService(config() as never, [tool], audit as never, permissions as never, cache, redis as never);
    await registry.execute(tool.name, {}, { actor });
    await registry.execute(tool.name, {}, { actor });
    expect(tool.execute).toHaveBeenCalledTimes(1);
    permissions.assertCanExecute.mockRejectedValueOnce(new Error('denied'));
    expect((await registry.execute(tool.name, {}, { actor })).code).not.toBe(200);
  });
});
