import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomUUID } from 'node:crypto';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { User } from '../users/user.entity.js';
import { AiChatSession, type AiChatMessage } from './ai-chat-session.entity.js';
import { AiUserMemory } from './ai-memory.entity.js';
import { AiOperationAudit } from './ai-operation-audit.entity.js';
import { AiTaskRecord } from './ai-task-record.entity.js';
import { AiRedisService } from './ai-redis.service.js';
import type { AiAuthenticatedUser } from './ai-current-user.js';
import type { AiProviderName, CreateChatSessionDto, UpdateChatSessionDto } from './dto/create-chat-session.dto.js';
import type { SendChatMessageDto } from './dto/send-chat-message.dto.js';
import type { AiPageQueryDto, CreateAiAuditDto, CreateAiMemoryDto, CreateAiTaskDto, UpdateAiAuditDto, UpdateAiMemoryDto, UpdateAiTaskDto } from './dto/ai-resource.dto.js';
import { AiModelService } from './ai-model.service.js';
import { AiAgentToolsService } from './ai-agent-tools.service.js';
import { AiAgentMemoryService } from './ai-agent-memory.service.js';

const SESSION_TTL_SECONDS = 2 * 60 * 60;
const CHAT_CACHE_TTL_SECONDS = 10 * 60;
const TASK_STATE_TTL_SECONDS = 24 * 60 * 60;

@Injectable()
export class AiAgentService {
  constructor(
    @InjectRepository(AiChatSession) private readonly sessions: Repository<AiChatSession>,
    @InjectRepository(AiUserMemory) private readonly memories: Repository<AiUserMemory>,
    @InjectRepository(AiTaskRecord) private readonly tasks: Repository<AiTaskRecord>,
    @InjectRepository(AiOperationAudit) private readonly audits: Repository<AiOperationAudit>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly aiModelService: AiModelService,
    private readonly agentTools: AiAgentToolsService,
    private readonly redis: AiRedisService,
    private readonly memoryContext: AiAgentMemoryService,
  ) {}

  async findAllSessions(actor: AiAuthenticatedUser, query: AiPageQueryDto) {
    const qb = this.sessions.createQueryBuilder('session').select([
      'session.id', 'session.title', 'session.provider', 'session.model', 'session.createdAt', 'session.updatedAt',
    ]);
    await this.applyOwnerFilter(qb, 'session', actor, query.userId);
    const [items, total] = await qb.orderBy('session.updatedAt', 'DESC')
      .skip((query.page - 1) * query.pageSize).take(query.pageSize).getManyAndCount();
    return this.page(items.map(({ messages: _messages, ...summary }) => summary), total, query);
  }

  findProviders() {
    return this.aiModelService.getProviders().map(({ id, label, model, configured }) => ({ id, label, model, configured }));
  }

  async findSession(id: string, actor: AiAuthenticatedUser) {
    const session = await this.findSessionForActor(id, actor);
    if (!session) throw new NotFoundException('Chat session not found');
    const key = `ai:session:${session.userId ?? actor.id}:${id}`;
    const recent = await this.redis.get<AiChatMessage[]>(key);
    if (!recent) await this.redis.set(key, session.messages.slice(-20), SESSION_TTL_SECONDS);
    return session;
  }

  async createSession(dto: CreateChatSessionDto, actor: AiAuthenticatedUser) {
    const provider = dto.provider ?? this.aiModelService.getDefaultProvider();
    const providerInfo = this.aiModelService.getProviderInfo(provider);
    const session = await this.sessions.save(this.sessions.create({
      title: dto.title?.trim() || 'New chat', provider, model: providerInfo.model, messages: [], owner: { id: actor.id } as User,
    }));
    await this.writeAudit(actor.id, 'session.create', 'ai_chat_sessions', session.id);
    return session;
  }

  async updateSession(id: string, dto: UpdateChatSessionDto, actor: AiAuthenticatedUser) {
    const session = await this.findSessionForActor(id, actor);
    if (dto.title !== undefined) session.title = dto.title.trim();
    if (dto.provider !== undefined) {
      const providerInfo = this.aiModelService.getProviderInfo(dto.provider);
      session.provider = dto.provider;
      session.model = providerInfo.model;
    }
    const saved = await this.sessions.save(session);
    const ownerId = session.userId ?? actor.id;
    await this.redis.delete(`ai:session:${ownerId}:${id}`);
    await this.redis.deletePattern(`ai:chat_cache:${ownerId}:*`);
    await this.writeAudit(actor.id, 'session.update', 'ai_chat_sessions', id, { changedFields: Object.keys(dto) });
    return saved;
  }

