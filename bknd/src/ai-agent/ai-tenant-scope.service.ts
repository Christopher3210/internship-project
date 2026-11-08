import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Server-owned deployment mapping; neither model input nor request JSON may choose a tenant. */
@Injectable()
export class AiTenantScopeService {
  private readonly mapping: Record<string, string>;
  private readonly defaultTenant: string;
  constructor(config: ConfigService) {
    this.defaultTenant = config.get<string>('AI_TENANT_ID') ?? 'local';
    const mapping: unknown = JSON.parse(config.get<string>('AI_USER_TENANTS') ?? '{}');
    if (!mapping || Array.isArray(mapping) || typeof mapping !== 'object' || Object.values(mapping).some((value) => typeof value !== 'string' || !value.trim())) throw new Error('AI_USER_TENANTS must map user UUIDs to non-empty tenant IDs');
    this.mapping = mapping as Record<string, string>;
  }
  tenantFor(userId: string) { return Object.hasOwn(this.mapping, userId) ? this.mapping[userId] : this.defaultTenant; }
  sameTenant(left: string, right: string) { return this.tenantFor(left) === this.tenantFor(right); }
}
