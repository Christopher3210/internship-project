import { ApiProperty } from '@nestjs/swagger';
import { AI_PROVIDERS } from './create-chat-session.dto.js';

export class AiProviderResponseDto {
  @ApiProperty({ enum: AI_PROVIDERS })
  id!: (typeof AI_PROVIDERS)[number];

  @ApiProperty({ example: 'DeepSeek' })
  label!: string;

  @ApiProperty({ example: 'deepseek-chat' })
  model!: string;

  @ApiProperty({ example: true })
  configured!: boolean;
}
