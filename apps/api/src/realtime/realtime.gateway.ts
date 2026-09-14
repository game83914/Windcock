import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: { origin: true, credentials: true },
  namespace: '/',
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
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
    if (payload && payload.topicId) {
      await client.join(`topic:${payload.topicId}`);
    }
  }

  @SubscribeMessage('topic:leave')
  async handleLeaveTopic(client: Socket, payload: { topicId: string }) {
    if (payload && payload.topicId) {
      await client.leave(`topic:${payload.topicId}`);
    }
  }
}
