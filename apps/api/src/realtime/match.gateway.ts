import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { AuthTokenVerifier } from '../auth/auth-token-verifier.js';
import { MatchesService } from '../matches/matches.service.js';
import { UsersService } from '../users/users.service.js';

interface JoinPayload {
  readonly matchId?: unknown;
  readonly lastEventSeq?: unknown;
}

@WebSocketGateway({
  namespace: '/match',
  cors: {
    origin: (process.env.APP_ORIGIN ?? 'http://localhost:3000')
      .split(',').map((origin) => origin.trim()).filter(Boolean),
    credentials: true
  }
})
export class MatchGateway {
  @WebSocketServer()
  private server!: Server;
  private readonly sessions = new WeakMap<Socket, { readonly matchId: string; readonly userId: string }>();

  constructor(
    private readonly tokens: AuthTokenVerifier,
    private readonly matches: MatchesService,
    private readonly users: UsersService
  ) {}

  @SubscribeMessage('match.join')
  async join(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinPayload
  ) {
    try {
      const matchId = requireJoinPayload(payload);
      const principal = await this.tokens.verify(extractSocketToken(client));
      const me = await this.users.requireEligible(principal);
      const snapshot = await this.matches.get(principal, matchId);
      await client.join(room(matchId));
      this.sessions.set(client, { matchId, userId: me.id });
      client.to(room(matchId)).emit('participant.presence', {
        eventSeq: snapshot.version,
        userId: me.id,
        connected: true
      });
      return { ok: true, event: 'match.snapshot', snapshot };
    } catch {
      return { ok: false, error: { code: 'MATCH_JOIN_REJECTED', retryable: false } };
    }
  }

  @SubscribeMessage('match.resync')
  async resync(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinPayload
  ) {
    try {
      const matchId = requireJoinPayload(payload);
      const principal = await this.tokens.verify(extractSocketToken(client));
      const snapshot = await this.matches.get(principal, matchId);
      return { ok: true, event: 'match.snapshot', snapshot };
    } catch {
      return { ok: false, error: { code: 'MATCH_RESYNC_REJECTED', retryable: true } };
    }
  }

  handleDisconnect(client: Socket): void {
    const session = this.sessions.get(client);
    if (session) {
      this.server.to(room(session.matchId)).emit('participant.presence', {
        userId: session.userId,
        connected: false
      });
      this.sessions.delete(client);
    }
  }
}

export function extractSocketToken(client: Pick<Socket, 'handshake'>): string {
  const authToken: unknown = client.handshake.auth.token;
  if (typeof authToken === 'string' && authToken.length > 0) return authToken;
  const header = client.handshake.headers.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) return header.slice(7);
  throw new Error('Socket bearer token is missing.');
}

export function requireJoinPayload(payload: JoinPayload): string {
  if (typeof payload.matchId !== 'string' || !isUuid(payload.matchId)) {
    throw new Error('Invalid match ID.');
  }
  if (payload.lastEventSeq !== undefined && (
    typeof payload.lastEventSeq !== 'number' || !Number.isInteger(payload.lastEventSeq) ||
    payload.lastEventSeq < 0
  )) {
    throw new Error('Invalid event sequence.');
  }
  return payload.matchId;
}

function room(matchId: string): string {
  return `match:${matchId}`;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
