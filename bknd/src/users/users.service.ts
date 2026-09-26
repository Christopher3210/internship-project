import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { LoginDto } from './dto/login.dto.js';
import { SignUpDto } from './dto/sign-up.dto.js';
import { User } from './user.entity.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly usersRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async signUp({ email, password }: SignUpDto) {
    const normalizedEmail = email.trim().toLowerCase();
    if (await this.usersRepository.existsBy({ email: normalizedEmail })) {
      throw new ConflictException('该邮箱已注册');
    }
    const user = await this.usersRepository.save(this.usersRepository.create({
      email: normalizedEmail,
      passwordHash: await bcrypt.hash(password, 12),
    }));
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
    return {
      message: '登录成功',
      accessToken: await this.jwtService.signAsync({ sub: user.id, email: user.email }),
      user: this.publicUser(user),
    };
  }

  private publicUser(user: User) {
    return { id: user.id, email: user.email, createdAt: user.createdAt };
  }
}
