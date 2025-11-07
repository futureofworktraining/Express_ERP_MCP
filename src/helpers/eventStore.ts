/**
 * In-memory event store dla MCP resumability
 * Przechowuje eventy per sesja dla mechanizmu reconnect
 */

interface StoredEvent {
  id: string;
  data: string;
}

export class InMemoryEventStore {
  private events: Map<string, StoredEvent[]> = new Map();
  private maxEventsPerSession = 100; // Limit eventów per sesja

  /**
   * Zapisuje event dla danej sesji
   */
  async storeEvent(sessionId: string, eventId: string, data: string): Promise<void> {
    if (!this.events.has(sessionId)) {
      this.events.set(sessionId, []);
    }

    const sessionEvents = this.events.get(sessionId)!;
    sessionEvents.push({ id: eventId, data });

    // Ogranicz liczbę eventów (FIFO)
    if (sessionEvents.length > this.maxEventsPerSession) {
      sessionEvents.shift();
    }
  }

  /**
   * Pobiera eventy od określonego ID (dla resumability)
   */
  async getEventsSince(sessionId: string, lastEventId?: string): Promise<StoredEvent[]> {
    const sessionEvents = this.events.get(sessionId) || [];

    if (!lastEventId) {
      return sessionEvents;
    }

    // Znajdź index ostatniego otrzymanego eventu
    const lastIndex = sessionEvents.findIndex((e) => e.id === lastEventId);

    if (lastIndex === -1) {
      // Nie znaleziono - zwróć wszystkie
      return sessionEvents;
    }

    // Zwróć eventy po ostatnim otrzymanym
    return sessionEvents.slice(lastIndex + 1);
  }

  /**
   * Usuwa eventy dla sesji (gdy sesja jest zamykana)
   */
  async clearSession(sessionId: string): Promise<void> {
    this.events.delete(sessionId);
  }

  /**
   * Czysci stare sesje (opcjonalne)
   */
  async cleanup(_maxAge: number = 3600000): Promise<void> {
    // W prawdziwej implementacji należałoby dodać timestampy
    // i usuwać sesje starsze niż _maxAge
  }

  /**
   * Replay events po określonym event ID (dla resumability)
   * Wymaga interface EventStore z MCP SDK
   */
  async replayEventsAfter(
    sessionId: string,
    lastEventId: string | undefined
  ): Promise<AsyncIterable<{ id: string; data: string }>> {
    const events = await this.getEventsSince(sessionId, lastEventId);

    // Zwróć async iterable
    async function* generator() {
      for (const event of events) {
        yield event;
      }
    }

    return generator();
  }
}
