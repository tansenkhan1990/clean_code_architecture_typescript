import { PrismaClient } from "@prisma/client";

export type PrismaConnection = {
  client: PrismaClient;
  check(): Promise<void>;
  close(): Promise<void>;
};

/**
 * The URL is passed explicitly instead of read from the environment here, so
 * the composition root remains the only place that knows configuration.
 */
export async function connectPrisma(url: string): Promise<PrismaConnection> {
  const client = new PrismaClient({
    datasourceUrl: url,
    log: ["warn", "error"],
  });

  await client.$connect();

  return {
    client,
    async check() {
      await client.$queryRaw`SELECT 1`;
    },
    async close() {
      await client.$disconnect();
    },
  };
}
