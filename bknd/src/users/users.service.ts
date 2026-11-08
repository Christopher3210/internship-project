import { ConflictException, Injectable, NotFoundException, UnauthorizedException, Optional } from '@nestjs/common';
import { AiQueryCacheService } from '../ai-agent/ai-query-cache.service.js';
import { AiTenantScopeService } from '../ai-agent/ai-tenant-scope.service.js';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { LoginDto } from './dto/login.dto.js';
import { SignUpDto } from './dto/sign-up.dto.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { User } from './user.entity.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly usersRepository: Repository<User>,
    private readonly jwtService: JwtService,
    @Optional() private readonly queryCache?: AiQueryCacheService,
    @Optional() private readonly tenants?: AiTenantScopeService,
  ) {}

  async signUp({ email, password }: SignUpDto) {
    const normalizedEmail = email.trim().toLowerCase();
    if (await this.usersRepository.existsBy({ email: normalizedEmail })) {
      throw new ConflictException('该邮箱已注册');
    }
    const user = await this.usersRepository.save(this.usersRepository.create({
      name: normalizedEmail.split('@')[0],
      email: normalizedEmail,
      role: 'Member',
      status: 'Active',
      passwordHash: await bcrypt.hash(password, 12),
    }));
    await this.queryCache?.invalidate('USERS');
    return { message: '注册成功', user: this.publicUser(user) };
  }

  async login({ email, password }: LoginDto) {
    const user = await this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email: email.trim().toLowerCase() })
      .getOne();
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('邮箱或密码错误');
    }
    if (user.status.toLowerCase() !== 'active') throw new UnauthorizedException('Account is inactive');
    return {
      message: '登录成功',
      accessToken: await this.jwtService.signAsync({ sub: user.id, email: user.email }),
      user: this.publicUser(user),
    };
  }

  async findAll(name?: string, roles?: string, actorId?: string) {
    const query = this.usersRepository.createQueryBuilder('user');
    if (name?.trim()) {
      query.where('user.name ILIKE :name', { name: `%${name.trim()}%` });
    }
    const roleList = roles?.split(',').map((role) => role.trim()).filter(Boolean) ?? [];
    if (roleList.length) {
      query.andWhere('user.role IN (:...roles)', { roles: roleList });
    }
    await this.restrictTenant(query, actorId);
    const users = await query.orderBy('user.createdAt', 'DESC').getMany();
    return users.map((user) => this.publicUser(user));
  }

  async searchForAgent(filters: {
    name?: string;
    roles?: string[];
    status?: string;
    page: number;
    pageSize: number;
    sortBy?: 'name' | 'email' | 'role' | 'status' | 'createdAt';
    sortOrder?: 'ASC' | 'DESC';
  }, actorId?: string) {
    const query = this.usersRepository.createQueryBuilder('user');
    if (filters.name?.trim()) query.andWhere('user.name ILIKE :name', { name: `%${filters.name.trim()}%` });
    if (filters.roles?.length) query.andWhere('user.role IN (:...roles)', { roles: filters.roles });
    if (filters.status?.trim()) query.andWhere('LOWER(user.status) = LOWER(:status)', { status: filters.status.trim() });
    await this.restrictTenant(query, actorId);

    const sortColumns = {
      name: 'user.name', email: 'user.email', role: 'user.role', status: 'user.status', createdAt: 'user.createdAt',
    } as const;
    const sortBy = filters.sortBy ?? 'name';
    const sortOrder = filters.sortOrder ?? 'ASC';
    const [users, total] = await query
      .orderBy(sortColumns[sortBy], sortOrder)
      .skip((filters.page - 1) * filters.pageSize)
      .take(filters.pageSize)
      .getManyAndCount();

    return {
      items: users.map(({ name, email, role, status }) => ({ name, email, role, status })),
      total,
      page: filters.page,
      pageSize: filters.pageSize,
      totalPages: Math.ceil(total / filters.pageSize),
    };
  }

  async create(createUserDto: CreateUserDto) {
    const email = createUserDto.email.trim().toLowerCase();
    if (await this.usersRepository.existsBy({ email })) {
      throw new ConflictException('This email is already registered');
    }

    const user = await this.usersRepository.save(this.usersRepository.create({
      name: createUserDto.name.trim(),
      email,
      role: createUserDto.role.trim(),
      status: createUserDto.status.trim(),
      passwordHash: await bcrypt.hash(createUserDto.password, 12),
    }));
    await this.queryCache?.invalidate('USERS');
    return this.publicUser(user);
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id })
      .getOne();
    if (!user) throw new NotFoundException('User not found');

    if (updateUserDto.email) {
      const email = updateUserDto.email.trim().toLowerCase();
      const existingUser = await this.usersRepository.findOneBy({ email });
      if (existingUser && existingUser.id !== id) {
        throw new ConflictException('This email is already registered');
      }
      user.email = email;
    }
    if (updateUserDto.name) user.name = updateUserDto.name.trim();
    if (updateUserDto.role) user.role = updateUserDto.role.trim();
    if (updateUserDto.status) user.status = updateUserDto.status.trim();
    if (updateUserDto.password) user.passwordHash = await bcrypt.hash(updateUserDto.password, 12);

    const saved = await this.usersRepository.save(user);
    await this.queryCache?.invalidate('USERS');
    return this.publicUser(saved);
  }

  async removeMany(ids: string[]) {
    const result = await this.usersRepository.delete(ids);
    await this.queryCache?.invalidate('USERS');
    return { deleted: result.affected ?? 0 };
  }

  private async restrictTenant(query: SelectQueryBuilder<User>, actorId?: string) {
    if (!this.tenants || !actorId) return;
    const owners = await this.usersRepository.find({ select: { id: true } });
    const ids = owners.filter((user) => this.tenants!.sameTenant(actorId, user.id)).map((user) => user.id);
    query.andWhere('user.id IN (:...tenantUserIds)', { tenantUserIds: ids.length ? ids : [actorId] });
  }

  private publicUser(user: User) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
    };
  }
}
