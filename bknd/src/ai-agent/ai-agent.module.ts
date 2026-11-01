import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiAgentController } from './ai-agent.controller.js';
import { AiChatSession } from './ai-chat-session.entity.js';
import { AiUserMemory } from './ai-memory.entity.js';
import { AiOperationAudit } from './ai-operation-audit.entity.js';
import { AiTaskRecord } from './ai-task-record.entity.js';
import { AiJwtAuthGuard } from './ai-jwt-auth.guard.js';
import { AiRedisService } from './ai-redis.service.js';
import { AiAgentService } from './ai-agent.service.js';
import { AiModelService } from './ai-model.service.js';
import { User } from '../users/user.entity.js';
import { DashboardModule } from '../dashboard/dashboard.module.js';
import { CompaniesModule } from '../companies/companies.module.js';
import { AiAgentToolsService } from './ai-agent-tools.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([AiChatSession, AiUserMemory, AiTaskRecord, AiOperationAudit, User]),
    DashboardModule,
    CompaniesModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ secret: config.getOrThrow<string>('JWT_SECRET') }),
    }),
  ],
  controllers: [AiAgentController],
  providers: [AiAgentService, AiModelService, AiAgentToolsService, AiJwtAuthGuard, AiRedisService],
})
export class AiAgentModule {}
