import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6', format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Alice Chen' })
  name!: string;

  @ApiProperty({ example: 'alice@example.com' })
  email!: string;

  @ApiProperty({ example: 'Operations Manager' })
  role!: string;

  @ApiProperty({ example: 'Active' })
  status!: string;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-10-23T12:00:00.000Z' })
  createdAt!: Date;
}

export class SignUpResponseDto {
  @ApiProperty({ example: '注册成功' })
  message!: string;

  @ApiProperty({ type: UserResponseDto })
  user!: UserResponseDto;
}

export class LoginResponseDto extends SignUpResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken!: string;
}

export class DeleteUsersResponseDto {
  @ApiProperty({ example: 2, description: 'Number of users actually deleted' })
  deleted!: number;
}
