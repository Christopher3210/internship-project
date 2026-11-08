import { Global, Module } from '@nestjs/common';
import { AiRedisService } from './ai-redis.service.js';
import { AiQueryCacheService } from './ai-query-cache.service.js';
import { AiCheckpointerFactory } from './ai-checkpointer.js';
import { AiTenantScopeService } from './ai-tenant-scope.service.js';

@Global()
@Module({ providers: [AiRedisService, AiQueryCacheService, AiCheckpointerFactory, AiTenantScopeService], exports: [AiRedisService, AiQueryCacheService, AiCheckpointerFactory, AiTenantScopeService] })
export class AiCacheModule {}
