import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity.js';
import { AiUserMemory } from './ai-memory.entity.js';
import { AiOperationAudit } from './ai-operation-audit.entity.js';

const MAX_MEMORY_VALUE_LENGTH = 500;
const MAX_CONTEXT_MEMORIES = 10;

@Injectable()
export class AiAgentMemoryService {
  constructor(
    @InjectRepository(AiUserMemory) private readonly memories: Repository<AiUserMemory>,
    @InjectRepository(AiOperationAudit) private readonly audits: Repository<AiOperationAudit>,
  ) {}

  async buildContext(userId: string) {
    const memories = await this.memories.createQueryBuilder('memory')
      .where('memory.owner = :userId', { userId })
      .andWhere('(memory.expiresAt IS NULL OR memory.expiresAt > NOW())')
      .orderBy('memory.updatedAt', 'DESC')
      .take(MAX_CONTEXT_MEMORIES)
      .getMany();
    return memories.map(({ key, value }) => ({ key, value }));
  }

  async listOwn(userId: string) {
    return this.buildContext(userId);
  }

  async remember(userId: string, keyInput: string, valueInput: string) {
    const key = keyInput.trim();
    const value = valueInput.trim();
    if (!key || key.length > 120) throw new Error('Memory key must contain 1 to 120 characters.');
    if (!value || value.length > MAX_MEMORY_VALUE_LENGTH) throw new Error(`Memory value must contain 1 to ${MAX_MEMORY_VALUE_LENGTH} characters.`);
    if (/password|passcode|api[_ -]?key|secret|access[_ -]?token|credit.?card/i.test(`${key} ${value}`)) {
      throw new Error('Secrets and credentials must not be stored in AI memory.');
    }

    const existing = await this.memories.createQueryBuilder('memory')
      .where('memory.owner = :userId AND memory.key = :key', { userId, key })
      .getOne();
    const memory = existing ?? this.memories.create({ key, owner: { id: userId } as User });
    memory.value = value;
    memory.expiresAt = null;
    const saved = await this.memories.save(memory);
    await this.audits.save(this.audits.create({
      owner: { id: userId } as User,
      action: existing ? 'memory.update' : 'memory.create',
      resourceType: 'ai_user_memory',
      resourceId: saved.id,
      details: { key, source: 'agent' },
    }));
    return { key: saved.key, value: saved.value };
  }

  async forget(userId: string, keyInput: string) {
    const key = keyInput.trim();
    const existing = await this.memories.createQueryBuilder('memory')
      .where('memory.owner = :userId AND memory.key = :key', { userId, key })
      .getOne();
    if (!existing) return { deleted: false, key };
    await this.memories.remove(existing);
    await this.audits.save(this.audits.create({
      owner: { id: userId } as User,
      action: 'memory.delete',
      resourceType: 'ai_user_memory',
      resourceId: existing.id,
      details: { key, source: 'agent' },
    }));
    return { deleted: true, key };
  }
}
