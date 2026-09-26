import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'intern@example.com' })
  @IsEmail({}, { message: '请输入正确的邮箱格式' })
  email!: string;

  @ApiProperty({ example: 'at-least-8-characters' })
  @IsString()
  @MinLength(1, { message: '请输入密码' })
  password!: string;
}
