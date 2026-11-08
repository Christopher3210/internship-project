import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Optional } from '@nestjs/common';
import { AiTenantScopeService } from '../ai-agent/ai-tenant-scope.service.js';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity.js';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(@InjectRepository(User) private readonly users: Repository<User>, @Optional() private readonly tenants?: AiTenantScopeService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{ user?: { id: string }; params?: { id?: string }; body?: { ids?: unknown }; method?: string }>();
    const user = request.user && await this.users.findOneBy({ id: request.user.id });
    if (!user || user.status.toLowerCase() !== 'active' || user.role.toLowerCase() !== 'admin') throw new ForbiddenException('Administrator role is required');
    const targets = [request.params?.id, ...(Array.isArray(request.body?.ids) ? request.body.ids : [])].filter((id): id is string => typeof id === 'string');
    if (this.tenants && targets.some((id) => !this.tenants!.sameTenant(user.id, id))) throw new ForbiddenException('Cannot manage another tenant');
    if (this.tenants && request.method === 'POST' && !this.tenants.sameTenant(user.id, '__new_unmapped_user__')) throw new ForbiddenException('New tenant accounts must be provisioned by the deployment administrator');
    return true;
  }
}
