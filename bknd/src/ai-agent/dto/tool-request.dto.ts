import { IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
export class ToolRequestDto {
  @ApiProperty({ type: Object, example: {} })
  @IsObject()
  input!: Record<string, unknown>;
}
