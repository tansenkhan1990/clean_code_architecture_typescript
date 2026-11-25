import { Kafka } from "kafkajs";
import { KAFKA_TOPICS } from "./kafka-messages.js";

export type EnsureKafkaTopicsOptions = {
  brokers: string[];
  clientId: string;
  topics?: string[];
  numPartitions?: number;
};

/**
 * Topic creation belongs to the broker side of the world and belongs at
 * start-up, before any consumer subscribes. Relying on auto-creation leaves a
 * race: the first consumer can be rejected with "this server does not host
 * this topic-partition" while the topic is still being created.
 *
 * Existing topics are left alone, so this is safe to run on every boot.
 */
export async function ensureKafkaTopics({
  brokers,
  clientId,
  topics = KAFKA_TOPICS,
  numPartitions = 3,
}: EnsureKafkaTopicsOptions): Promise<void> {
  const kafka = new Kafka({
    clientId: `${clientId}-admin`,
    brokers,
    retry: { retries: 5, initialRetryTime: 200 },
  });
  const admin = kafka.admin();

  await admin.connect();

  try {
    const existing = new Set(await admin.listTopics());
    const missing = topics.filter((topic) => !existing.has(topic));

    if (missing.length === 0) {
      return;
    }

    await admin.createTopics({
      waitForLeaders: true,
      topics: missing.map((topic) => ({
        topic,
        numPartitions,
        replicationFactor: 1,
      })),
    });
  } finally {
    await admin.disconnect();
  }
}
