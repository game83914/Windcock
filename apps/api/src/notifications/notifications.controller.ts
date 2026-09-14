import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { ParsedIdPipe } from '../common/parsed-id.pipe';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationQuery } from './notification.dto';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser, @Query() query: NotificationQuery) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const where = { userId: user.userId, ...(query.unread === 'true' ? { readAt: null } : {}) };
    const [items, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId: user.userId, readAt: null } }),
    ]);
    return {
      items: items.map((item) => ({
        id: item.id.toString(),
        type: item.type,
        title: item.title,
        message: item.message,
        topicId: item.topicId?.toString() ?? null,
        readAt: item.readAt,
        createdAt: item.createdAt,
      })),
      unreadCount,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() user: AuthUser) {
    return { unreadCount: await this.prisma.notification.count({ where: { userId: user.userId, readAt: null } }) };
  }

  @Post('read-all')
  async readAll(@CurrentUser() user: AuthUser) {
    await this.prisma.notification.updateMany({
      where: { userId: user.userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { success: true };
  }

  @Post(':id/read')
  async read(
    @Param('id', ParsedIdPipe) id: bigint,
    @CurrentUser() user: AuthUser,
  ) {
    await this.prisma.notification.updateMany({
      where: { id, userId: user.userId },
      data: { readAt: new Date() },
    });
    return { success: true };
  }
}
