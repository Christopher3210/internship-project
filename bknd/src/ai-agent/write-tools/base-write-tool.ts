import { ForbiddenException, NotImplementedException } from '@nestjs/common';
import { BaseTool, type AiToolContext, type AiToolInput, type AiToolPayload } from '../tools/base-tool.js';

/** Business writes are deliberately unavailable until a trusted confirmation dispatcher exists. */
export abstract class BaseWriteTool extends BaseTool {
  readonly intent = 'WRITE_DATA' as const;
  readonly kind = 'write' as const;
  readonly automaticExecution = false;
  abstract override validate(input: AiToolInput, context?: AiToolContext): Promise<AiToolInput>;
  abstract getPreview(input: AiToolInput, context: AiToolContext): Promise<AiToolPayload>;
  async execute(_input: AiToolInput, _context: AiToolContext): Promise<AiToolPayload> {
    throw new ForbiddenException('Business write execution is disabled; a trusted confirmation dispatcher is required');
  }
  async rollback(): Promise<never> {
    throw new NotImplementedException('Rollback is reserved, not implemented');
  }
}
