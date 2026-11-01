import { Injectable } from '@nestjs/common';
import { CompaniesService } from '../companies/companies.service.js';
import { DashboardService } from '../dashboard/dashboard.service.js';

/** A small allowlist of read-only project operations available to the model. */
@Injectable()
export class AiAgentToolsService {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly companiesService: CompaniesService,
  ) {}

  getDefinitions() {
    return [
      {
        type: 'function' as const,
        function: {
          name: 'get_company_summary',
          description: 'Get the current company count, total revenue, country count, and employee count from the project database.',
          parameters: { type: 'object', properties: {}, additionalProperties: false },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'search_companies',
          description: 'Search for companies by part of their name and/or supplier level (1 to 4). At least one filter is required. Return at most 10 matching companies.',
          parameters: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Optional partial company name to search for.' },
              level: { type: 'integer', enum: [1, 2, 3, 4], description: 'Optional supplier level.' },
              limit: { type: 'integer', minimum: 1, maximum: 10, description: 'Maximum number of results; defaults to 5.' },
            },
            additionalProperties: false,
          },
        },
      },
    ];
  }

  async execute(name: string, args: Record<string, unknown> = {}) {
    if (name === 'get_company_summary') {
      return this.dashboardService.getSummary();
    }
    if (name === 'search_companies') {
      const queryName = typeof args.name === 'string' ? args.name.trim() : '';
      const rawLevel = args.level;
      const level = rawLevel === undefined || rawLevel === null ? undefined : Number(rawLevel);
      if (!queryName && level === undefined) throw new Error('Provide a company name or supplier level to search');
      if (queryName.length > 120) throw new Error('Company name filter is too long');
      if (level !== undefined && (!Number.isInteger(level) || level < 1 || level > 4)) throw new Error('Supplier level must be between 1 and 4');
      const requestedLimit = Number(args.limit ?? 5);
      const limit = Number.isInteger(requestedLimit) ? Math.max(1, Math.min(10, requestedLimit)) : 5;
      const result = await this.companiesService.findAll(queryName || undefined, level?.toString(), '1', limit.toString());
      return {
        total: result.total,
        returned: result.items.length,
        items: result.items.map(({ companyCode, companyName, level: supplierLevel, country, city, annualRevenue, employees }) => ({
          companyCode, companyName, level: supplierLevel, country, city, annualRevenue, employees,
        })),
      };
    }
    throw new Error(`Tool is not allowed: ${name}`);
  }
}
