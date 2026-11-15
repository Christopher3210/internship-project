import { BaseWriteTool } from './base-write-tool.js';
import { WritePrevalidationService, type WriteOperation } from './write-prevalidation.service.js';
import { redactAuditValue } from '../tools/tool-execution-audit.service.js';
import type { AiToolContext, AiToolInput, AiToolJsonSchema, AiToolPayload } from '../tools/base-tool.js';

export class BusinessWriteTool extends BaseWriteTool {
  readonly description = 'Business write skeleton. Preview only; execution is disabled.';
  readonly requiredPermission: string;
  readonly parameters: AiToolJsonSchema;
  constructor(readonly name: WriteOperation, private readonly validation: WritePrevalidationService) {
    super();
    this.requiredPermission = name.startsWith('user') ? 'ai:users:write' : 'ai:companies:write';
    const userFields = { name: { type: 'string' }, email: { type: 'string', format: 'email' }, role: { type: 'string' }, status: { type: 'string' }, password: { type: 'string', minLength: 8 } };
    const companyFields = { companyCode: { type: 'string', maxLength: 32 }, companyName: { type: 'string' }, level: { type: 'integer', minimum: 1, maximum: 4 }, country: { type: 'string' }, city: { type: 'string' }, foundedYear: { type: 'integer' }, annualRevenue: { type: 'integer', minimum: 0 }, employees: { type: 'integer', minimum: 0 }, parentCompany: { type: 'string' } };
    const user = name.startsWith('user');
    const fields = user ? userFields : companyFields;
    const target = user ? 'id' : 'companyCode';
    const targetSchema = user ? { type: 'string', format: 'uuid' } : { type: 'string', maxLength: 32 };
    this.parameters = name === 'userBatchDeleteTool'
      ? { type: 'object', properties: { ids: { type: 'array', minItems: 1, items: { type: 'string', format: 'uuid' } } }, required: ['ids'], additionalProperties: false }
      : name.includes('Create')
        ? { type: 'object', properties: fields, required: Object.keys(fields).filter(key => key !== 'parentCompany'), additionalProperties: false }
        : { type: 'object', properties: { [target]: targetSchema, ...(name.includes('Update') ? { changes: { type: 'object', properties: fields, minProperties: 1, additionalProperties: false } } : {}) }, required: [target, ...(name.includes('Update') ? ['changes'] : [])], additionalProperties: false };
  }
  override validate(input: AiToolInput, context?: AiToolContext) { return this.validation.validate(this.name, input, context); }
  async getPreview(input: AiToolInput, context: AiToolContext): Promise<AiToolPayload> {
    // Validate even on direct calls: a preview must never bypass authorization.
    const validated = await this.validate(input, context);
    return { data: { operation: this.name, changes: redactAuditValue(validated), executed: false, requiresConfirmation: true, executionEnabled: false }, message: '预校验通过，仅生成预览，未修改业务数据。真实执行尚未开放。', resultType: 'report' };
  }
}

export class UserCreateTool extends BusinessWriteTool { constructor(v: WritePrevalidationService) { super('userCreateTool', v); } }
export class UserUpdateTool extends BusinessWriteTool { constructor(v: WritePrevalidationService) { super('userUpdateTool', v); } }
export class UserDeleteTool extends BusinessWriteTool { constructor(v: WritePrevalidationService) { super('userDeleteTool', v); } }
export class UserBatchDeleteTool extends BusinessWriteTool { constructor(v: WritePrevalidationService) { super('userBatchDeleteTool', v); } }
export class CompanyCreateTool extends BusinessWriteTool { constructor(v: WritePrevalidationService) { super('companyCreateTool', v); } }
export class CompanyUpdateTool extends BusinessWriteTool { constructor(v: WritePrevalidationService) { super('companyUpdateTool', v); } }
export class CompanyDeleteTool extends BusinessWriteTool { constructor(v: WritePrevalidationService) { super('companyDeleteTool', v); } }

export function createWriteTools(v: WritePrevalidationService) {
  return [new UserCreateTool(v), new UserUpdateTool(v), new UserDeleteTool(v), new UserBatchDeleteTool(v), new CompanyCreateTool(v), new CompanyUpdateTool(v), new CompanyDeleteTool(v)];
}