  async deleteSession(id: string, actor: AiAuthenticatedUser) {
    const session = await this.findSessionForActor(id, actor);
    await this.sessions.remove(session);
    const ownerId = session.userId ?? actor.id;
    await this.redis.delete(`ai:session:${ownerId}:${id}`);
    await this.redis.deletePattern(`ai:chat_cache:${ownerId}:*`);
    await this.writeAudit(actor.id, 'session.delete', 'ai_chat_sessions', id);
    return { deleted: true, id };
  }

  async sendMessage(id: string, dto: SendChatMessageDto, actor: AiAuthenticatedUser) {
    const session = await this.findSessionForActor(id, actor);
    const content = dto.content.trim();
    const attachments = (dto.attachments ?? []).map(({ name, type, size, textContent }) => ({ name, type, size, textContent }));
    if (!content && !attachments.length) throw new BadRequestException('Message text or an attachment is required');

    const userMessage: AiChatMessage = { id: randomUUID(), role: 'user', content, attachments, createdAt: new Date().toISOString() };
    const conversation = [...session.messages, userMessage];
    const ownerId = session.userId ?? actor.id;
    const sessionKey = `ai:session:${ownerId}:${id}`;
    const cachedContext = await this.redis.get<AiChatMessage[]>(sessionKey);
    const modelContext = [...(cachedContext ?? session.messages.slice(-20)), userMessage].slice(-20);
    const savedMemories = await this.memoryContext.buildContext(actor.id);
    const memoryContext = savedMemories.length ? JSON.stringify(savedMemories).slice(0, 6_000) : '';
    const provider = (session.provider || this.aiModelService.getDefaultProvider()) as AiProviderName;
    const promptIdentity = modelContext.map(({ role, content, attachments }) => ({ role, content, attachments }));
    const digest = createHash('sha256').update(JSON.stringify({ provider, model: session.model, toolVersion: 'company-search-task-v7', memoryContext, messages: promptIdentity })).digest('hex');
    const cacheKey = `ai:chat_cache:${ownerId}:${digest}`;
    let reply = await this.redis.get<{ content: string; model: string }>(cacheKey);
    if (!reply) {
      reply = await this.aiModelService.generateReply(provider, modelContext, async (toolName, args) => {
        const result = await this.agentTools.execute(toolName, args, actor);
        const taskId = typeof result === 'object' && result !== null && 'taskId' in result && typeof result.taskId === 'string'
          ? result.taskId
          : null;
        await this.writeAudit(actor.id, 'agent.tool.invoke', toolName, taskId, { toolName });
        return result;
      }, memoryContext);
      await this.redis.set(cacheKey, reply, CHAT_CACHE_TTL_SECONDS);
    }
    const assistantMessage: AiChatMessage = { id: randomUUID(), role: 'assistant', content: reply.content, createdAt: new Date().toISOString() };

    if (session.title === 'New chat') session.title = (content || attachments[0]?.name || 'New chat').slice(0, 40);
    session.provider = provider;
    session.model = reply.model;
    session.messages = [...conversation, assistantMessage];
    const saved = await this.sessions.save(session);
    await this.redis.set(sessionKey, saved.messages.slice(-20), SESSION_TTL_SECONDS);
    await this.writeAudit(actor.id, 'session.message', 'ai_chat_sessions', id, { provider, messageCount: saved.messages.length });
    return saved;
  }

  async listMemories(actor: AiAuthenticatedUser, query: AiPageQueryDto) {
    const qb = this.memories.createQueryBuilder('memory');
    await this.applyOwnerFilter(qb, 'memory', actor, query.userId);
    qb.andWhere('(memory.expiresAt IS NULL OR memory.expiresAt > NOW())');
    const [items, total] = await qb.orderBy('memory.updatedAt', 'DESC').skip((query.page - 1) * query.pageSize).take(query.pageSize).getManyAndCount();
    return this.page(items, total, query);
  }

  async createMemory(dto: CreateAiMemoryDto, actor: AiAuthenticatedUser) {
    const exists = await this.memories.createQueryBuilder('memory').where('memory.owner = :userId AND memory.key = :key', { userId: actor.id, key: dto.key.trim() }).getOne();
    if (exists && (!exists.expiresAt || exists.expiresAt > new Date())) throw new ConflictException('A memory with this key already exists');
    if (exists) {
      exists.value = dto.value;
      exists.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
      const renewed = await this.memories.save(exists);
      await this.writeAudit(actor.id, 'memory.renew', 'ai_user_memory', renewed.id);
      return renewed;
    }
    const memory = await this.memories.save(this.memories.create({ key: dto.key.trim(), value: dto.value, expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null, owner: { id: actor.id } as User }));
    await this.writeAudit(actor.id, 'memory.create', 'ai_user_memory', memory.id);
    return memory;
  }

