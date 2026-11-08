import { Injectable } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { UsersService } from '../../users/users.service.js';
import { BaseTool, type AiToolContext, type AiToolInput, type AiToolJsonSchema, type AiToolPayload } from './base-tool.js';
import { validateToolInput } from './validate-tool-input.js';

class UserQueryInput implements AiToolInput {
  [key: string]: unknown;
  @IsOptional() @IsString() @MaxLength(80) name?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @ArrayUnique() @IsString({ each: true }) roles?: string[];
  @IsOptional() @IsString() @MaxLength(30) status?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100_000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
  @IsOptional() @IsIn(['name', 'email', 'role', 'status', 'createdAt']) sortBy?: 'name' | 'email' | 'role' | 'status' | 'createdAt';
  @IsOptional() @IsIn(['ASC', 'DESC']) sortOrder?: 'ASC' | 'DESC';
}

@Injectable()
export class UserQueryTool extends BaseTool<UserQueryInput> {
  readonly name = 'search_users';
  readonly description = 'Search users by name, one or more roles, and status. Results are paginated and only available to administrators.';
  readonly intent = 'QUERY_DATA' as const;
  readonly requiredPermission = 'ai:users:read';
  readonly parameters: AiToolJsonSchema = {
    type: 'object',
    properties: {
      name: { type: 'string', maxLength: 80 },
      roles: { type: 'array', items: { type: 'string' }, maxItems: 10, uniqueItems: true },
      status: { type: 'string', maxLength: 30 },
      page: { type: 'integer', minimum: 1, default: 1 },
      pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      sortBy: { type: 'string', enum: ['name', 'email', 'role', 'status', 'createdAt'] },
      sortOrder: { type: 'string', enum: ['ASC', 'DESC'] },
    },
    additionalProperties: false,
  };

  constructor(private readonly users: UsersService) { super(); }

  validate(input: AiToolInput) {
    return validateToolInput(UserQueryInput, input);
  }

  async execute(input: UserQueryInput, context: AiToolContext): Promise<AiToolPayload> {
    const result = await this.users.searchForAgent(input, context.actor.id);
    return { data: result, message: `找到 ${result.total} 位用户。`, resultType: 'table' };
  }
}
