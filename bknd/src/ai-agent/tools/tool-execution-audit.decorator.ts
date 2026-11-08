import type { AiToolContext, AiToolExecutionResult, AiToolInput } from './base-tool.js';
import type { ToolExecutionAuditService } from './tool-execution-audit.service.js';

type AuditedRegistry = {
  toolExecutionAudit: ToolExecutionAuditService;
};

/** Wraps a registry execution so success and failure results are both audited. */
export function AuditToolExecution() {
  return function (
    _target: object,
    _propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<(
      name: string,
      input: AiToolInput,
      context: AiToolContext,
    ) => Promise<AiToolExecutionResult>>,
  ) {
    const original = descriptor.value;
    if (!original) throw new Error('AuditToolExecution can only decorate a method');

    descriptor.value = async function (
      this: AuditedRegistry,
      name: string,
      input: AiToolInput,
      context: AiToolContext,
    ) {
      let result: AiToolExecutionResult | undefined;
      let thrown: unknown;
      try {
        result = await original.call(this, name, input, context);
        return result;
      } catch (error) {
        thrown = error;
        throw error;
      } finally {
        await this.toolExecutionAudit.recordInvocation(name, input, context, result, thrown);
      }
    };
    return descriptor;
  };
}