  async findMemory(id: string, actor: AiAuthenticatedUser) {
    const qb = this.memories.createQueryBuilder('memory').where('memory.id = :id AND (memory.expiresAt IS NULL OR memory.expiresAt > NOW())', { id });
    const user = await this.users.findOne({ where: { id: actor.id }, select: { id: true, role: true } });
    if (user?.role.toLowerCase() !== 'admin') qb.andWhere('memory.owner = :userId', { userId: actor.id });
    const item = await qb.getOne();
    if (!item) throw new NotFoundException('Memory not found');
    return item;
  }

  async updateMemory(id: string, dto: UpdateAiMemoryDto, actor: AiAuthenticatedUser) {
    const item = await this.findMemory(id, actor);
    if (dto.key !== undefined && dto.key.trim() !== item.key) {
      const duplicate = await this.memories.createQueryBuilder('memory').where('memory.owner = :userId AND memory.key = :key AND memory.id != :id', { userId: item.userId, key: dto.key.trim(), id }).getOne();
      if (duplicate && (!duplicate.expiresAt || duplicate.expiresAt > new Date())) throw new ConflictException('A memory with this key already exists');
      if (duplicate) await this.memories.remove(duplicate);
      item.key = dto.key.trim();
    }
    if (dto.value !== undefined) item.value = dto.value;
    if (dto.expiresAt !== undefined) item.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    const saved = await this.memories.save(item);
    await this.writeAudit(actor.id, 'memory.update', 'ai_user_memory', id);
    return saved;
  }

  async deleteMemory(id: string, actor: AiAuthenticatedUser) {
    const item = await this.findMemory(id, actor);
    await this.memories.remove(item);
    await this.writeAudit(actor.id, 'memory.delete', 'ai_user_memory', id);
    return { deleted: true, id };
  }

  async listTasks(actor: AiAuthenticatedUser, query: AiPageQueryDto) {
    const qb = this.tasks.createQueryBuilder('task');
    await this.applyOwnerFilter(qb, 'task', actor, query.userId);
    const [items, total] = await qb.orderBy('task.createdAt', 'DESC').skip((query.page - 1) * query.pageSize).take(query.pageSize).getManyAndCount();
    return this.page(items, total, query);
  }

  async createTask(dto: CreateAiTaskDto, actor: AiAuthenticatedUser) {
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    if (expiresAt && expiresAt <= new Date()) throw new BadRequestException('Task expiration must be in the future');
    const task = await this.tasks.save(this.tasks.create({ taskType: dto.taskType.trim(), input: dto.input ?? {}, expiresAt, owner: { id: actor.id } as User }));
    await this.redis.set(`ai:task_state:${actor.id}:${task.id}`, this.taskState(task), this.taskTtl(task));
    await this.writeAudit(actor.id, 'task.create', 'ai_task_record', task.id);
    return task;
  }

  async findTask(id: string, actor: AiAuthenticatedUser) {
    const task = await this.findOwnedOrAdmin(this.tasks, 'task', id, actor);
    if (!task) throw new NotFoundException('AI task not found');
    const key = `ai:task_state:${task.userId}:${id}`;
    const cached = await this.redis.get<{ status: AiTaskRecord['status']; progress: number; updatedAt: string }>(key);
    if (cached && cached.updatedAt === task.updatedAt.toISOString()) {
      task.status = cached.status;
      task.progress = cached.progress;
      return task;
    }
    await this.redis.set(key, this.taskState(task), this.taskTtl(task));
    return task;
  }

  async updateTask(id: string, dto: UpdateAiTaskDto, actor: AiAuthenticatedUser) {
    const task = await this.findTask(id, actor);
    if (dto.status !== undefined) task.status = dto.status;
    if (dto.progress !== undefined) task.progress = dto.progress;
    if (dto.input !== undefined) task.input = dto.input;
    if (dto.result !== undefined) task.result = dto.result;
    if (dto.error !== undefined) task.error = dto.error;
    const saved = await this.tasks.save(task);
    await this.redis.set(`ai:task_state:${saved.userId}:${id}`, this.taskState(saved), this.taskTtl(saved));
    await this.writeAudit(actor.id, 'task.update', 'ai_task_record', id, { status: saved.status, progress: saved.progress });
    return saved;
  }

  async deleteTask(id: string, actor: AiAuthenticatedUser) {
    const task = await this.findTask(id, actor);
    await this.tasks.remove(task);
    await this.redis.delete(`ai:task_state:${task.userId}:${id}`);
    await this.writeAudit(actor.id, 'task.delete', 'ai_task_record', id);
    return { deleted: true, id };
  }

  async listAudits(actor: AiAuthenticatedUser, query: AiPageQueryDto & { action?: string }) {
    const qb = this.audits.createQueryBuilder('audit');
    await this.applyOwnerFilter(qb, 'audit', actor, query.userId);
    if (query.action?.trim()) qb.andWhere('audit.action = :action', { action: query.action.trim() });
    const [items, total] = await qb.orderBy('audit.createdAt', 'DESC').skip((query.page - 1) * query.pageSize).take(query.pageSize).getManyAndCount();
    return this.page(items, total, query);
  }

