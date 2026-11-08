import { Body, Controller, Delete, Get, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { AiAgentService } from './ai-agent.service.js';
import { AiCurrentUser, type AiAuthenticatedUser } from './ai-current-user.js';
import { AiJwtAuthGuard } from './ai-jwt-auth.guard.js';
import { CreateChatSessionDto, UpdateChatSessionDto } from './dto/create-chat-session.dto.js';
import { AiAuditPageQueryDto, AiPageQueryDto, AiPageResponseDto, CreateAiAuditDto, CreateAiMemoryDto, CreateAiTaskDto, UpdateAiAuditDto, UpdateAiMemoryDto, UpdateAiTaskDto } from './dto/ai-resource.dto.js';
import { AiChatSessionResponseDto } from './dto/ai-chat-session-response.dto.js';
import { AiProviderResponseDto } from './dto/ai-provider-response.dto.js';
import { SendChatMessageDto } from './dto/send-chat-message.dto.js';

@ApiTags('ai-agent')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'A valid Bearer access token is required' })
@UseGuards(AiJwtAuthGuard)
@Controller('ai-agent')
export class AiAgentController {
  constructor(private readonly aiAgentService: AiAgentService) {}

  @Get('providers')
  @ApiOperation({ summary: 'List available AI providers without exposing API keys' })
  @ApiOkResponse({ type: AiProviderResponseDto, isArray: true })
  findProviders() { return this.aiAgentService.findProviders(); }

  @Get('sessions')
  @ApiOperation({ summary: 'List the authenticated user’s sessions with pagination' })
  @ApiOkResponse({ type: AiPageResponseDto })
  findAllSessions(@AiCurrentUser() actor: AiAuthenticatedUser, @Query() query: AiPageQueryDto) {
    return this.aiAgentService.findAllSessions(actor, query);
  }

  @Post('sessions')
  @ApiOperation({ summary: 'Create a chat session owned by the authenticated user' })
  @ApiCreatedResponse({ type: AiChatSessionResponseDto })
  @ApiBadRequestResponse({ description: 'Session title or provider is invalid' })
  createSession(@Body() dto: CreateChatSessionDto, @AiCurrentUser() actor: AiAuthenticatedUser) {
    return this.aiAgentService.createSession(dto, actor);
  }

  @Patch('sessions/:id')
  @ApiOperation({ summary: 'Update an owned session title or provider' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: AiChatSessionResponseDto })
  updateSession(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateChatSessionDto, @AiCurrentUser() actor: AiAuthenticatedUser) {
    return this.aiAgentService.updateSession(id, dto, actor);
  }

  @Get('sessions/:id')
  @ApiOperation({ summary: 'Load an owned chat session and its recent cached context' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: AiChatSessionResponseDto })
  @ApiBadRequestResponse({ description: 'Session ID must be a UUID' })
  @ApiNotFoundResponse({ description: 'Session was not found for this user' })
  findSession(@Param('id', new ParseUUIDPipe()) id: string, @AiCurrentUser() actor: AiAuthenticatedUser) {
    return this.aiAgentService.findSession(id, actor);
  }

  @Delete('sessions/:id')
  @ApiOperation({ summary: 'Delete an owned chat session' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ schema: { example: { deleted: true, id: 'c8f89c9d-132f-4b2f-8b5e-01ab0887eaf2' } } })
  deleteSession(@Param('id', new ParseUUIDPipe()) id: string, @AiCurrentUser() actor: AiAuthenticatedUser) {
    return this.aiAgentService.deleteSession(id, actor);
  }

  @Post('sessions/:id/close')
  @ApiOperation({ summary: 'Clear short-term context while retaining PostgreSQL conversation history' })
  closeSession(@Param('id', new ParseUUIDPipe()) id: string, @AiCurrentUser() actor: AiAuthenticatedUser) {
    return this.aiAgentService.closeSession(id, actor);
  }

  @Post('sessions/:id/messages')
  @ApiOperation({ summary: 'Send a message in an owned session and persist the reply' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: AiChatSessionResponseDto })
  sendMessage(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: SendChatMessageDto, @AiCurrentUser() actor: AiAuthenticatedUser) {
    return this.aiAgentService.sendMessage(id, dto, actor);
  }

  @Get('sessions/:id/messages/:messageId/results/:index')
  @ApiOperation({ summary: 'Read another page of an owned saved query using its original filters' })
  getResultPage(@Param('id', new ParseUUIDPipe()) id: string, @Param('messageId', new ParseUUIDPipe()) messageId: string, @Param('index', ParseIntPipe) index: number, @Query() query: AiPageQueryDto, @AiCurrentUser() actor: AiAuthenticatedUser) {
    return this.aiAgentService.getResultPage(id, messageId, index, query.page, actor);
  }

