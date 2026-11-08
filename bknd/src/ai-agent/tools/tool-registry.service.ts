import { ForbiddenException, HttpException, Inject, Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { AiQueryCacheService } from '../ai-query-cache.service.js';
import { AiRedisService } from '../ai-redis.service.js';
import { ConfigService } from '@nestjs/config';
import { BaseTool, type AiToolContext, type AiToolExecutionResult, type AiToolInput, type AiToolIntent } from './base-tool.js';
import { AuditToolExecution } from './tool-execution-audit.decorator.js';
import { ToolExecutionAuditService } from './tool-execution-audit.service.js';
import { AiToolPermissionService } from './tool-permission.service.js';

export const AI_AGENT_TOOLS = Symbol('AI_AGENT_TOOLS');

@Injectable()
export class ToolRegistryService implements OnModuleInit {
  private readonly logger = new Logger(ToolRegistryService.name);
  private readonly tools = new Map<string, BaseTool>();
  private readonly enabledOverrides = new Map<string, boolean>();
  private readonly disabledByConfig: Set<string>;

  constructor(
    private readonly config: ConfigService,
    @Inject(AI_AGENT_TOOLS) tools: BaseTool[],
    readonly toolExecutionAudit: ToolExecutionAuditService,
    private readonly permissions: AiToolPermissionService,
    @Optional() private readonly queryCache?: AiQueryCacheService,
    @Optional() private readonly redis?: AiRedisService,
  ) {
    this.disabledByConfig = new Set(
      (this.config.get<string>('AI_DISABLED_TOOLS') ?? '')
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean),
    );
    for (const tool of tools) this.register(tool);
  }

  onModuleInit() {
    this.logger.log(`Registered ${this.tools.size} AI tool(s)`);
  }

  register(tool: BaseTool) {
    if (this.tools.has(tool.name)) throw new Error(`Duplicate AI tool registration: ${tool.name}`);
    this.tools.set(tool.name, tool);
  }

  findByName(name: string) {
    const tool = this.tools.get(name);
    return tool && this.isEnabled(name) ? tool : undefined;
  }

  findByIntent(intent: AiToolIntent) {
    return [...this.tools.values()].filter((tool) => tool.intent === intent && this.isEnabled(tool.name));
  }

  listEnabled() {
    return [...this.tools.values()].filter((tool) => this.isEnabled(tool.name));
  }

  getDefinitions() {
    return this.listEnabled().map((tool) => tool.toModelDefinition());
  }

  /** Runtime override; can later be exposed through an administrator-only config endpoint. */
  setEnabled(name: string, enabled: boolean) {
    if (!this.tools.has(name)) throw new Error(`Unknown AI tool: ${name}`);
    this.enabledOverrides.set(name, enabled);
  }

  isEnabled(name: string) {
    return this.enabledOverrides.get(name) ?? !this.disabledByConfig.has(name);
  }

  @AuditToolExecution()
  async execute(name: string, input: AiToolInput, context: AiToolContext): Promise<AiToolExecutionResult> {
    const tool = this.findByName(name);
    if (!tool) return { code: 404, data: null, message: '该 AI 工具不存在或当前已停用。', resultType: 'text' };

    try {
      await this.assertPermission(tool.requiredPermission, context);
      const validatedInput = await tool.validate(input);
      const cache = await this.queryCache?.key(context.actor.id, name, validatedInput);
      if (cache && this.redis) {
        const hit = await this.redis.get<AiToolExecutionResult>(cache.key);
        if (hit) return hit;
      }
      const result = await tool.execute(validatedInput, context);
      if (cache && this.redis) await this.redis.set(cache.key, { code: 200, ...result }, cache.ttl);
      return { code: 200, ...result };
    } catch (error) {
      const code = error instanceof HttpException ? error.getStatus() : 500;
      const message = error instanceof HttpException
        ? this.httpErrorMessage(error)
        : '工具执行失败，请稍后重试。';
      return { code, data: null, message, resultType: 'text' };
    }
  }

  private async assertPermission(requiredPermission: string, context: AiToolContext) {
    if (!context.actor?.id) throw new ForbiddenException('需要已登录用户身份才能调用工具。');
    await this.permissions.assertCanExecute(requiredPermission, context.actor.id);
  }

  private httpErrorMessage(error: HttpException) {
    const response = error.getResponse();
    if (typeof response === 'string') return response;
    if (typeof response === 'object' && response !== null && 'message' in response) {
      const message = response.message;
      if (typeof message === 'string') return message;
      if (Array.isArray(message) && message.every((item) => typeof item === 'string')) return message.join('；');
    }
    return error.message;
  }
}
