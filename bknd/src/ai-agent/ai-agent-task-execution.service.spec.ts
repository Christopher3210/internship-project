import { describe, expect, it, vi } from 'vitest';
import { AiAgentTaskExecutionService } from './ai-agent-task-execution.service.js';

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-a',
    owner: { id: 'user-a' },
    taskType: 'demo',
    status: 'queued',
    progress: 0,
    input: {},
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeService(task: ReturnType<typeof makeTask>, companies: Record<string, unknown> = {}) {
  const tasks = {
    find: vi.fn().mockResolvedValue([task]),
    findOne: vi.fn().mockResolvedValue(task),
    create: vi.fn((input) => ({ ...task, ...input })),
    save: vi.fn(async (value) => ({ ...value, updatedAt: new Date() })),
  };
  const audits = { create: vi.fn((value) => value), save: vi.fn(async (value) => value) };
  const redis = { set: vi.fn(async () => undefined) };
  return {
    service: new AiAgentTaskExecutionService(tasks as never, audits as never, companies as never, redis as never),
    tasks,
    audits,
    redis,
  };
}

describe('AiAgentTaskExecutionService task tools', () => {
  it('creates a company search task and persists its matching results', async () => {
    const task = makeTask();
    const company = { companyCode: 'US-3', companyName: 'Example Supplier', level: 3, country: 'USA', city: 'Boston', annualRevenue: 100, employees: 12 };
    const { service } = makeService(task, { searchForAgent: vi.fn().mockResolvedValue({ total: 1, items: [company] }) });

    const queued = await service.enqueueCompanySearchTask({ country: 'USA', level: 3 }, 'user-a');
    for (let attempt = 0; attempt < 20 && task.status !== 'completed'; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1));
    }

    expect(queued).toMatchObject({ taskType: 'company_search', status: 'queued', filters: { country: 'USA', level: 3 } });
    expect(task.status).toBe('completed');
    expect(task.progress).toBe(100);
    expect(task.result).toMatchObject({ total: 1, items: [company] });
  });

  it('lists only the authenticated owner’s recent tasks', async () => {
    const { service, tasks } = makeService(makeTask());

    await service.listRecentTasks('user-a');

    expect(tasks.find).toHaveBeenCalledWith(expect.objectContaining({ where: { owner: { id: 'user-a' } }, take: 10 }));
  });

  it('updates progress and audits the change for the task owner', async () => {
    const { service, tasks, audits, redis } = makeService(makeTask());

    const result = await service.setTaskProgress('task-a', 'user-a', 50);

    expect(result).toMatchObject({ taskId: 'task-a', status: 'running', progress: 50 });
    expect(tasks.save).toHaveBeenCalled();
    expect(redis.set).toHaveBeenCalled();
    expect(audits.save).toHaveBeenCalledWith(expect.objectContaining({ action: 'task.progress.updated', owner: { id: 'user-a' } }));
  });

  it('rejects another user’s task without saving it', async () => {
    const { service, tasks } = makeService(makeTask());

    await expect(service.setTaskProgress('task-a', 'user-b', 50)).rejects.toThrow('not found for this user');
    expect(tasks.save).not.toHaveBeenCalled();
  });

  it('rejects completed tasks and invalid percentages', async () => {
    const completed = makeTask({ status: 'completed', progress: 100 });
    const completedService = makeService(completed).service;
    await expect(completedService.setTaskProgress('task-a', 'user-a', 50)).rejects.toThrow('already completed');

    const { service } = makeService(makeTask());
    await expect(service.setTaskProgress('task-a', 'user-a', 100)).rejects.toThrow('from 0 to 99');
  });

  it('does not allow manual progress changes on execution-managed tasks', async () => {
    const { service } = makeService(makeTask({ taskType: 'company_search', status: 'running', progress: 75 }));

    await expect(service.setTaskProgress('task-a', 'user-a', 50)).rejects.toThrow('execution-managed');
  });
});
