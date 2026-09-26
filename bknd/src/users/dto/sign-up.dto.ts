import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class SignUpDto {
  @ApiProperty({ example: 'intern@example.com' })
  @IsEmail({}, { message: '请输入正确的邮箱格式' })
  email!: string;

  @ApiProperty({ example: 'at-least-8-characters' })
  @IsString()
  @MinLength(8, { message: '密码至少需要 8 个字符' })
  password!: string;
}
