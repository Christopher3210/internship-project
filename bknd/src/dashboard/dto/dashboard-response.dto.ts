import { ApiProperty } from '@nestjs/swagger';

export class DashboardSummaryResponseDto {
  @ApiProperty({ example: 2000, description: 'Total number of companies' })
  companyCount!: number;

  @ApiProperty({ example: 123456789, description: 'Sum of annual revenue across all companies' })
  totalRevenue!: number;

  @ApiProperty({ example: 18, description: 'Number of distinct countries' })
  countryCount!: number;

  @ApiProperty({ example: 450000, description: 'Sum of employee counts across all companies' })
  employeeCount!: number;
}

export class DashboardLevelItemResponseDto {
  @ApiProperty({ example: 1, minimum: 1, maximum: 4 })
  level!: number;

  @ApiProperty({ example: 500 })
  companyCount!: number;

  @ApiProperty({ example: 25.0, description: 'Share of all companies, in percent, rounded to two decimal places' })
  percentage!: number;
}

export class DashboardLevelsResponseDto {
  @ApiProperty({ example: 2000 })
  totalCompanies!: number;

  @ApiProperty({ type: [DashboardLevelItemResponseDto] })
  levels!: DashboardLevelItemResponseDto[];
}

export class FoundedYearItemResponseDto {
  @ApiProperty({ example: 2000 })
  year!: number;

  @ApiProperty({ example: 3, description: 'Companies founded in this year' })
  newCompanies!: number;

  @ApiProperty({ example: 14, description: 'Cumulative companies founded up to and including this year' })
  cumulativeCompanies!: number;
}

export class FoundedYearsResponseDto {
  @ApiProperty({ type: [FoundedYearItemResponseDto] })
  years!: FoundedYearItemResponseDto[];
}
