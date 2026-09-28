import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma, User } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  /**
   * Case-insensitive: accounts created before emails were normalised may be
   * stored as typed ("Priya@Shop.in"), and the owner must still be able to
   * sign in as "priya@shop.in". The oldest match wins if both spellings exist.
   */
  async findByEmail(email: string): Promise<User | null> {
    const wanted = String(email ?? '').trim();
    if (!wanted) return null;
    return this.prisma.user.findFirst({
      where: { email: { equals: wanted, mode: 'insensitive' } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async createUser(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({
      data,
    });
  }
}
