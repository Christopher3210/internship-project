import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Alice Chen' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional({ example: 'alice@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'Operations Manager' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  role?: string;

  @ApiPropertyOptional({ example: 'Active' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  status?: string;

  @ApiPropertyOptional({ example: 'a-new-password' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}
