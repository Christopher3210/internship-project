import { describe, it, expect, vi } from 'vitest';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { createWriteTools } from './business-write-tools.js';
import { WritePrevalidationService } from './write-prevalidation.service.js';
import { ToolRegistryService } from '../tools/tool-registry.service.js';

const id = '00000000-0000-4000-8000-000000000001';
const context = { actor: { id, email: 'admin@example.test' } };
function fixture() {
  const users = { validateCreate: vi.fn(), validateUpdate: vi.fn(), validateDelete: vi.fn(), create: vi.fn(), update: vi.fn(), removeMany: vi.fn() };
  const companies = { validateCreate: vi.fn(), validateUpdate: vi.fn(), validateDelete: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() };
  const permissions = { assertCanExecute: vi.fn() };
  const tenants = { sameTenant: vi.fn(() => true) };
  const validation = new WritePrevalidationService(permissions as never, tenants as never, users as never, companies as never);
  const tools = createWriteTools(validation);
  const audit = { recordInvocation: vi.fn() };
  const registry = new ToolRegistryService({ get: () => '' } as never, tools, audit as never, permissions as never);
  return { users, companies, permissions, tenants, tools, registry, audit };
}
const valid: Record<string, Record<string, unknown>> = {
  userCreateTool: { name: 'Test', email: 'test@example.test', role: 'Member', status: 'Active', password: 'private-password' },
  userUpdateTool: { id, changes: { name: 'New name' } },
  userDeleteTool: { id }, userBatchDeleteTool: { ids: [id] },
  companyCreateTool: { companyCode: 'QA_ONLY', companyName: 'QA', level: 2, country: 'Japan', city: 'Tokyo', foundedYear: 2000, annualRevenue: 100, employees: 2 },
  companyUpdateTool: { companyCode: 'QA_ONLY', changes: { level: 3 } },
  companyDeleteTool: { companyCode: 'QA_ONLY' },
};

describe('Business write safety boundary', () => {
  for (const [name, input] of Object.entries(valid)) {
    it(`${name}: previews and audits without writing`, async () => {
      const f = fixture();
      expect(await f.registry.preview(name, input, context)).toMatchObject({ code: 200, data: { executed: false, executionEnabled: false } });
      expect(f.audit.recordInvocation).toHaveBeenCalledOnce();
      for (const fn of [f.users.create, f.users.update, f.users.removeMany, f.companies.create, f.companies.update, f.companies.remove]) expect(fn).not.toHaveBeenCalled();
    });
    it(`${name}: cannot execute even when enabled`, async () => {
      const f = fixture();
      f.registry.setEnabled(name, true);
      expect((await f.registry.execute(name, input, context)).code).toBe(403);
      expect(f.registry.getDefinitions()).toEqual([]);
      await expect(f.tools.find(t => t.name === name)!.execute(input, context)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(f.tools.find(t => t.name === name)!.rollback()).rejects.toMatchObject({ status: 501 });
    });
  }
  it('blocks permission denial before DTO validation and business reads', async () => {
    const f = fixture(); f.permissions.assertCanExecute.mockRejectedValue(new ForbiddenException());
    expect((await f.registry.preview('userCreateTool', {}, context)).code).toBe(403);
    expect(f.users.validateCreate).not.toHaveBeenCalled();
  });
  it('checks permission even for direct preview calls', async () => {
    const f = fixture();
    await expect(f.tools[0].getPreview(valid.userCreateTool, { actor: {} } as never)).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('does not expose secrets in previews', async () => {
    const f = fixture();
    const result = await f.registry.preview('userCreateTool', valid.userCreateTool, context);
    expect(JSON.stringify(result)).not.toContain('private-password');
    expect(JSON.stringify(result)).not.toContain('test@example.test');
  });
  it('retains the exact business exception response', async () => {
    const f = fixture(); const error = new ConflictException('This email is already registered');
    f.users.validateCreate.mockRejectedValue(error);
    expect(await f.registry.preview('userCreateTool', valid.userCreateTool, context)).toMatchObject({ code: 409, error: error.getResponse() });
  });
  it('rejects missing business targets', async () => {
    const f = fixture(); f.companies.validateDelete.mockRejectedValue(new NotFoundException('Company not found'));
    expect((await f.registry.preview('companyDeleteTool', valid.companyDeleteTool, context)).code).toBe(404);
  });
  it('rejects cross-tenant target before reading it', async () => {
    const f = fixture(); f.tenants.sameTenant.mockReturnValue(false);
    expect((await f.registry.preview('userDeleteTool', { id }, context)).code).toBe(403);
    expect(f.users.validateDelete).not.toHaveBeenCalled();
  });
  for (const [name, input] of [
    ['userCreateTool', { ...valid.userCreateTool, email: 'invalid' }],
    ['userCreateTool', { ...valid.userCreateTool, actor: { role: 'Admin' } }],
    ['userBatchDeleteTool', { ids: [] }], ['userDeleteTool', { id: 'invalid' }],
    ['companyCreateTool', { ...valid.companyCreateTool, level: 99 }],
    ['companyUpdateTool', { companyCode: 'QA_ONLY', changes: {} }],
    ['companyDeleteTool', { companyCode: 'QA_ONLY', confirmed: true }],
  ] as const) {
    it(`rejects malformed input for ${name}: ${JSON.stringify(input)}`, async () => {
      expect((await fixture().registry.preview(name, input, context)).code).toBe(400);
    });
  }
});
