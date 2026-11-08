import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AiJwtAuthGuard } from '../ai-agent/ai-jwt-auth.guard.js';
import { AdminGuard } from './admin.guard.js';
import { AiCurrentUser, type AiAuthenticatedUser } from '../ai-agent/ai-current-user.js';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CreateUserDto } from './dto/create-user.dto.js';
import { DeleteUsersDto } from './dto/delete-users.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { SignUpDto } from './dto/sign-up.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { DeleteUsersResponseDto, LoginResponseDto, SignUpResponseDto, UserResponseDto } from './dto/user-response.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('sign-up')
  @ApiOperation({ summary: 'Register an account' })
  @ApiCreatedResponse({ description: 'Registration succeeded', type: SignUpResponseDto })
  @ApiBadRequestResponse({ description: 'Email or password validation failed' })
  @ApiConflictResponse({ description: 'The email address is already registered' })
  signUp(@Body() signUpDto: SignUpDto) {
    return this.usersService.signUp(signUpDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in and obtain an access token' })
  @ApiOkResponse({ description: 'Login succeeded', type: LoginResponseDto })
  @ApiBadRequestResponse({ description: 'Email or password validation failed' })
  @ApiUnauthorizedResponse({ description: 'Email or password is incorrect' })
  login(@Body() loginDto: LoginDto) {
    return this.usersService.login(loginDto);
  }

  @Get()
  @UseGuards(AiJwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'List users with optional filters' })
  @ApiQuery({
    name: 'name',
    required: false,
    type: String,
    description: 'Partial, case-insensitive name match',
  })
  @ApiQuery({
    name: 'roles',
    required: false,
    type: String,
    description: 'Filter by role; separate multiple roles with commas, for example Member,Admin',
  })
  @ApiOkResponse({ description: 'Users ordered by creation time, newest first', type: UserResponseDto, isArray: true })
  findAll(@AiCurrentUser() actor: AiAuthenticatedUser, @Query('name') name?: string, @Query('roles') roles?: string) {
    return this.usersService.findAll(name, roles, actor.id);
  }

  @Post()
  @UseGuards(AiJwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Create a user' })
  @ApiCreatedResponse({ description: 'User created', type: UserResponseDto })
  @ApiBadRequestResponse({ description: 'Request body validation failed' })
  @ApiConflictResponse({ description: 'The email address is already registered' })
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Patch(':id')
  @UseGuards(AiJwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Update a user' })
  @ApiParam({ name: 'id', description: 'User UUID', format: 'uuid', example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @ApiOkResponse({ description: 'Updated user', type: UserResponseDto })
  @ApiBadRequestResponse({ description: 'Request body validation failed' })
  @ApiNotFoundResponse({ description: 'User was not found' })
  @ApiConflictResponse({ description: 'The email address is already registered' })
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete()
  @UseGuards(AiJwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Delete multiple users' })
  @ApiBody({ type: DeleteUsersDto })
  @ApiOkResponse({ description: 'Number of users actually deleted', type: DeleteUsersResponseDto })
  @ApiBadRequestResponse({ description: 'IDs must be a non-empty array of UUID v4 values' })
  removeMany(@Body() deleteUsersDto: DeleteUsersDto) {
    return this.usersService.removeMany(deleteUsersDto.ids);
  }
}
