import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Allow, IsDateString, IsDefined, IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';

export class AiPageQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  pageSize = 20;

  @ApiPropertyOptional({ format: 'uuid', description: 'Admins may use this to filter by owner.' })
  @IsOptional() @IsUUID()
  userId?: string;
}

export class CreateAiMemoryDto {
  @ApiProperty({ maxLength: 120 })
  @IsString() @MinLength(1) @MaxLength(120)
  key!: string;

  @ApiProperty({ description: 'JSON value to remember for the authenticated user.' })
  @IsDefined() @Allow()
  value!: unknown;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @IsOptional() @IsDateString()
  expiresAt?: string | null;
}

export class UpdateAiMemoryDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120)
  key?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Allow()
  value?: unknown;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @IsOptional() @IsDateString()
  expiresAt?: string | null;
}

export class CreateAiTaskDto {
  @ApiProperty({ maxLength: 100, example: 'supplier-risk-review' })
  @IsString() @MinLength(1) @MaxLength(100)
  taskType!: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional() @IsObject()
  input?: Record<string, unknown>;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @IsOptional() @IsDateString()
  expiresAt?: string | null;
}

export class UpdateAiTaskDto {
  @ApiPropertyOptional({ enum: ['queued', 'running', 'completed', 'failed'] })
  @IsOptional() @IsIn(['queued', 'running', 'completed', 'failed'])
  status?: 'queued' | 'running' | 'completed' | 'failed';

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100)
  progress?: number;

  @ApiPropertyOptional({ type: Object, nullable: true })
  @IsOptional() @IsObject()
  input?: Record<string, unknown>;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Allow()
  result?: unknown;

  @ApiPropertyOptional({ maxLength: 4000, nullable: true })
  @IsOptional() @IsString() @MaxLength(4000)
  error?: string | null;
}

export class CreateAiAuditDto {
  @ApiProperty({ maxLength: 100 })
  @IsString() @MinLength(1) @MaxLength(100)
  action!: string;

  @ApiProperty({ maxLength: 100 })
  @IsString() @MinLength(1) @MaxLength(100)
  resourceType!: string;

  @ApiPropertyOptional({ maxLength: 160, nullable: true })
  @IsOptional() @IsString() @MaxLength(160)
  resourceId?: string | null;

  @ApiPropertyOptional({ type: Object })
  @IsOptional() @IsObject()
  details?: Record<string, unknown>;
}

export class UpdateAiAuditDto {
  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100)
  action?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100)
  resourceType?: string;

  @ApiPropertyOptional({ maxLength: 160, nullable: true })
  @IsOptional() @IsString() @MaxLength(160)
  resourceId?: string | null;

  @ApiPropertyOptional({ type: Object })
  @IsOptional() @IsObject()
  details?: Record<string, unknown>;
}

export class AiAuditPageQueryDto extends AiPageQueryDto {
  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(100)
  action?: string;
}

export class AiPageResponseDto {
  @ApiProperty({ type: [Object] }) items!: object[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
  @ApiProperty() totalPages!: number;
}
