import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateCompanyDto {
  @ApiProperty({ example: 'C01' })
  @IsString()
  @MaxLength(32)
  companyCode!: string;

  @ApiProperty({ example: 'Doyle Ltd' })
  @IsString()
  @MaxLength(160)
  companyName!: string;

  @ApiProperty({ example: 2, minimum: 1, maximum: 4 })
  @IsInt()
  @Min(1)
  @Max(4)
  level!: number;

  @ApiProperty({ example: 'Japan' })
  @IsString()
  @MaxLength(80)
  country!: string;

  @ApiProperty({ example: 'Nagoya' })
  @IsString()
  @MaxLength(80)
  city!: string;

  @ApiProperty({ example: 1917 })
  @IsInt()
  foundedYear!: number;

  @ApiProperty({ example: 429408 })
  @IsInt()
  @Min(0)
  annualRevenue!: number;

  @ApiProperty({ example: 889 })
  @IsInt()
  @Min(0)
  employees!: number;

  @ApiPropertyOptional({ example: 'C0' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  parentCompany?: string;
}
