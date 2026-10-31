import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { AiChatMessage } from '../ai-chat-session.entity.js';

export class AiChatMessageResponseDto {
  @ApiProperty({ example: 'c7f61c9b-29e9-4bf7-a29d-a1b06db7355f', format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: ['user', 'assistant'], example: 'user' })
  role!: 'user' | 'assistant';

  @ApiProperty({ example: '帮我总结本周的供应链变化。' })
  content!: string;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-10-24T18:00:00.000Z' })
  createdAt!: string;
}

export class AiChatSessionResponseDto {
  @ApiProperty({ example: 'a1e68db3-08b4-445c-8621-7997a62bc801', format: 'uuid' })
  id!: string;

  @ApiProperty({ example: '供应链风险分析' })
  title!: string;

  @ApiPropertyOptional({ example: 'deepseek', nullable: true })
  provider!: string | null;

  @ApiPropertyOptional({ example: 'deepseek-chat', nullable: true })
  model!: string | null;

  @ApiProperty({ type: [AiChatMessageResponseDto] })
  messages!: AiChatMessage[];

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}

export class AiChatSessionSummaryResponseDto {
  @ApiProperty({ example: 'a1e68db3-08b4-445c-8621-7997a62bc801', format: 'uuid' })
  id!: string;

  @ApiProperty({ example: '供应链风险分析' })
  title!: string;

  @ApiPropertyOptional({ example: 'deepseek', nullable: true })
  provider!: string | null;

  @ApiPropertyOptional({ example: 'deepseek-chat', nullable: true })
  model!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}
