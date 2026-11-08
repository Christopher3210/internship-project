import { Injectable } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { CompaniesService } from '../../companies/companies.service.js';
import { BaseTool, type AiToolContext, type AiToolInput, type AiToolJsonSchema, type AiToolPayload } from './base-tool.js';
import { validateToolInput } from './validate-tool-input.js';

class CompanyQueryInput implements AiToolInput {
  [key: string]: unknown;
  @IsOptional() @IsString() @MaxLength(160) name?: string;
  @IsOptional() @IsString() @MaxLength(80) country?: string;
  @IsOptional() @IsString() @MaxLength(80) city?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(4) @ArrayUnique() @Type(() => Number) @IsInt({ each: true }) @Min(1, { each: true }) @Max(4, { each: true }) levels?: number[];
  @Type(() => Number) @IsInt() @Min(1) @Max(100_000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
  @IsOptional() @IsIn(['companyName', 'level', 'country', 'city', 'foundedYear', 'annualRevenue', 'employees', 'efficiency']) sortBy?: 'companyName' | 'level' | 'country' | 'city' | 'foundedYear' | 'annualRevenue' | 'employees' | 'efficiency';
  @IsOptional() @IsIn(['ASC', 'DESC']) sortOrder?: 'ASC' | 'DESC';
}

@Injectable()
export class CompanyQueryTool extends BaseTool<CompanyQueryInput> {
  readonly name = 'search_companies_table';
  readonly description = 'Search companies by name, supplier level, country, or city. Returns a paginated table with expandable company details and revenue per employee.';
  readonly intent = 'QUERY_DATA' as const;
  readonly requiredPermission = 'ai:companies:read';
  readonly parameters: AiToolJsonSchema = {
    type: 'object',
    properties: {
      name: { type: 'string', maxLength: 160 },
      country: { type: 'string', maxLength: 80 },
      city: { type: 'string', maxLength: 80 },
      levels: { type: 'array', items: { type: 'integer', minimum: 1, maximum: 4 }, maxItems: 4, uniqueItems: true },
      page: { type: 'integer', minimum: 1, default: 1 },
      pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      sortBy: { type: 'string', enum: ['companyName', 'level', 'country', 'city', 'foundedYear', 'annualRevenue', 'employees', 'efficiency'] },
      sortOrder: { type: 'string', enum: ['ASC', 'DESC'] },
    },
    additionalProperties: false,
  };

  constructor(private readonly companies: CompaniesService) { super(); }

  validate(input: AiToolInput) {
    return validateToolInput(CompanyQueryInput, input);
  }

  async execute(input: CompanyQueryInput, _context: AiToolContext): Promise<AiToolPayload> {
    const result = await this.companies.searchForAgent(input);
    const items = result.items.map((company) => {
      const efficiency = company.employees ? company.annualRevenue / company.employees : 0;
      const colorStrength = Math.min(0.24, 0.06 + (Math.min(efficiency, 2000) / 2000) * 0.18);
      return {
        companyCode: company.companyCode,
        companyName: company.companyName,
        level: company.level,
        country: company.country,
        profitabilityEfficiency: efficiency,
        efficiencyBackgroundAlpha: colorStrength,
        details: {
          city: company.city,
          foundedYear: company.foundedYear,
          annualRevenue: company.annualRevenue,
          employees: company.employees,
        },
      };
    });
    return {
      data: { ...result, items },
      message: `找到 ${result.total} 家公司。`,
      resultType: 'table',
    };
  }
}
