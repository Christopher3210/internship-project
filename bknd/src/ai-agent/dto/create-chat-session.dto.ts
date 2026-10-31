import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export const AI_PROVIDERS = ['mock', 'deepseek', 'qwen', 'openai', 'kimi', 'local'] as const;
export type AiProviderName = (typeof AI_PROVIDERS)[number];

export class CreateChatSessionDto {
  @ApiPropertyOptional({ example: '供应链风险分析' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title?: string;

  @ApiPropertyOptional({ enum: AI_PROVIDERS, example: 'mock' })
  @IsOptional()
  @IsIn(AI_PROVIDERS)
  provider?: AiProviderName;
}

export class UpdateChatSessionDto {
  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title?: string;

  @ApiPropertyOptional({ enum: AI_PROVIDERS })
  @IsOptional()
  @IsIn(AI_PROVIDERS)
  provider?: AiProviderName;
}
