import { describe, expect, it, vi } from 'vitest';
import { redactAuditValue, ToolExecutionAuditService } from './tool-execution-audit.service.js';

describe('ToolExecutionAuditService', () => {
  it('redacts financial and contact fields recursively', () => {
    expect(redactAuditValue({
      annualRevenue: 1_200_000,
      user: { email: 'person@example.com', phone: '+1 555 123 4567', name: 'Alex' },
      note: 'Contact person@example.com or +1 555 123 4567',
    })).toEqual({
      annualRevenue: '[REDACTED]',
      user: { email: '[REDACTED]', phone: '[REDACTED]', name: 'Alex' },
      note: 'Contact [REDACTED_EMAIL] or [REDACTED_PHONE]',
    });
  });

  it('stores actor, tool, operation, sanitized input/result, IP and timestamped audit entity', async () => {
    const audits = {
      create: vi.fn((input) => input),
      save: vi.fn(async (input) => input),
    };
    const service = new ToolExecutionAuditService(audits as never);

    await service.recordInvocation(
      'search_companies',
      { country: 'Japan', annualRevenue: 5_000_000 },
      { actor: { id: 'user-a', email: 'user@example.com' }, ip: '127.0.0.1' },
      { code: 200, data: [{ email: 'person@example.com', annualRevenue: 100 }], message: 'ok', resultType: 'table' },
    );

    expect(audits.save).toHaveBeenCalledWith(expect.objectContaining({
      action: 'tool.execute',
      resourceType: 'search_companies',
      ipAddress: '127.0.0.1',
      owner: { id: 'user-a' },
      details: expect.objectContaining({
        toolName: 'search_companies',
        operationType: 'execute',
        input: { country: 'Japan', annualRevenue: '[REDACTED]' },
        executionResult: {
          code: 200,
          data: [{ email: '[REDACTED]', annualRevenue: '[REDACTED]' }],
          message: 'ok',
          resultType: 'table',
        },
      }),
    }));
  });
});
