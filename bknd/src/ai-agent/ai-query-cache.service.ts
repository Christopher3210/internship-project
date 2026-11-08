import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import { AiRedisService } from './ai-redis.service.js';

// Explicit read-only allowlist: never reuse a task creation, progress change or memory write.
const domains: Record<string, string> = {
  search_companies: 'COMPANIES', search_companies_table: 'COMPANIES',
  get_company_summary: 'COMPANIES', get_dashboard_metrics: 'COMPANIES',
  search_users: 'USERS',
};

@Injectable()
export class AiQueryCacheService {
  constructor(private readonly redis: AiRedisService, private readonly config: ConfigService) {}
  async key(userId: string, tool: string, input: unknown) {
    const domain = domains[tool];
    if (!domain || this.config.get('AI_CHAT_CACHE_ENABLED') === 'false' || this.config.get(`AI_CACHE_${domain}_ENABLED`) === 'false') return null;
    const revision = await this.redis.get<string>(`ai:chat_cache:revision:${domain}`);
    const hash = createHash('sha256').update(JSON.stringify({ tool, input, revision, tenant: this.config.get('AI_TENANT_ID'), tenantMapping: this.config.get('AI_USER_TENANTS') })).digest('hex');
    return { key: `ai:chat_cache:${userId}:${domain}:${hash}`, ttl: this.ttl(domain) };
  }
  private ttl(domain: string) {
    const ttl = Number(this.config.get(`AI_CACHE_${domain}_TTL_SECONDS`) ?? this.config.get('AI_CHAT_CACHE_TTL_SECONDS') ?? 600);
    return Number.isInteger(ttl) && ttl > 0 ? ttl : 600;
  }
  async invalidate(domain: 'COMPANIES' | 'USERS') {
    // Change generation before cleanup; a concurrent old query can only populate an obsolete key.
    await this.redis.set(`ai:chat_cache:revision:${domain}`, randomUUID(), 315360000);
    await this.redis.deletePattern(`ai:chat_cache:*:${domain}:*`);
  }
}
