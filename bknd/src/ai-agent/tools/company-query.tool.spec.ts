import { describe, expect, it, vi } from 'vitest';
import { CompanyQueryTool } from './company-query.tool.js';

describe('CompanyQueryTool', () => {
  it('delegates search filters to CompaniesService and adds efficiency/details for the collapsible table', async () => {
    const company = { companyCode: 'US-1', companyName: 'Example', level: 2, country: 'USA', city: 'Boston', foundedYear: 2000, annualRevenue: 1000, employees: 10 };
    const companies = {
      searchForAgent: vi.fn(async () => ({ items: [company], total: 1, page: 2, pageSize: 5, totalPages: 1 })),
    };
    const tool = new CompanyQueryTool(companies as never);
    const input = await tool.validate({ country: 'USA', city: 'Boston', levels: [2], page: 2, pageSize: 5 });
    const result = await tool.execute(input, { actor: { id: 'user-1', email: 'user@example.com' } });

    expect(companies.searchForAgent).toHaveBeenCalledWith(expect.objectContaining({ country: 'USA', city: 'Boston', levels: [2], page: 2, pageSize: 5 }));
    expect(result).toMatchObject({
      resultType: 'table',
      data: { items: [{ companyName: 'Example', profitabilityEfficiency: 100, details: { city: 'Boston', foundedYear: 2000, annualRevenue: 1000, employees: 10 } }] },
    });
  });
});
