import { describe, expect, it, vi } from 'vitest';
import { DashboardMetricsTool } from './dashboard-metrics.tool.js';

describe('DashboardMetricsTool', () => {
  it('reuses the dashboard service calculations with the supplied filters', async () => {
    const dashboard = {
      getSummary: vi.fn(async () => ({ companyCount: 10, totalRevenue: 500, countryCount: 2, employeeCount: 40 })),
      getLevelDistribution: vi.fn(async () => ({ totalCompanies: 10, levels: [{ level: 1, companyCount: 3, percentage: 30 }] })),
      getFoundedYearTrend: vi.fn(async () => ({ years: [{ year: 2020, newCompanies: 2, cumulativeCompanies: 10 }] })),
    };
    const tool = new DashboardMetricsTool(dashboard as never);
    const input = await tool.validate({ fromYear: 2020, toYear: 2024, country: 'USA', levels: [1, 2] });
    const result = await tool.execute(input, { actor: { id: 'user-1', email: 'user@example.com' } });

    expect(dashboard.getSummary).toHaveBeenCalledWith(input);
    expect(dashboard.getLevelDistribution).toHaveBeenCalledWith(input);
    expect(dashboard.getFoundedYearTrend).toHaveBeenCalledWith(input);
    expect(result).toMatchObject({ resultType: 'report', data: { summary: { companyCount: 10 }, levels: [{ percentage: 30 }], years: [{ cumulativeCompanies: 10 }] } });
  });

  it('rejects a reversed founded-year range', async () => {
    const dashboard = { getSummary: vi.fn(), getLevelDistribution: vi.fn(), getFoundedYearTrend: vi.fn() };
    const tool = new DashboardMetricsTool(dashboard as never);
    const input = await tool.validate({ fromYear: 2025, toYear: 2020 });

    await expect(tool.execute(input, { actor: { id: 'user-1', email: 'user@example.com' } })).rejects.toThrow('开始年份不能晚于结束年份');
    expect(dashboard.getSummary).not.toHaveBeenCalled();
  });
});
