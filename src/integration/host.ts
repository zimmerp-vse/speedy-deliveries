// Bridge between the minigame and the embedding master via window.postMessage.

import {
  MESSAGE_SOURCE,
  PROTOCOL_VERSION,
  isInboundMessage,
  type InboundMessage,
  type InitPayload,
  type OutboundMessage,
  type RoundEvent,
  type GameSummary,
} from './protocol';

type Listener = (msg: InboundMessage) => void;

export class EmbedHost {
  private listeners = new Set<Listener>();
  private bufferedInit: InitPayload | null = null;
  private allowedOrigins: string[];
  private parentOrigin: string = '*';
  private bound = false;

  constructor() {
    const env = (import.meta as any).env?.VITE_EMBED_ALLOWED_ORIGINS as string | undefined;
    this.allowedOrigins = env ? env.split(',').map((s) => s.trim()).filter(Boolean) : [];
  }

  /** Whether we're rendered inside an iframe. */
  isEmbedded(): boolean {
    try {
      return typeof window !== 'undefined' && window.parent !== window;
    } catch {
      return true;
    }
  }

  start() {
    if (this.bound || typeof window === 'undefined') return;
    window.addEventListener('message', this.onMessage);
    this.bound = true;
  }

  stop() {
    if (!this.bound) return;
    window.removeEventListener('message', this.onMessage);
    this.bound = false;
  }

  onMessageReceived(fn: Listener) {
    this.listeners.add(fn);
    if (this.bufferedInit) {
      const buffered: InboundMessage = {
        source: MESSAGE_SOURCE,
        type: 'INIT',
        version: PROTOCOL_VERSION,
        payload: this.bufferedInit,
      };
      this.bufferedInit = null;
      fn(buffered);
    }
    return () => this.listeners.delete(fn);
  }

  private isOriginAllowed(origin: string): boolean {
    if (this.allowedOrigins.length === 0) return true; // dev-friendly default
    return this.allowedOrigins.includes(origin);
  }

  private onMessage = (event: MessageEvent) => {
    if (!this.isOriginAllowed(event.origin)) return;
    if (!isInboundMessage(event.data)) return;
    if (event.data.version !== PROTOCOL_VERSION) {
      this.send({
        source: MESSAGE_SOURCE,
        type: 'ERROR',
        version: PROTOCOL_VERSION,
        payload: { code: 'version_mismatch', message: `Expected protocol v${PROTOCOL_VERSION}` },
      });
      return;
    }
    // Lock parent origin to first valid sender.
    if (this.parentOrigin === '*' && event.origin) this.parentOrigin = event.origin;

    if (this.listeners.size === 0 && event.data.type === 'INIT') {
      this.bufferedInit = event.data.payload;
      return;
    }
    this.listeners.forEach((l) => l(event.data));
  };

  private send(msg: OutboundMessage) {
    if (typeof window === 'undefined') return;
    try {
      window.parent.postMessage(msg, this.parentOrigin);
    } catch (e) {
      console.warn('[EmbedHost] postMessage failed', e);
    }
  }

  sendReady() {
    this.send({
      source: MESSAGE_SOURCE,
      type: 'READY',
      version: PROTOCOL_VERSION,
      payload: { protocolVersion: PROTOCOL_VERSION },
    });
  }

  sendInitAck(appliedConfig: Record<string, unknown>, sessionId?: string) {
    this.send({
      source: MESSAGE_SOURCE,
      type: 'INIT_ACK',
      version: PROTOCOL_VERSION,
      payload: { appliedConfig, sessionId },
    });
  }

  sendRoundStart(round: number, scene: string, deliveryType: string, sessionId?: string) {
    this.send({
      source: MESSAGE_SOURCE,
      type: 'ROUND_START',
      version: PROTOCOL_VERSION,
      payload: { sessionId, round, scene, deliveryType, startedAt: Date.now() },
    });
  }

  sendRoundEnd(event: RoundEvent, sessionId?: string) {
    this.send({
      source: MESSAGE_SOURCE,
      type: 'ROUND_END',
      version: PROTOCOL_VERSION,
      payload: { sessionId, ...event },
    });
  }

  sendGameEnd(summary: GameSummary) {
    this.send({
      source: MESSAGE_SOURCE,
      type: 'GAME_END',
      version: PROTOCOL_VERSION,
      payload: summary,
    });
  }
}

// Singleton — there's only ever one game per iframe.
export const embedHost = new EmbedHost();
