import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service.js';

@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  getSummary() {
    return this.dashboardService.getSummary();
  }

  @Get('levels')
  getLevelDistribution() {
    return this.dashboardService.getLevelDistribution();
  }

  @Get('founded-years')
  getFoundedYearTrend() {
    return this.dashboardService.getFoundedYearTrend();
  }
}
