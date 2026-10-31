import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';

export class ChatAttachmentDto {
  @ApiProperty({ example: 'weekly-report.csv' })
  @IsString()
  @MaxLength(255)
  name!: string;

  @ApiProperty({ example: 'text/csv' })
  @IsString()
  @MaxLength(120)
  type!: string;

  @ApiProperty({ example: 5120, minimum: 0, maximum: 2000000 })
  @IsInt()
  @Min(0)
  @Max(2_000_000)
  size!: number;

  @ApiPropertyOptional({ example: 'year,revenue\\n2024,100000', maxLength: 100000 })
  @IsOptional()
  @IsString()
  @MaxLength(100_000)
  textContent?: string;
}

export class SendChatMessageDto {
  @ApiProperty({ example: '请总结这个文件的主要内容。', maxLength: 4000 })
  @IsString()
  @MaxLength(4000)
  content!: string;

  @ApiPropertyOptional({ type: [ChatAttachmentDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => ChatAttachmentDto)
  attachments?: ChatAttachmentDto[];
}