  @Get('memory')
  @ApiOperation({ summary: 'List the authenticated user’s AI memories' })
  @ApiOkResponse({ type: AiPageResponseDto })
  listMemories(@AiCurrentUser() actor: AiAuthenticatedUser, @Query() query: AiPageQueryDto) { return this.aiAgentService.listMemories(actor, query); }

  @Post('memory')
  @ApiOperation({ summary: 'Create an AI memory for the authenticated user' })
  @ApiCreatedResponse()
  createMemory(@Body() dto: CreateAiMemoryDto, @AiCurrentUser() actor: AiAuthenticatedUser) { return this.aiAgentService.createMemory(dto, actor); }

  @Get('memory/:id')
  @ApiParam({ name: 'id', format: 'uuid' })
  findMemory(@Param('id', new ParseUUIDPipe()) id: string, @AiCurrentUser() actor: AiAuthenticatedUser) { return this.aiAgentService.findMemory(id, actor); }

  @Patch('memory/:id')
  @ApiParam({ name: 'id', format: 'uuid' })
  updateMemory(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateAiMemoryDto, @AiCurrentUser() actor: AiAuthenticatedUser) { return this.aiAgentService.updateMemory(id, dto, actor); }

  @Delete('memory/:id')
  @ApiParam({ name: 'id', format: 'uuid' })
  deleteMemory(@Param('id', new ParseUUIDPipe()) id: string, @AiCurrentUser() actor: AiAuthenticatedUser) { return this.aiAgentService.deleteMemory(id, actor); }

  @Get('tasks')
  @ApiOperation({ summary: 'List tasks owned by the authenticated user' })
  @ApiOkResponse({ type: AiPageResponseDto })
  @ApiQuery({ name: 'userId', required: false, format: 'uuid' })
  listTasks(@AiCurrentUser() actor: AiAuthenticatedUser, @Query() query: AiPageQueryDto) { return this.aiAgentService.listTasks(actor, query); }

  @Post('tasks')
  @ApiOperation({ summary: 'Create a task record owned by the authenticated user' })
  createTask(@Body() dto: CreateAiTaskDto, @AiCurrentUser() actor: AiAuthenticatedUser) { return this.aiAgentService.createTask(dto, actor); }

  @Get('tasks/:id')
  @ApiParam({ name: 'id', format: 'uuid' })
  findTask(@Param('id', new ParseUUIDPipe()) id: string, @AiCurrentUser() actor: AiAuthenticatedUser) { return this.aiAgentService.findTask(id, actor); }

  @Patch('tasks/:id')
  @ApiParam({ name: 'id', format: 'uuid' })
  updateTask(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateAiTaskDto, @AiCurrentUser() actor: AiAuthenticatedUser) { return this.aiAgentService.updateTask(id, dto, actor); }

  @Delete('tasks/:id')
  @ApiParam({ name: 'id', format: 'uuid' })
  deleteTask(@Param('id', new ParseUUIDPipe()) id: string, @AiCurrentUser() actor: AiAuthenticatedUser) { return this.aiAgentService.deleteTask(id, actor); }

  @Get('audits')
  @ApiOperation({ summary: 'List own audit records; admins can view all and filter by userId/action' })
  @ApiOkResponse({ type: AiPageResponseDto })
  @ApiQuery({ name: 'userId', required: false, format: 'uuid' })
  @ApiQuery({ name: 'action', required: false })
  listAudits(@AiCurrentUser() actor: AiAuthenticatedUser, @Query() query: AiAuditPageQueryDto) { return this.aiAgentService.listAudits(actor, query); }

  @Post('audits')
  @ApiOperation({ summary: 'Append an audit record; audit records are immutable after creation' })
  createAudit(@Body() dto: CreateAiAuditDto, @AiCurrentUser() actor: AiAuthenticatedUser) { return this.aiAgentService.createAudit(dto, actor); }

  @Get('audits/:id')
  @ApiOperation({ summary: 'Read an owned audit record; admins may read any record' })
  @ApiParam({ name: 'id', format: 'uuid' })
  findAudit(@Param('id', new ParseUUIDPipe()) id: string, @AiCurrentUser() actor: AiAuthenticatedUser) { return this.aiAgentService.findAudit(id, actor); }

  @Patch('audits/:id')
  @ApiOperation({ summary: 'Admin-only audit correction; records the correction as a new audit event' })
  @ApiParam({ name: 'id', format: 'uuid' })
  updateAudit(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateAiAuditDto, @AiCurrentUser() actor: AiAuthenticatedUser) { return this.aiAgentService.updateAudit(id, dto, actor); }

  @Delete('audits/:id')
  @ApiOperation({ summary: 'Admin-only audit deletion; records the deletion as a new audit event' })
  @ApiParam({ name: 'id', format: 'uuid' })
  deleteAudit(@Param('id', new ParseUUIDPipe()) id: string, @AiCurrentUser() actor: AiAuthenticatedUser) { return this.aiAgentService.deleteAudit(id, actor); }
}
