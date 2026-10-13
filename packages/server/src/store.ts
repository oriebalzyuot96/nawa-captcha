/**
 * Storage used for one-time redemption (challenge ids, pass-token ids), attempt counters, rate
 * limits and adaptive difficulty. Every operation must be atomic in a multi-instance deployment,
 * which is why the interface is two primitives rather than get/set.
 */
export interface NawaCaptchaStore {
  /** Sets `key` only if absent. Resolves true when this call created it (i.e. first redemption). */
  setIfAbsent(key: string, ttlMs: number): Promise<boolean>;
  /** Increments a counter (creating it with `ttlMs` if absent) and resolves the new value. */
  increment(key: string, ttlMs: number): Promise<number>;
  /** Current counter value, or 0. */
  count(key: string): Promise<number>;
  delete(key: string): Promise<void>;
}

interface Entry {
  value: number;
  expiresAt: number;
}

export interface MemoryStoreOptions {
  /** Upper bound on live entries; least-recently-used entries are evicted beyond it. */
  readonly maxEntries?: number;
  readonly now?: () => number;
}

/**
 * Single-process LRU store with TTLs. Fine for one Node instance and for tests. Behind a load
 * balancer use Redis (or any shared atomic store), otherwise a token redeemed on instance A
 * could be replayed on instance B.
 */
export class MemoryStore implements NawaCaptchaStore {
  private readonly map = new Map<string, Entry>();
  private readonly max: number;
  private readonly now: () => number;

  constructor(options: MemoryStoreOptions = {}) {
    this.max = options.maxEntries ?? 100_000;
    this.now = options.now ?? Date.now;
  }

  get size(): number {
    return this.map.size;
  }

  private live(key: string): Entry | undefined {
    const e = this.map.get(key);
    if (!e) return undefined;
    if (e.expiresAt <= this.now()) {
      this.map.delete(key);
      return undefined;
    }
    // Re-insert to mark as most recently used.
    this.map.delete(key);
    this.map.set(key, e);
    return e;
  }

  private put(key: string, entry: Entry): void {
    this.map.set(key, entry);
    if (this.map.size > this.max) this.evict();
  }

  private evict(): void {
    const now = this.now();
    for (const [k, e] of this.map) {
      if (this.map.size <= this.max) return;
      if (e.expiresAt <= now) this.map.delete(k);
    }
    while (this.map.size > this.max) {
      const oldest = this.map.keys().next();
      if (oldest.done) return;
      this.map.delete(oldest.value);
    }
  }

  async setIfAbsent(key: string, ttlMs: number): Promise<boolean> {
    if (this.live(key)) return false;
    this.put(key, { value: 1, expiresAt: this.now() + ttlMs });
    return true;
  }

  async increment(key: string, ttlMs: number): Promise<number> {
    const e = this.live(key);
    if (e) {
      e.value += 1;
      return e.value;
    }
    this.put(key, { value: 1, expiresAt: this.now() + ttlMs });
    return 1;
  }

  async count(key: string): Promise<number> {
    return this.live(key)?.value ?? 0;
  }

  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }
}

// ------------------------------------------------------------------------------------ Redis

const INCR_SCRIPT = "local v = redis.call('INCR', KEYS[1]) if v == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end return v";

/** The subset of the ioredis client used by {@link ioredisStore}. */
export interface IoRedisLike {
  set(key: string, value: string, px: 'PX', ttl: number, nx: 'NX'): Promise<'OK' | null>;
  eval(script: string, numKeys: number, ...args: Array<string | number>): Promise<unknown>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<number>;
}

/** The subset of the node-redis v4+ client used by {@link nodeRedisStore}. */
export interface NodeRedisLike {
  set(key: string, value: string, options: { PX: number; NX: true }): Promise<string | null>;
  eval(script: string, options: { keys: string[]; arguments: string[] }): Promise<unknown>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<number>;
}

/**
 * Redis adapter for ioredis: `ioredisStore(new Redis(url))`. SET NX PX gives atomic one-time
 * redemption; INCR+PEXPIRE runs as a Lua script so a counter can never be left without a TTL.
 */
// The default key prefix keeps its pre-rename value so stores stay compatible across the upgrade.
export function ioredisStore(client: IoRedisLike, prefix = 'nawa-guard:'): NawaCaptchaStore {
  return {
    setIfAbsent: async (key, ttlMs) => (await client.set(prefix + key, '1', 'PX', Math.max(1, Math.ceil(ttlMs)), 'NX')) === 'OK',
    increment: async (key, ttlMs) => Number(await client.eval(INCR_SCRIPT, 1, prefix + key, Math.max(1, Math.ceil(ttlMs)))),
    count: async (key) => Number((await client.get(prefix + key)) ?? 0),
    delete: async (key) => {
      await client.del(prefix + key);
    },
  };
}

/** Redis adapter for node-redis v4+: `nodeRedisStore(createClient({ url }))` (after `connect()`). */
export function nodeRedisStore(client: NodeRedisLike, prefix = 'nawa-guard:'): NawaCaptchaStore {
  return {
    setIfAbsent: async (key, ttlMs) => (await client.set(prefix + key, '1', { PX: Math.max(1, Math.ceil(ttlMs)), NX: true })) === 'OK',
    increment: async (key, ttlMs) => Number(await client.eval(INCR_SCRIPT, { keys: [prefix + key], arguments: [String(Math.max(1, Math.ceil(ttlMs)))] })),
    count: async (key) => Number((await client.get(prefix + key)) ?? 0),
    delete: async (key) => {
      await client.del(prefix + key);
    },
  };
}
