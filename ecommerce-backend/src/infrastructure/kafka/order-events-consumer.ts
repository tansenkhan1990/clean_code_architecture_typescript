import { Kafka, type Consumer, type EachMessagePayload } from "kafkajs";
import type { InboxStore } from "../../application/ports/inbox-store.js";
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
  /** Durable dedupe. Without one, a restart replays recent events. */
  inbox?: InboxStore;
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
 * Delivery is at-least-once, so the same `x-event-id` can arrive twice. The
 * inbox makes that harmless across restarts and across replicas: the insert is
 * the claim, and a duplicate is acknowledged without running the handler.
 *
 * A production projection would record the id in the *same transaction* as the
 * projection update; the port allows that, and the current handler only logs.
 */
export function createOrderEventsConsumer({
  brokers,
  clientId,
  groupId,
  topics = DEFAULT_TOPICS,
  inbox,
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

    if (inbox !== undefined) {
      const firstDelivery = await inbox.markProcessed({
        id,
        eventName: parsed.name,
        processedAt: new Date().toISOString(),
      });

      if (!firstDelivery) {
        return;
      }
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
