import { ApiProperty } from '@nestjs/swagger';

export class CompanyResponseDto {
  @ApiProperty({ example: 'C01' })
  companyCode!: string;

  @ApiProperty({ example: 'Doyle Ltd' })
  companyName!: string;

  @ApiProperty({ example: 2, minimum: 1, maximum: 4 })
  level!: number;

  @ApiProperty({ example: 'Japan' })
  country!: string;

  @ApiProperty({ example: 'Nagoya' })
  city!: string;

  @ApiProperty({ example: 1917 })
  foundedYear!: number;

  @ApiProperty({ example: 429408, minimum: 0 })
  annualRevenue!: number;

  @ApiProperty({ example: 889, minimum: 0 })
  employees!: number;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-10-23T12:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-10-23T12:00:00.000Z' })
  updatedAt!: Date;
}

export class CompanyListItemResponseDto {
  @ApiProperty({ example: 'C01' })
  companyCode!: string;

  @ApiProperty({ example: 'Doyle Ltd' })
  companyName!: string;

  @ApiProperty({ example: 2, minimum: 1, maximum: 4 })
  level!: number;

  @ApiProperty({ example: 'Japan' })
  country!: string;

  @ApiProperty({ example: 'Nagoya' })
  city!: string;

  @ApiProperty({ example: 1917 })
  foundedYear!: number;

  @ApiProperty({ example: 429408, minimum: 0 })
  annualRevenue!: number;

  @ApiProperty({ example: 889, minimum: 0 })
  employees!: number;

  @ApiProperty({ type: String, nullable: true, example: 'C00', description: 'Direct parent company code, or null' })
  parentCompany!: string | null;
}

export class CompanyListResponseDto {
  @ApiProperty({ type: [CompanyListItemResponseDto] })
  items!: CompanyListItemResponseDto[];

  @ApiProperty({ example: 2000 })
  total!: number;

  @ApiProperty({ example: 1, minimum: 1 })
  page!: number;

  @ApiProperty({ example: 20, minimum: 1, maximum: 100 })
  pageSize!: number;
}

export class DeleteCompanyResponseDto {
  @ApiProperty({ example: true })
  deleted!: boolean;
}
