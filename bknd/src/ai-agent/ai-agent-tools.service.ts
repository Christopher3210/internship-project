import { Injectable } from '@nestjs/common';
import { CompaniesService } from '../companies/companies.service.js';
import { DashboardService } from '../dashboard/dashboard.service.js';
import { AiAgentTaskExecutionService } from './ai-agent-task-execution.service.js';
import type { AiAuthenticatedUser } from './ai-current-user.js';
import { AiAgentMemoryService } from './ai-agent-memory.service.js';
import { BaseTool, type AiToolContext, type AiToolInput, type AiToolJsonSchema, type AiToolPayload, type AiToolResultType } from './tools/base-tool.js';

class RegisteredFunctionTool extends BaseTool {
  constructor(
    readonly name: string,
    readonly description: string,
    readonly intent: 'QUERY_DATA' | 'STATISTICS_ANALYSIS',
    readonly requiredPermission: string,
    readonly parameters: AiToolJsonSchema,
    private readonly handler: (input: AiToolInput, context: AiToolContext) => Promise<AiToolPayload>,
  ) { super(); }

  execute(input: AiToolInput, context: AiToolContext) {
    return this.handler(input, context);
  }
}

/** A small allowlist of read-only project operations available to the model. */
@Injectable()
export class AiAgentToolsService {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly companiesService: CompaniesService,
    private readonly taskExecution: AiAgentTaskExecutionService,
    private readonly memory: AiAgentMemoryService,
  ) {}

  getDefinitions() {
    return [
      {
        type: 'function' as const,
        function: {
          name: 'get_company_summary',
          description: 'Get the current company count, total revenue, country count, and employee count from the project database.',
          parameters: { type: 'object', properties: {}, additionalProperties: false },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'search_companies',
          description: 'Search for companies by name, country, and/or supplier level (1 to 4). Combine filters when requested (for example, Japanese level 2 suppliers means country Japan and level 2). At least one filter is required. Return at most 10 matching companies.',
          parameters: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Optional partial company name to search for.' },
              country: { type: 'string', description: 'Optional country name, preferably in the same language used in the database (e.g. Japan, USA, China).' },
              level: { type: 'integer', enum: [1, 2, 3, 4], description: 'Optional supplier level.' },
              limit: { type: 'integer', minimum: 1, maximum: 10, description: 'Maximum number of results; defaults to 5.' },
            },
            additionalProperties: false,
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'list_my_memories',
          description: 'List saved memories belonging to the authenticated user. Use this when the user asks what you remember.',
          parameters: { type: 'object', properties: {}, additionalProperties: false },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'remember_user_preference',
          description: 'Save or update a short user preference or fact only when the user explicitly asks you to remember it. Never store passwords, API keys, secrets, or access tokens.',
          parameters: {
            type: 'object',
            properties: {
              key: { type: 'string', minLength: 1, maxLength: 120, description: 'Short stable category, such as preferred_language or response_style.' },
              value: { type: 'string', minLength: 1, maxLength: 500, description: 'The preference or fact the user explicitly asked to remember.' },
            },
            required: ['key', 'value'],
            additionalProperties: false,
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'forget_user_memory',
          description: 'Delete one saved memory by its exact key when the authenticated user asks you to forget it.',
          parameters: {
            type: 'object',
            properties: { key: { type: 'string', minLength: 1, maxLength: 120 } },
            required: ['key'],
            additionalProperties: false,
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'list_my_tasks',
          description: 'List the authenticated user\'s 10 most recently updated AI tasks. Use this to identify a task before changing its progress.',
          parameters: { type: 'object', properties: {}, additionalProperties: false },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'set_task_progress',
          description: 'Set progress only on a manually tracked queued or running task belonging to the authenticated user. Automated company search and company summary tasks are execution-managed and cannot be manually adjusted.',
          parameters: {
            type: 'object',
            properties: {
              taskId: { type: 'string', format: 'uuid', description: 'The task ID to update.' },
              progress: { type: 'integer', minimum: 0, maximum: 99, description: 'Progress percentage. Use 0 to queue, or 1 to 99 to mark it running.' },
            },
            required: ['taskId', 'progress'],
            additionalProperties: false,
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'start_company_search_task',
          description: 'Create and execute a task for a company search, saving the filters and matching company records as the task result. Use this when the user asks to turn a company search into a task or save it as a task. Do not use the single-company summary task for search filters.',
          parameters: {
            type: 'object',
            properties: {
              name: { type: 'string', maxLength: 120, description: 'Optional company-name filter.' },
              country: { type: 'string', maxLength: 100, description: 'Optional country filter, e.g. USA, Japan, China.' },
              level: { type: 'integer', enum: [1, 2, 3, 4], description: 'Optional supplier level.' },
            },
            additionalProperties: false,
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'start_company_profile_summary',
          description: 'Create an owned background task that looks up one company by exact company name or code and saves a structured profile summary to the task record.',
          parameters: {
            type: 'object',
            properties: {
              companyIdentifier: { type: 'string', minLength: 1, maxLength: 160, description: 'Exact company name or company code.' },
            },
            required: ['companyIdentifier'],
            additionalProperties: false,
          },
        },
      },
    ];
  }

  getToolAdapters(): BaseTool[] {
    const permissionByTool: Record<string, string> = {
      get_company_summary: 'ai:dashboard:read',
      search_companies: 'ai:companies:read',
      list_my_memories: 'ai:memory:read',
      remember_user_preference: 'ai:memory:write',
      forget_user_memory: 'ai:memory:write',
      list_my_tasks: 'ai:tasks:read',
      set_task_progress: 'ai:tasks:write',
      start_company_search_task: 'ai:tasks:write',
      start_company_profile_summary: 'ai:tasks:write',
    };
    const intentByTool: Record<string, 'QUERY_DATA' | 'STATISTICS_ANALYSIS'> = {
      get_company_summary: 'STATISTICS_ANALYSIS',
      search_companies: 'QUERY_DATA',
      list_my_memories: 'QUERY_DATA',
      remember_user_preference: 'QUERY_DATA',
      forget_user_memory: 'QUERY_DATA',
      list_my_tasks: 'QUERY_DATA',
      set_task_progress: 'QUERY_DATA',
      start_company_search_task: 'QUERY_DATA',
      start_company_profile_summary: 'QUERY_DATA',
    };
    const resultTypeByTool: Record<string, AiToolResultType> = {
      get_company_summary: 'report',
      search_companies: 'table',
      list_my_memories: 'table',
      list_my_tasks: 'table',
    };

    return this.getDefinitions().map(({ function: definition }) => new RegisteredFunctionTool(
      definition.name,
      definition.description,
      intentByTool[definition.name] ?? 'QUERY_DATA',
      permissionByTool[definition.name] ?? 'ai:tool:unmapped',
      definition.parameters as AiToolJsonSchema,
      async (input, context) => ({
        data: await this.execute(definition.name, input, context.actor),
        message: '工具执行成功。',
        resultType: resultTypeByTool[definition.name] ?? 'text',
      }),
    ));
  }

  async execute(name: string, args: Record<string, unknown> = {}, actor?: AiAuthenticatedUser) {
    if (name === 'get_company_summary') {
      return this.dashboardService.getSummary();
    }
    if (name === 'search_companies') {
      const queryName = typeof args.name === 'string' ? args.name.trim() : '';
      let country = typeof args.country === 'string' ? args.country.trim() : '';
      const countryAliases: Record<string, string> = { '日本': 'Japan', '美国': 'USA', '美國': 'USA', '中国': 'China', '中國': 'China', '英国': 'UK', '英國': 'UK' };
      country = countryAliases[country] ?? country;
      const rawLevel = args.level;
      const level = rawLevel === undefined || rawLevel === null ? undefined : Number(rawLevel);
      if (!queryName && !country && level === undefined) throw new Error('Provide a company name, country, or supplier level to search');
      if (queryName.length > 120) throw new Error('Company name filter is too long');
      if (country.length > 100) throw new Error('Country filter is too long');
      if (level !== undefined && (!Number.isInteger(level) || level < 1 || level > 4)) throw new Error('Supplier level must be between 1 and 4');
      const requestedLimit = Number(args.limit ?? 5);
      const limit = Number.isInteger(requestedLimit) ? Math.max(1, Math.min(10, requestedLimit)) : 5;
      const result = await this.companiesService.searchForAgent({
        ...(queryName ? { name: queryName } : {}),
        ...(country ? { country } : {}),
        ...(level !== undefined ? { levels: [level] } : {}),
        limit,
      });
      return {
        total: result.total,
        returned: result.items.length,
        items: result.items.map(({ companyCode, companyName, level: supplierLevel, country, city, annualRevenue, employees }) => ({
          companyCode, companyName, level: supplierLevel, country, city, annualRevenue, employees,
        })),
      };
    }
    if (name === 'list_my_tasks') {
      if (!actor) throw new Error('An authenticated user is required to list tasks');
      return this.taskExecution.listRecentTasks(actor.id);
    }
    if (name === 'list_my_memories') {
      if (!actor) throw new Error('An authenticated user is required to list memories');
      return this.memory.listOwn(actor.id);
    }
    if (name === 'remember_user_preference') {
      if (!actor) throw new Error('An authenticated user is required to save a memory');
      const key = typeof args.key === 'string' ? args.key : '';
      const value = typeof args.value === 'string' ? args.value : '';
      return this.memory.remember(actor.id, key, value);
    }
    if (name === 'forget_user_memory') {
      if (!actor) throw new Error('An authenticated user is required to delete a memory');
      const key = typeof args.key === 'string' ? args.key : '';
      if (!key.trim()) throw new Error('Provide the exact memory key to forget.');
      return this.memory.forget(actor.id, key);
    }
    if (name === 'set_task_progress') {
      if (!actor) throw new Error('An authenticated user is required to update a task');
      const taskId = typeof args.taskId === 'string' ? args.taskId.trim() : '';
      const progress = Number(args.progress);
      if (!taskId) throw new Error('Provide a task ID');
      return this.taskExecution.setTaskProgress(taskId, actor.id, progress);
    }
    if (name === 'start_company_search_task') {
      if (!actor) throw new Error('An authenticated user is required to create a task');
      const companyName = typeof args.name === 'string' ? args.name.trim() : '';
      let country = typeof args.country === 'string' ? args.country.trim() : '';
      const countryAliases: Record<string, string> = { '日本': 'Japan', '美国': 'USA', '美國': 'USA', '中国': 'China', '中國': 'China', '英国': 'UK', '英國': 'UK' };
      country = countryAliases[country] ?? country;
      const rawLevel = args.level;
      const level = rawLevel === undefined || rawLevel === null ? undefined : Number(rawLevel);
      if (!companyName && !country && level === undefined) throw new Error('Provide at least one company search filter to create a task.');
      if (companyName.length > 120 || country.length > 100) throw new Error('A company search filter is too long.');
      if (level !== undefined && (!Number.isInteger(level) || level < 1 || level > 4)) throw new Error('Supplier level must be between 1 and 4.');
      return this.taskExecution.enqueueCompanySearchTask({
        ...(companyName ? { name: companyName } : {}),
        ...(country ? { country } : {}),
        ...(level !== undefined ? { level } : {}),
      }, actor.id);
    }
    if (name === 'start_company_profile_summary') {
      const companyIdentifier = typeof args.companyIdentifier === 'string' ? args.companyIdentifier.trim() : '';
      if (!companyIdentifier || companyIdentifier.length > 160) throw new Error('Provide an exact company name or company code');
      if (!actor) throw new Error('An authenticated user is required to create a task');
      return this.taskExecution.enqueueCompanyProfileSummary(companyIdentifier, actor.id);
    }
    throw new Error(`Tool is not allowed: ${name}`);
  }
}
