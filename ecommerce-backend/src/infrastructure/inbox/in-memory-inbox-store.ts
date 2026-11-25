import type { InboxStore } from "../../application/ports/inbox-store.js";

/** Per-process inbox: enough for unit tests and local runs. */
export function createInMemoryInboxStore(): InboxStore {
  const processed = new Set<string>();

  return {
    async markProcessed({ id }) {
      if (processed.has(id)) {
        return false;
      }

      processed.add(id);
      return true;
    },

    async hasProcessed(id) {
      return processed.has(id);
    },
  };
}
