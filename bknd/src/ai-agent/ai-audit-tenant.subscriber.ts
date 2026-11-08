import { Injectable } from '@nestjs/common';
import { DataSource, type EntitySubscriberInterface, type InsertEvent } from 'typeorm';
import { AiOperationAudit } from './ai-operation-audit.entity.js';
import { AiTenantScopeService } from './ai-tenant-scope.service.js';

@Injectable()
export class AiAuditTenantSubscriber implements EntitySubscriberInterface<AiOperationAudit> {
  constructor(dataSource: DataSource, private readonly tenants: AiTenantScopeService) { dataSource.subscribers.push(this); }
  listenTo() { return AiOperationAudit; }
  beforeInsert(event: InsertEvent<AiOperationAudit>) {
    event.entity.tenantId = this.tenants.tenantFor(event.entity.owner?.id ?? event.entity.userId ?? '');
  }
}
