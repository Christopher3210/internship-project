import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DashboardLevelsResponseDto, DashboardSummaryResponseDto, FoundedYearsResponseDto } from './dto/dashboard-response.dto.js';
import { DashboardService } from './dashboard.service.js';

@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get supply-chain dashboard summary metrics' })
  @ApiOkResponse({ description: 'Summary metrics calculated from all companies', type: DashboardSummaryResponseDto })
  getSummary() {
    return this.dashboardService.getSummary();
  }

  @Get('levels')
  @ApiOperation({ summary: 'Get company distribution by supply-chain level' })
  @ApiOkResponse({ description: 'Company count and percentage for each level', type: DashboardLevelsResponseDto })
  getLevelDistribution() {
    return this.dashboardService.getLevelDistribution();
  }

  @Get('founded-years')
  @ApiOperation({ summary: 'Get cumulative company counts by founded year' })
  @ApiOkResponse({ description: 'New and cumulative company counts for each year', type: FoundedYearsResponseDto })
  getFoundedYearTrend() {
    return this.dashboardService.getFoundedYearTrend();
  }
}
