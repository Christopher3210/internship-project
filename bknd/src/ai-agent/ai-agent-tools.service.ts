import { Injectable } from '@nestjs/common';
import { DashboardService } from '../dashboard/dashboard.service.js';

/** A small allowlist of read-only project operations available to the model. */
@Injectable()
export class AiAgentToolsService {
  constructor(private readonly dashboardService: DashboardService) {}

  getDefinitions() {
    return [{
      type: 'function' as const,
      function: {
        name: 'get_company_summary',
        description: 'Get the current company count, total revenue, country count, and employee count from the project database.',
        parameters: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
      },
    }];
  }

  async execute(name: string, _args: Record<string, unknown> = {}) {
    if (name === 'get_company_summary') {
      return this.dashboardService.getSummary();
    }
    throw new Error(`Tool is not allowed: ${name}`);
  }
}
