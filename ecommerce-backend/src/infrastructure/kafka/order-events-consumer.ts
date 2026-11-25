import { Kafka, type Consumer, type EachMessagePayload } from "kafkajs";
import { CUSTOMER_TOPIC, ORDER_TOPIC } from "./kafka-messages.js";

export type ConsumedEvent = {
  id: string;
  name: string;
  occurredAt: string;
  payload: Record<string, unknown>;
};

export type OrderEventsConsumerOptions = {
  brokers: string[];
  clientId: string;
  groupId: string;
  topics?: string[];
  /** Where a decoded event goes. The default logs one structured line. */
  onEvent?: (event: ConsumedEvent) => Promise<void> | void;
  onError?: (error: unknown) => void;
};

export type OrderEventsConsumer = {
  start(): Promise<void>;
  stop(): Promise<void>;
};

const DEFAULT_TOPICS = [ORDER_TOPIC, CUSTOMER_TOPIC];

/**
 * A consumer that is deliberately idempotent: delivery is at-least-once, so
 * the same `x-event-id` can arrive twice. Recent ids are remembered and
 * duplicates are acknowledged without being handled again.
 *
 * The dedupe set is per-process and bounded. A real projection would persist
 * processed ids in the same database transaction as the projection update
 * (the inbox pattern); this keeps the shape visible without pretending.
 */
export function createOrderEventsConsumer({
  brokers,
  clientId,
  groupId,
  topics = DEFAULT_TOPICS,
  onEvent = (event) => {
    console.log(
      JSON.stringify({
        consumer: "order-events",
        event: event.name,
        id: event.id,
      }),
    );
  },
  onError = (error) => console.error("Kafka consumer error", error),
}: OrderEventsConsumerOptions): OrderEventsConsumer {
  const kafka = new Kafka({ clientId, brokers, retry: { retries: 5 } });
  const consumer: Consumer = kafka.consumer({
    groupId,
    allowAutoTopicCreation: true,
  });
  const seen: string[] = [];
  const seenIds = new Set<string>();
  const MAX_SEEN = 1_000;

  const remember = (id: string): boolean => {
    if (seenIds.has(id)) {
      return false;
    }

    seenIds.add(id);
    seen.push(id);

    if (seen.length > MAX_SEEN) {
      const evicted = seen.shift();
      if (evicted !== undefined) {
        seenIds.delete(evicted);
      }
    }

    return true;
  };

  const handle = async ({ message }: EachMessagePayload): Promise<void> => {
    const headerId = message.headers?.["x-event-id"];
    const raw = message.value?.toString() ?? "";
    let parsed: ConsumedEvent;

    try {
      parsed = JSON.parse(raw) as ConsumedEvent;
    } catch (error) {
      onError(error);
      return;
    }

    const id =
      typeof headerId === "string"
        ? headerId
        : (headerId?.toString() ?? parsed.id);

    if (!remember(id)) {
      return;
    }

    await onEvent({ ...parsed, id });
  };

  return {
    async start() {
      await consumer.connect();
      await consumer.subscribe({ topics, fromBeginning: false });
      await consumer.run({ eachMessage: handle });
    },

    async stop() {
      await consumer.disconnect();
    },
  };
}
