"use client";

import { supabase } from "@/utils/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface PresenceState {
  playerId: string;
  displayName: string;
  teamId: string | null;
  gameRole: string | null;
  isReady: boolean;
}

type BroadcastHandler = (payload: { event: string; payload: unknown }) => void;
type PresenceHandler = (state: Record<string, PresenceState[]>) => void;

class GameRealtimeService {
  private channels = new Map<string, RealtimeChannel>();
  private broadcastHandlers = new Map<
    string,
    Map<string, Set<BroadcastHandler>>
  >();
  // Track all registered presence sync handlers per room so we can re-register on existing channels
  private presenceHandlers = new Map<string, Set<PresenceHandler>>();

  getChannel(roomId: string): RealtimeChannel | undefined {
    return this.channels.get(roomId);
  }

  joinRoom(
    roomId: string,
    presenceState: PresenceState,
    onPresenceSync?: PresenceHandler,
  ): RealtimeChannel {
    const existing = this.channels.get(roomId);

    if (existing) {
      // Channel already open — just register the new presence handler if provided
      if (onPresenceSync) {
        const handlers = this.presenceHandlers.get(roomId) ?? new Set();
        if (!handlers.has(onPresenceSync)) {
          handlers.add(onPresenceSync);
          this.presenceHandlers.set(roomId, handlers);
          existing.on("presence", { event: "sync" }, () => {
            const state = existing.presenceState<PresenceState>();
            onPresenceSync(state);
          });
          // Fire immediately with current state so caller is in sync
          const currentState = existing.presenceState<PresenceState>();
          if (Object.keys(currentState).length > 0) {
            onPresenceSync(currentState);
          }
        }
      }
      return existing;
    }

    const channel = supabase.channel(`room:${roomId}`, {
      config: { presence: { key: presenceState.playerId } },
    });

    const handlers: Set<PresenceHandler> = new Set();
    if (onPresenceSync) {
      handlers.add(onPresenceSync);
    }
    this.presenceHandlers.set(roomId, handlers);

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<PresenceState>();
      for (const handler of this.presenceHandlers.get(roomId) ?? []) {
        handler(state);
      }
    });

    channel.on("presence", { event: "join" }, () => {
      const state = channel.presenceState<PresenceState>();
      for (const handler of this.presenceHandlers.get(roomId) ?? []) {
        handler(state);
      }
    });

    channel.on("presence", { event: "leave" }, () => {
      const state = channel.presenceState<PresenceState>();
      for (const handler of this.presenceHandlers.get(roomId) ?? []) {
        handler(state);
      }
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track(presenceState);
      }
    });

    this.channels.set(roomId, channel);
    this.broadcastHandlers.set(roomId, new Map());

    return channel;
  }

  leaveRoom(roomId: string): void {
    const channel = this.channels.get(roomId);
    if (channel) {
      channel.unsubscribe();
      supabase.removeChannel(channel);
      this.channels.delete(roomId);
      this.broadcastHandlers.delete(roomId);
      this.presenceHandlers.delete(roomId);
    }
  }

  async broadcastEvent(
    roomId: string,
    event: string,
    payload: unknown,
  ): Promise<void> {
    const channel = this.channels.get(roomId);
    if (!channel) return;

    await channel.send({
      type: "broadcast",
      event,
      payload,
    });
  }

  onBroadcast(
    roomId: string,
    event: string,
    handler: (payload: unknown) => void,
  ): () => void {
    const channel = this.channels.get(roomId);
    if (!channel) return () => {};

    const wrappedHandler: BroadcastHandler = (msg) => {
      handler(msg.payload);
    };

    channel.on("broadcast", { event }, wrappedHandler);

    const roomHandlers = this.broadcastHandlers.get(roomId);
    if (roomHandlers) {
      if (!roomHandlers.has(event)) {
        roomHandlers.set(event, new Set());
      }
      roomHandlers.get(event)!.add(wrappedHandler);
    }

    return () => {
      const handlers = this.broadcastHandlers.get(roomId)?.get(event);
      if (handlers) {
        handlers.delete(wrappedHandler);
      }
    };
  }

  async updatePresence(
    roomId: string,
    state: Partial<PresenceState>,
  ): Promise<void> {
    const channel = this.channels.get(roomId);
    if (!channel) return;
    await channel.track(state as PresenceState);
  }

  removeAllChannels(): void {
    for (const [roomId] of this.channels) {
      this.leaveRoom(roomId);
    }
  }
}

export const gameRealtime = new GameRealtimeService();
export type { PresenceState };
