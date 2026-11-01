import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CompaniesService } from '../companies/companies.service.js';
import { User } from '../users/user.entity.js';
import { AiOperationAudit } from './ai-operation-audit.entity.js';
import { AiRedisService } from './ai-redis.service.js';
import { AiTaskRecord, type AiTaskStatus } from './ai-task-record.entity.js';

const TASK_STATE_TTL_SECONDS = 24 * 60 * 60;

/** Runs the first small, read-only background task and persists its progress. */
@Injectable()
export class AiAgentTaskExecutionService {
  private readonly logger = new Logger(AiAgentTaskExecutionService.name);

  constructor(
    @InjectRepository(AiTaskRecord) private readonly tasks: Repository<AiTaskRecord>,
    @InjectRepository(AiOperationAudit) private readonly audits: Repository<AiOperationAudit>,
    private readonly companies: CompaniesService,
    private readonly redis: AiRedisService,
  ) {}

  async enqueueCompanyProfileSummary(companyIdentifier: string, userId: string) {
    const task = await this.tasks.save(this.tasks.create({
      taskType: 'company_profile_summary',
      status: 'queued',
      progress: 0,
      input: { companyIdentifier },
      owner: { id: userId } as User,
    }));
    await this.cacheState(task, userId);
    await this.writeAudit(userId, 'task.queued', task.id, { taskType: task.taskType });

    // Start only after PostgreSQL has durably recorded the task.
    setImmediate(() => {
      void this.runCompanyProfileSummary(task.id, userId, companyIdentifier)
        .catch((error: unknown) => this.logger.error(`Task ${task.id} could not update its state`, error instanceof Error ? error.stack : undefined));
    });
    return { taskId: task.id, taskType: task.taskType, status: task.status, message: 'Company profile summary task was queued.' };
  }

  async listRecentTasks(userId: string) {
    const tasks = await this.tasks.find({
      where: { owner: { id: userId } },
      order: { updatedAt: 'DESC' },
      take: 10,
    });
    return tasks.map((task) => ({
      taskId: task.id,
      taskType: task.taskType,
      status: task.status,
      progress: task.progress,
      description: typeof task.input?.description === 'string' ? task.input.description : undefined,
      updatedAt: task.updatedAt,
    }));
  }

  async setTaskProgress(taskId: string, userId: string, progress: number) {
    if (!Number.isInteger(progress) || progress < 0 || progress > 99) {
      throw new Error('Progress must be a whole number from 0 to 99; task completion is controlled by the task itself.');
    }
    const task = await this.tasks.findOne({ where: { id: taskId }, relations: { owner: true } });
    if (!task || task.owner.id !== userId) throw new Error('Task was not found for this user.');
    if (task.status === 'completed' || task.status === 'failed') {
      throw new Error(`This task is already ${task.status}; its progress cannot be changed.`);
    }
    task.progress = progress;
    task.status = progress === 0 ? 'queued' : 'running';
    const saved = await this.tasks.save(task);
    await this.cacheState(saved, userId);
    await this.writeAudit(userId, 'task.progress.updated', taskId, { progress, status: saved.status, source: 'agent' });
    return { taskId, taskType: saved.taskType, status: saved.status, progress: saved.progress };
  }

  private async runCompanyProfileSummary(taskId: string, userId: string, companyIdentifier: string) {
    try {
      await this.updateState(taskId, userId, 'running', 10);
      const company = await this.companies.findOneByCodeOrExactName(companyIdentifier);
      if (!company) throw new Error("No company matched: " + companyIdentifier + ". Use the exact company name or company code.");

      await this.updateState(taskId, userId, 'running', 60);
      const result = {
        companyCode: company.companyCode,
        companyName: company.companyName,
        level: company.level,
        country: company.country,
        city: company.city,
        foundedYear: company.foundedYear,
        annualRevenue: company.annualRevenue,
        employees: company.employees,
        summary: company.companyName + " (" + company.companyCode + ") is a Level " + company.level + " supplier based in " + company.city + ", " + company.country + ". Founded in " + company.foundedYear + ", with annual revenue of " + company.annualRevenue.toLocaleString() + " and " + company.employees.toLocaleString() + " employees.",
        generatedAt: new Date().toISOString(),
      };
      await this.updateState(taskId, userId, 'completed', 100, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The company summary task failed';
      await this.updateState(taskId, userId, 'failed', 100, undefined, message);
    }
  }

  private async updateState(
    taskId: string,
    userId: string,
    status: AiTaskStatus,
    progress: number,
    result?: unknown,
    error?: string,
  ) {
    const task = await this.tasks.findOne({ where: { id: taskId }, relations: { owner: true } });
    if (!task || task.owner.id !== userId) return;
    task.status = status;
    task.progress = progress;
    if (result !== undefined) task.result = result;
    if (error !== undefined) task.error = error;
    await this.tasks.save(task);
    await this.cacheState(task, userId);
    await this.writeAudit(userId, `task.${status}`, taskId, { progress });
  }

  private async cacheState(task: AiTaskRecord, userId: string) {
    await this.redis.set(`ai:task_state:${userId}:${task.id}`, {
      status: task.status,
      progress: task.progress,
      updatedAt: task.updatedAt.toISOString(),
    }, TASK_STATE_TTL_SECONDS);
  }

  private async writeAudit(userId: string, action: string, taskId: string, details: Record<string, unknown>) {
    await this.audits.save(this.audits.create({
      owner: { id: userId } as User,
      action,
      resourceType: 'ai_task_record',
      resourceId: taskId,
      details,
    }));
  }
}
