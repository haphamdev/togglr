// Phase-1 no-op SSE placeholder. The real EventSource stream (ruleset/flag live
// updates) lands in Phase 2. connect()/close() are provably inert here: they open
// no EventSource and issue no network request. `connected` stays false.

export class SseClient {
  private connectedFlag = false;

  /** Inert in Phase 1 — opens no EventSource / network connection. */
  connect(): void {
    // Intentionally does nothing until Phase 2 wires the live stream.
  }

  close(): void {
    this.connectedFlag = false;
  }

  get connected(): boolean {
    return this.connectedFlag;
  }
}

export const sseClient = new SseClient();
