import { describe, expect, it, vi } from 'vitest';
import { AiAgentMemoryService } from './ai-agent-memory.service.js';

function makeMemoryService() {
  const queryBuilder = {
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    take: vi.fn().mockReturnThis(),
    getMany: vi.fn().mockResolvedValue([]),
    getOne: vi.fn().mockResolvedValue(null),
  };
  const memories = {
    createQueryBuilder: vi.fn(() => queryBuilder),
    create: vi.fn((input) => ({ id: 'memory-1', ...input })),
    save: vi.fn(async (item) => ({ ...item, updatedAt: new Date() })),
    remove: vi.fn(),
  };
  const audits = {
    create: vi.fn((input) => input),
    save: vi.fn(async (item) => item),
  };
  return { service: new AiAgentMemoryService(memories as never, audits as never), memories, audits, queryBuilder };
}

describe('AiAgentMemoryService', () => {
  it('scopes context memory reads to the authenticated user and active records', async () => {
    const { service, queryBuilder } = makeMemoryService();
    await service.buildContext('user-a');

    expect(queryBuilder.where).toHaveBeenCalledWith('memory.owner = :userId', { userId: 'user-a' });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('(memory.expiresAt IS NULL OR memory.expiresAt > NOW())');
    expect(queryBuilder.take).toHaveBeenCalledWith(10);
  });

  it('stores an explicit memory and writes an audit record', async () => {
    const { service, audits } = makeMemoryService();

    const result = await service.remember('user-a', 'preferred_language', 'Chinese');

    expect(result).toMatchObject({ key: 'preferred_language', value: 'Chinese' });
    expect(audits.save).toHaveBeenCalledWith(expect.objectContaining({ action: 'memory.create', resourceId: 'memory-1' }));
  });

  it('rejects credentials instead of saving them', async () => {
    const { service, memories } = makeMemoryService();

    await expect(service.remember('user-a', 'api_key', 'secret-value')).rejects.toThrow('must not be stored');
    expect(memories.save).not.toHaveBeenCalled();
  });
});
