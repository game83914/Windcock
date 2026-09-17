import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from '../auth/jwt.strategy';
import { JwtStrategy } from '../auth/jwt.strategy';

@WebSocketGateway({
  cors: { origin: true, credentials: true },
  namespace: '/',
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(private readonly jwt: JwtService, private readonly prisma: PrismaService, private readonly jwtStrategy: JwtStrategy) {}

  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    // connection is established; room membership is handled via join events
  }

  handleDisconnect(client: Socket) {
    // socket.io cleans up rooms automatically
  }

  @SubscribeMessage('topic:join')
  async handleJoinTopic(client: Socket, payload: { topicId: string }) {
    if (!payload?.topicId || !/^\d+$/.test(payload.topicId)) return;
    const topicId = BigInt(payload.topicId);
    const topic = await this.prisma.topic.findFirst({
      where: { id: topicId, moderationStatus: 'APPROVED', status: { in: ['OPEN', 'LOCKED', 'SETTLED'] } },
      select: { visibility: true, audience: true, audienceOwnerId: true },
    });
    if (!topic) return;
    if (topic.visibility === 'PUBLIC' && topic.audience === 'MEMBER_ONLY') {
      await client.join(`topic:${payload.topicId}`);
      return;
    }
    const userId = await this.authenticateSocketUser(client);
    if (!userId) return;
    if (topic.visibility === 'PRIVATE_LINK') {
      const grant = await this.prisma.topicShareGrant.findFirst({ where: { topicId, userId, shareLink: { enabled: true, topicId } }, select: { userId: true } });
      if (!grant && topic.audienceOwnerId !== userId) return;
    }
    if (topic.audience === 'FOLLOWERS_ONLY' && topic.audienceOwnerId !== userId) {
      if (!topic.audienceOwnerId) return;
      const follow = await this.prisma.channelFollow.findUnique({ where: { followingId_channelOwnerId: { followingId: userId, channelOwnerId: topic.audienceOwnerId } }, select: { followingId: true } });
      if (!follow) return;
    }
    const room = `topic:${payload.topicId}`;
    await client.join(room);
    this.scheduleRoomExpiry(client, room);
  }

  @SubscribeMessage('topic:leave')
  async handleLeaveTopic(client: Socket, payload: { topicId: string }) {
    if (payload && payload.topicId) {
      await client.leave(`topic:${payload.topicId}`);
    }
  }

  async evictTopic(topicId: bigint, exceptUserId?: bigint) {
    const room = `topic:${topicId}`;
    const sockets = await this.server.in(room).fetchSockets();
    await Promise.all(sockets.map(async (socket) => {
      const userId = this.cachedSocketUserId(socket as unknown as Socket);
      if (exceptUserId === undefined || userId !== exceptUserId) await socket.leave(room);
    }));
  }

  async evictUserFromTopics(userId: bigint, topicIds: bigint[]) {
    if (topicIds.length === 0) return;
    const sockets = await this.server.fetchSockets();
    const rooms = topicIds.map((topicId) => `topic:${topicId}`);
    await Promise.all(sockets.map(async (socket) => {
      if (this.cachedSocketUserId(socket as unknown as Socket) !== userId) return;
      await Promise.all(rooms.map((room) => socket.leave(room)));
    }));
  }

  private cachedSocketUserId(client: Socket) {
    const value = client.data.userId;
    return typeof value === 'string' && /^\d+$/.test(value) ? BigInt(value) : null;
  }

  private scheduleRoomExpiry(client: Socket, room: string) {
    const expiresAt = client.data.jwtExpiresAt;
    if (typeof expiresAt !== 'number') return client.leave(room);
    const delay = expiresAt - Date.now();
    if (delay <= 0) return client.leave(room);
    const timer = setTimeout(() => void client.leave(room), delay);
    timer.unref();
  }

  private async authenticateSocketUser(client: Socket) {
    const token = client.handshake.auth?.token;
    if (typeof token !== 'string' || !token) return null;
    try {
      const payload = this.jwt.verify<JwtPayload>(token);
      const userId = (await this.jwtStrategy.validate(payload)).userId;
      client.data.userId = userId.toString();
      client.data.jwtExpiresAt = payload.exp ? payload.exp * 1000 : null;
      return userId;
    } catch {
      return null;
    }
  }
}
