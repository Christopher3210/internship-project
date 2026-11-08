import { describe, expect, it, vi } from 'vitest';
import { UserQueryTool } from './user-query.tool.js';

describe('UserQueryTool', () => {
  it('validates defaults and delegates filters/pagination to UsersService', async () => {
    const users = {
      searchForAgent: vi.fn(async () => ({ items: [{ name: 'Ada', email: 'ada@example.com', role: 'Admin', status: 'Active' }], total: 1, page: 1, pageSize: 20, totalPages: 1 })),
    };
    const tool = new UserQueryTool(users as never);
    const input = await tool.validate({ name: 'Ada', roles: ['Admin'], status: 'Active' });

    expect(input.page).toBe(1);
    expect(input.pageSize).toBe(20);
    const result = await tool.execute(input, { actor: { id: 'admin-1', email: 'admin@example.com' } });

    expect(users.searchForAgent).toHaveBeenCalledWith(expect.objectContaining({ name: 'Ada', roles: ['Admin'], status: 'Active', page: 1, pageSize: 20 }), 'admin-1');
    expect(result).toMatchObject({ resultType: 'table', data: { items: [{ name: 'Ada', role: 'Admin', status: 'Active' }] } });
  });

  it('rejects unsupported fields instead of forwarding them to the business service', async () => {
    const users = { searchForAgent: vi.fn() };
    const tool = new UserQueryTool(users as never);

    await expect(tool.validate({ userId: 'someone-else' })).rejects.toThrow();
    expect(users.searchForAgent).not.toHaveBeenCalled();
  });
});
