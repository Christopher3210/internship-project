import type { AiAuthenticatedUser } from '../ai-current-user.js';

export type AiToolIntent = 'QUERY_DATA' | 'STATISTICS_ANALYSIS';
export type AiToolResultType = 'text' | 'table' | 'chart' | 'report';

export type AiToolJsonSchema = {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
};

export type AiToolInput = Record<string, unknown> & {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
};

/** Identity and request metadata are mandatory context for every tool invocation. */
export type AiToolContext = {
  actor: AiAuthenticatedUser & { permissions?: string[] };
  ip?: string;
  requestId?: string;
};

export type AiToolPayload<T = unknown> = {
  data: T;
  message: string;
  resultType: AiToolResultType;
};

export type AiToolExecutionResult<T = unknown> = AiToolPayload<T> & {
  toolName?: string;
  input?: Record<string, unknown>;
  code: number;
};

/** Base contract for tools. Implementations should delegate to business Services only. */
export abstract class BaseTool<TInput extends AiToolInput = AiToolInput, TData = unknown> {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly intent: AiToolIntent;
  abstract readonly requiredPermission: string;
  abstract readonly parameters: AiToolJsonSchema;

  abstract execute(input: TInput, context: AiToolContext): Promise<AiToolPayload<TData>>;

  async validate(input: AiToolInput): Promise<TInput> {
    return input as TInput;
  }

  toModelDefinition() {
    return {
      type: 'function' as const,
      function: {
        name: this.name,
        description: this.description,
        parameters: this.parameters,
      },
    };
  }
}
