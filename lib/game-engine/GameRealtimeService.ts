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

type PresenceHandler = (state: Record<string, PresenceState[]>) => void;

class GameRealtimeService {
  private channels = new Map<string, RealtimeChannel>();
  private presenceHandlers = new Map<string, Set<PresenceHandler>>();

  // Single JS-level dispatch map: roomId → event → Set of handlers
  // Registered via onBroadcast at any time — not tied to Supabase .on() timing
  private broadcastDispatch = new Map<
    string,
    Map<string, Set<(payload: unknown) => void>>
  >();

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
      if (onPresenceSync) {
        const handlers = this.presenceHandlers.get(roomId) ?? new Set();
        if (!handlers.has(onPresenceSync)) {
          handlers.add(onPresenceSync);
          this.presenceHandlers.set(roomId, handlers);
          const currentState = existing.presenceState<PresenceState>();
          if (Object.keys(currentState).length > 0) {
            onPresenceSync(currentState);
          }
        }
      }
      return existing;
    }

    // Ensure dispatch map exists for this room before the channel is created
    if (!this.broadcastDispatch.has(roomId)) {
      this.broadcastDispatch.set(roomId, new Map());
    }

    const channel = supabase.channel(`room:${roomId}`, {
      config: {
        presence: { key: presenceState.playerId },
        broadcast: { self: false },
      },
    });

    // Presence — register all three events before subscribe()
    const firePresence = () => {
      const state = channel.presenceState<PresenceState>();
      for (const handler of this.presenceHandlers.get(roomId) ?? []) {
        handler(state);
      }
    };
    channel.on("presence", { event: "sync" }, firePresence);
    channel.on("presence", { event: "join" }, firePresence);
    channel.on("presence", { event: "leave" }, firePresence);

    // Single broadcast catch-all — fans out to JS-level dispatch map
    // This is registered once before subscribe() so Supabase receives it
    channel.on(
      "broadcast",
      { event: "*" },
      (msg: { event: string; payload: unknown }) => {
        const handlers = this.broadcastDispatch.get(roomId)?.get(msg.event);
        if (handlers) {
          for (const handler of handlers) {
            handler(msg.payload);
          }
        }
      },
    );

    const presHandlers: Set<PresenceHandler> = new Set();
    if (onPresenceSync) presHandlers.add(onPresenceSync);
    this.presenceHandlers.set(roomId, presHandlers);

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track(presenceState);
      }
    });

    this.channels.set(roomId, channel);
    return channel;
  }

  leaveRoom(roomId: string): void {
    const channel = this.channels.get(roomId);
    if (channel) {
      channel.unsubscribe();
      supabase.removeChannel(channel);
      this.channels.delete(roomId);
      this.presenceHandlers.delete(roomId);
      this.broadcastDispatch.delete(roomId);
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

  // Registers a handler in the JS dispatch map — works at any time,
  // before or after channel subscription, with no Supabase timing constraints.
  onBroadcast(
    roomId: string,
    event: string,
    handler: (payload: unknown) => void,
  ): () => void {
    if (!this.broadcastDispatch.has(roomId)) {
      this.broadcastDispatch.set(roomId, new Map());
    }
    const roomDispatch = this.broadcastDispatch.get(roomId)!;
    if (!roomDispatch.has(event)) {
      roomDispatch.set(event, new Set());
    }
    roomDispatch.get(event)!.add(handler);

    return () => {
      this.broadcastDispatch.get(roomId)?.get(event)?.delete(handler);
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
