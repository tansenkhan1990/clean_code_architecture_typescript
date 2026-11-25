import type { PasswordHasher } from "../../application/ports/password-hasher.js";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

export type ScryptCost = {
  /** CPU/memory cost; must be a power of two. */
  n?: number;
  r?: number;
  p?: number;
};

export type ScryptPasswordHasherOptions = {
  /**
   * Lowered in tests only. The defaults follow OWASP's scrypt guidance
   * (N=2^15, r=8, p=1) and cost roughly 32 MiB and ~100 ms per verification,
   * which is the point: guessing must be expensive.
   */
  cost?: ScryptCost;
};

const DEFAULT_COST = { n: 32_768, r: 8, p: 1 } as const;
const KEY_LENGTH = 64;
const SALT_BYTES = 16;
const ALGORITHM = "scrypt";

type ResolvedCost = { n: number; r: number; p: number };

type ParsedHash = {
  cost: ResolvedCost;
  salt: Buffer;
  key: Buffer;
};

function resolveCost(cost: ScryptCost | undefined): ResolvedCost {
  return {
    n: cost?.n ?? DEFAULT_COST.n,
    r: cost?.r ?? DEFAULT_COST.r,
    p: cost?.p ?? DEFAULT_COST.p,
  };
}

function derive(
  password: string,
  salt: Buffer,
  keyLength: number,
  cost: ResolvedCost,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      keyLength,
      {
        N: cost.n,
        r: cost.r,
        p: cost.p,
        // Node requires maxmem above 128 * N * r; headroom avoids a resize
        // failure at the edge of the limit.
        maxmem: 256 * cost.n * cost.r,
      },
      (error, key) => {
        if (error) {
          reject(error);
        } else {
          resolve(key);
        }
      },
    );
  });
}

function format(cost: ResolvedCost, salt: Buffer, key: Buffer): string {
  return [
    ALGORITHM,
    cost.n,
    cost.r,
    cost.p,
    salt.toString("base64url"),
    key.toString("base64url"),
  ].join("$");
}

/**
 * Parses only hashes this adapter could have produced, with bounded
 * parameters: a corrupted or hostile row cannot make verification allocate
 * unbounded memory.
 */
function parse(stored: string): ParsedHash | null {
  const parts = stored.split("$");

  if (parts.length !== 6 || parts[0] !== ALGORITHM) {
    return null;
  }

  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);

  const powerOfTwo = Number.isInteger(n) && n >= 1_024 && n <= 1_048_576;
  const bounded = Number.isInteger(r) && r >= 1 && r <= 32;
  const parallel = Number.isInteger(p) && p >= 1 && p <= 16;

  if (!powerOfTwo || !bounded || !parallel) {
    return null;
  }

  const salt = Buffer.from(parts[4] ?? "", "base64url");
  const key = Buffer.from(parts[5] ?? "", "base64url");

  if (salt.length < 8 || key.length < 32 || key.length > 128) {
    return null;
  }

  return { cost: { n, r, p }, salt, key };
}

/**
 * scrypt from the Node standard library: no native build step, memory-hard,
 * and parameterised so the work factor can rise without changing the format.
 * The stored value carries its own parameters, so old hashes stay verifiable.
 */
export function createScryptPasswordHasher(
  options: ScryptPasswordHasherOptions = {},
): PasswordHasher {
  const cost = resolveCost(options.cost);

  // A fixed salt for the "no such account" path; the derived key is computed
  // lazily, once per process, and never compared successfully.
  const dummySalt = randomBytes(SALT_BYTES);
  let dummyKey: Promise<Buffer> | null = null;

  const dummy = (): Promise<Buffer> => {
    dummyKey ??= derive(
      "no-such-account-placeholder",
      dummySalt,
      KEY_LENGTH,
      cost,
    );

    return dummyKey;
  };

  return {
    async hash(password) {
      const salt = randomBytes(SALT_BYTES);
      const key = await derive(password, salt, KEY_LENGTH, cost);

      return format(cost, salt, key);
    },

    async verify(password, storedHash) {
      const parsed = storedHash === null ? null : parse(storedHash);

      if (storedHash !== null && parsed === null) {
        return false;
      }

      const expected = parsed?.key ?? (await dummy());
      const actual = await derive(
        password,
        parsed?.salt ?? dummySalt,
        expected.length,
        parsed?.cost ?? cost,
      );

      return (
        parsed !== null &&
        actual.length === expected.length &&
        timingSafeEqual(actual, expected)
      );
    },
  };
}
