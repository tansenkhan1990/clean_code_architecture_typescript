import { assignRole } from "../domain/auth/account.js";
import { loadConfig } from "../infrastructure/config/config.js";
import { buildPrismaPersistence } from "../infrastructure/persistence/prisma/prisma-dependencies.js";

/**
 * Roles are never self-assigned, and there is no public endpoint that can
 * create one. Elevation is an auditable operator action:
 *
 *   npm run admin:grant -- ada@example.com
 *   # in a deployed image:
 *   node dist/main/grant-admin.js ada@example.com
 */
async function main(): Promise<void> {
  const email = process.argv[2]?.trim().toLowerCase();

  if (email === undefined || email.length === 0) {
    console.error("Usage: npm run admin:grant -- <email>");
    process.exitCode = 1;
    return;
  }

  const config = loadConfig();

  if (!config.ok) {
    console.error(config.error.message);
    process.exitCode = 1;
    return;
  }

  if (config.value.databaseUrl === null) {
    console.error("DATABASE_URL is required to change a role");
    process.exitCode = 1;
    return;
  }

  const persistence = await buildPrismaPersistence({
    url: config.value.databaseUrl,
  });

  try {
    const customer = await persistence.customers.findByEmail(email);

    if (customer === null) {
      console.error(`No customer is registered with ${email}`);
      process.exitCode = 1;
      return;
    }

    const account = await persistence.accounts.findByCustomerId(customer.id);

    if (account === null) {
      console.error(`${email} has no credential record`);
      process.exitCode = 1;
      return;
    }

    const updated = assignRole(account, "admin", new Date().toISOString());

    if (!updated.ok) {
      console.error(updated.error.message);
      process.exitCode = 1;
      return;
    }

    await persistence.accounts.save(updated.value);
    console.log(`Granted admin to ${email} (${customer.id})`);
    console.log(
      "Existing access tokens keep their old role until they expire.",
    );
  } finally {
    await persistence.close();
  }
}

await main();
