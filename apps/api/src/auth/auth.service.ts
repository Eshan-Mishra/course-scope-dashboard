import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { compare } from 'bcryptjs';
import { Repository } from 'typeorm';
import { AuthenticatedUser } from '../common/access.types';
import { User } from '../database/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string): Promise<{ token: string; user: AuthenticatedUser }> {
    const user = await this.users.findOne({ where: { email: email.toLowerCase() } });
    if (!user || !(await compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const sessionUser: AuthenticatedUser = {
      sub: user.id,
      email: user.email,
      role: user.role,
      region: user.region,
    };
    return { token: await this.jwt.signAsync(sessionUser), user: sessionUser };
  }
}

