import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/user.entity.js';

const ROLE_PERMISSIONS: Record<string, string[]> = {
  member: [
    'ai:companies:read',
    'ai:dashboard:read',
    'ai:memory:read',
    'ai:memory:write',
    'ai:tasks:read',
    'ai:tasks:write',
  ],
  admin: [
    'ai:users:read',
    'ai:companies:read',
    'ai:dashboard:read',
    'ai:memory:read',
    'ai:memory:write',
    'ai:tasks:read',
    'ai:tasks:write',
  ],
};

@Injectable()
export class AiToolPermissionService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  async assertCanExecute(permission: string, userId: string) {
    const user = await this.users.findOne({ where: { id: userId }, select: { id: true, role: true, status: true } });
    const role = user?.role.toLowerCase();
    if (!user || user.status.toLowerCase() !== 'active' || !ROLE_PERMISSIONS[role ?? '']?.includes(permission)) {
      throw new ForbiddenException('当前用户没有权限执行此操作。');
    }
  }
}
