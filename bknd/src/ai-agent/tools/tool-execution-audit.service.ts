import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/user.entity.js';
import { AiOperationAudit } from '../ai-operation-audit.entity.js';
import type { AiToolContext, AiToolExecutionResult, AiToolInput } from './base-tool.js';

const SENSITIVE_FIELD = /(amount|revenue|price|cost|salary|phone|mobile|email|contact|address|bank|account|password|secret|token)/i;
const EMAIL_VALUE = /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g;
const PHONE_VALUE = /\+?\d[\d\s().-]{6,}\d/g;

export function redactAuditValue(value: unknown, key = ''): unknown {
  if (SENSITIVE_FIELD.test(key)) return '[REDACTED]';
  if (typeof value === 'string') {
    return value.replace(EMAIL_VALUE, '[REDACTED_EMAIL]').replace(PHONE_VALUE, (match) => {
      const digitCount = match.replace(/\D/g, '').length;
      return digitCount >= 7 && digitCount <= 15 ? '[REDACTED_PHONE]' : match;
    });
  }
  if (Array.isArray(value)) return value.map((item) => redactAuditValue(item));
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [
      childKey,
      redactAuditValue(childValue, childKey),
    ]));
  }
  return value;
}

@Injectable()
export class ToolExecutionAuditService {
  constructor(@InjectRepository(AiOperationAudit) private readonly audits: Repository<AiOperationAudit>) {}

  async recordInvocation(
    toolName: string,
    input: AiToolInput,
    context: AiToolContext,
    result?: AiToolExecutionResult,
    error?: unknown,
  ) {
    const outcome = result ?? {
      code: 500,
      data: null,
      message: error instanceof Error ? error.message : 'Tool execution failed',
      resultType: 'text' as const,
    };
    const details = redactAuditValue({
      userId: context.actor?.id ?? null,
      toolName,
      operationType: 'execute',
      input,
      executionResult: outcome,
      requestId: context.requestId,
    }) as Record<string, unknown>;

    await this.audits.save(this.audits.create({
      owner: context.actor?.id ? { id: context.actor.id } as User : null,
      action: 'tool.execute',
      resourceType: toolName,
      resourceId: null,
      ipAddress: context.ip ?? null,
      details,
    }));
  }
}
