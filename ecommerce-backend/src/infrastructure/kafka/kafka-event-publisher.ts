import { Kafka, Partitioners, type Producer } from "kafkajs";
import type { EventPublisher } from "../../application/ports/event-publisher.js";
import { toKafkaMessage } from "./kafka-messages.js";

export type KafkaEventPublisherOptions = {
  brokers: string[];
  clientId: string;
  /** Producer acks. `all` waits for the in-sync replicas. */
  acks?: number;
};

export type KafkaEventPublisher = EventPublisher & {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
};

/**
 * Kafka is one possible *reader* of the outbox. The dispatcher still decides
 * when an event is delivered; this adapter only decides how it travels:
 * topic, partition key, JSON body, headers.
 *
 * The producer connects lazily on the first publish, so a broker that is down
 * fails the delivery (and the outbox retries it) instead of the whole process.
 */
export function createKafkaEventPublisher({
  brokers,
  clientId,
  acks = -1,
}: KafkaEventPublisherOptions): KafkaEventPublisher {
  const kafka = new Kafka({
    clientId,
    brokers,
    retry: { retries: 5, initialRetryTime: 200 },
  });

  const producer: Producer = kafka.producer({
    allowAutoTopicCreation: true,
    createPartitioner: Partitioners.DefaultPartitioner,
  });
  let connection: Promise<void> | null = null;

  const connect = async (): Promise<void> => {
    if (connection === null) {
      connection = producer.connect().catch((error: unknown) => {
        // A failed connect must not be cached as success.
        connection = null;
        throw error;
      });
    }

    await connection;
  };

  return {
    async publish(event, envelope) {
      await connect();
      const message = toKafkaMessage(event, envelope);

      await producer.send({
        topic: message.topic,
        acks,
        messages: [
          {
            ...(message.key === null ? {} : { key: message.key }),
            value: message.value,
            headers: message.headers,
          },
        ],
      });
    },

    connect,

    async disconnect() {
      if (connection !== null) {
        await producer.disconnect();
        connection = null;
      }
    },
  };
}