  async createAudit(dto: CreateAiAuditDto, actor: AiAuthenticatedUser) {
    return this.writeAudit(actor.id, dto.action, dto.resourceType, dto.resourceId ?? null, dto.details ?? {});
  }

  async findAudit(id: string, actor: AiAuthenticatedUser) {
    const audit = await this.findOwnedOrAdmin(this.audits, 'audit', id, actor);
    if (!audit) throw new NotFoundException('Audit record not found');
    return audit;
  }

  async updateAudit(id: string, dto: UpdateAiAuditDto, actor: AiAuthenticatedUser) {
    await this.requireAdmin(actor.id);
    const audit = await this.findAudit(id, actor);
    if (dto.action !== undefined) audit.action = dto.action;
    if (dto.resourceType !== undefined) audit.resourceType = dto.resourceType;
    if (dto.resourceId !== undefined) audit.resourceId = dto.resourceId;
    if (dto.details !== undefined) audit.details = dto.details;
    await this.audits.save(audit);
    await this.writeAudit(actor.id, 'audit.update', 'ai_operation_audit', id, { changedFields: Object.keys(dto) });
    return this.findAudit(id, actor);
  }

  async deleteAudit(id: string, actor: AiAuthenticatedUser) {
    await this.requireAdmin(actor.id);
    const audit = await this.findAudit(id, actor);
    await this.audits.remove(audit);
    await this.writeAudit(actor.id, 'audit.delete', 'ai_operation_audit', id);
    return { deleted: true, id };
  }

  private async applyOwnerFilter(qb: SelectQueryBuilder<AiChatSession> | SelectQueryBuilder<AiTaskRecord> | SelectQueryBuilder<AiOperationAudit> | SelectQueryBuilder<AiUserMemory>, alias: string, actor: AiAuthenticatedUser, requestedUserId?: string) {
    const user = await this.users.findOne({ where: { id: actor.id }, select: { id: true, role: true } });
    const isAdmin = user?.role.toLowerCase() === 'admin';
    if (requestedUserId && !isAdmin && requestedUserId !== actor.id) throw new ForbiddenException('Cannot query another user’s AI data');
    const ownerId = isAdmin ? requestedUserId : actor.id;
    if (ownerId) qb.andWhere(`${alias}.owner = :ownerId`, { ownerId });
    else if (!isAdmin) qb.andWhere(`${alias}.owner = :ownerId`, { ownerId: actor.id });
    return qb;
  }

  private async findSessionForActor(id: string, actor: AiAuthenticatedUser) {
    const qb = this.sessions.createQueryBuilder('session').where('session.id = :id', { id });
    const user = await this.users.findOne({ where: { id: actor.id }, select: { id: true, role: true } });
    if (user?.role.toLowerCase() !== 'admin') qb.andWhere('session.owner = :userId', { userId: actor.id });
    const session = await qb.getOne();
    if (!session) throw new NotFoundException('Chat session not found');
    return session;
  }

  private async findOwnedOrAdmin<T extends AiUserMemory | AiTaskRecord | AiOperationAudit>(repository: Repository<T>, alias: string, id: string, actor: AiAuthenticatedUser) {
    const qb = repository.createQueryBuilder(alias).where(`${alias}.id = :id`, { id });
    const user = await this.users.findOne({ where: { id: actor.id }, select: { id: true, role: true } });
    if (user?.role.toLowerCase() !== 'admin') qb.andWhere(`${alias}.owner = :userId`, { userId: actor.id });
    return qb.getOne();
  }

  private async requireAdmin(userId: string) {
    const user = await this.users.findOne({ where: { id: userId }, select: { id: true, role: true } });
    if (user?.role.toLowerCase() !== 'admin') throw new ForbiddenException('Administrator role is required');
  }

  private async writeAudit(userId: string, action: string, resourceType: string, resourceId: string | null = null, details: Record<string, unknown> = {}) {
    return this.audits.save(this.audits.create({ owner: { id: userId } as User, action, resourceType, resourceId, details }));
  }

  private taskState(task: AiTaskRecord) {
    return { status: task.status, progress: task.progress, updatedAt: task.updatedAt.toISOString() };
  }

  private taskTtl(task: AiTaskRecord) {
    if (!task.expiresAt) return TASK_STATE_TTL_SECONDS;
    return Math.max(1, Math.ceil((task.expiresAt.getTime() - Date.now()) / 1000));
  }

  private page<T>(items: T[], total: number, query: AiPageQueryDto) {
    return { items, total, page: query.page, pageSize: query.pageSize, totalPages: Math.ceil(total / query.pageSize) };
  }
}
