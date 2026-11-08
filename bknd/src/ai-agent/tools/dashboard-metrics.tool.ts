import { BadRequestException, Injectable } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { DashboardService } from '../../dashboard/dashboard.service.js';
import { BaseTool, type AiToolContext, type AiToolInput, type AiToolJsonSchema, type AiToolPayload } from './base-tool.js';
import { validateToolInput } from './validate-tool-input.js';

class DashboardMetricsInput implements AiToolInput {
  [key: string]: unknown;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1900) @Max(2200) fromYear?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1900) @Max(2200) toYear?: number;
  @IsOptional() @IsString() @MaxLength(80) country?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(4) @ArrayUnique() @Type(() => Number) @IsInt({ each: true }) @Min(1, { each: true }) @Max(4, { each: true }) levels?: number[];
}

@Injectable()
export class DashboardMetricsTool extends BaseTool<DashboardMetricsInput> {
  readonly name = 'get_dashboard_metrics';
  readonly description = 'Calculate company count, total revenue, unique countries, employee count, supplier-level distribution, and cumulative founded-year trend. Optional filters: founded-year range, country, and supplier levels.';
  readonly intent = 'STATISTICS_ANALYSIS' as const;
  readonly requiredPermission = 'ai:dashboard:read';
  readonly parameters: AiToolJsonSchema = {
    type: 'object',
    properties: {
      fromYear: { type: 'integer', minimum: 1900, maximum: 2200 },
      toYear: { type: 'integer', minimum: 1900, maximum: 2200 },
      country: { type: 'string', maxLength: 80 },
      levels: { type: 'array', items: { type: 'integer', minimum: 1, maximum: 4 }, maxItems: 4, uniqueItems: true },
    },
    additionalProperties: false,
  };

  constructor(private readonly dashboard: DashboardService) { super(); }

  validate(input: AiToolInput) {
    return validateToolInput(DashboardMetricsInput, input);
  }

  async execute(input: DashboardMetricsInput, _context: AiToolContext): Promise<AiToolPayload> {
    if (input.fromYear !== undefined && input.toYear !== undefined && input.fromYear > input.toYear) {
      throw new BadRequestException('开始年份不能晚于结束年份。');
    }
    const [summary, distribution, foundedYearTrend] = await Promise.all([
      this.dashboard.getSummary(input),
      this.dashboard.getLevelDistribution(input),
      this.dashboard.getFoundedYearTrend(input),
    ]);
    return {
      data: { summary, levels: distribution.levels, years: foundedYearTrend.years },
      message: 'Dashboard 综合指标已计算完成。',
      resultType: 'report',
    };
  }
}
