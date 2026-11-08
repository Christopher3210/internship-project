import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity.js';

type AuthRequest = Request & { user?: { id: string; email: string } };

@Injectable()
export class AiJwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService, @InjectRepository(User) private readonly users: Repository<User>) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('Bearer access token is required');
    try {
      const payload = await this.jwtService.verifyAsync<{ sub?: string; email?: string }>(token);
      if (!payload.sub || !payload.email) throw new Error('Invalid token payload');
      const user = await this.users.findOneBy({ id: payload.sub });
      if (!user || user.status.toLowerCase() !== 'active' || user.email !== payload.email) throw new Error('Account unavailable');
      request.user = { id: payload.sub, email: payload.email };
      return true;
    } catch {
      throw new UnauthorizedException('Access token is invalid or expired');
    }
  }
}
