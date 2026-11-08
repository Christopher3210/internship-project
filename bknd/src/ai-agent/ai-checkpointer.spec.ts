import { describe, it, expect, vi } from 'vitest';
import { emptyCheckpoint, BaseCheckpointSaver } from '@langchain/langgraph-checkpoint';
import { AiRedisCheckpointer } from './ai-checkpointer.js';

function fakeRedis() {
  let now = 0;
  const rows = new Map<string, { value: unknown; expires: number }>();
  const hashes = new Map<string, { value: Map<string, unknown>; expires: number }>();
  const read = (key: string) => { const item = rows.get(key); return item && item.expires > now ? structuredClone(item.value) : null; };
  return {
    advance: (seconds: number) => { now += seconds; },
    readState: vi.fn(async (key: string) => read(key)),
    writeState: vi.fn(async (key: string, value: unknown, ttl: number) => { rows.set(key, { value: structuredClone(value), expires: now + ttl }); }),
    stateKeys: vi.fn(async (pattern: string) => [...new Set([...rows.keys(), ...hashes.keys()])].filter((key) => key.startsWith(pattern.slice(0, -1)))),
    stateWrites: vi.fn(async (key: string) => { const hash = hashes.get(key); return hash && hash.expires > now ? [...hash.value.values()] : []; }),
    writeStateField: vi.fn(async (key: string, field: string, value: unknown, ttl: number, overwrite: boolean) => {
      let hash = hashes.get(key);
      if (!hash || hash.expires <= now) { hash = { value: new Map(), expires: now + ttl }; hashes.set(key, hash); }
      if (overwrite || !hash.value.has(field)) hash.value.set(field, structuredClone(value));
      hash.expires = now + ttl;
    }),
    deleteStateKeys: vi.fn(async (keys: string[]) => keys.forEach((key) => { rows.delete(key); hashes.delete(key); })),
  };
}
const metadata = { source: 'input' as const, step: 0, parents: {} };
const config = { configurable: { thread_id: 'task-1', checkpoint_ns: '' } };

describe('Redis LangGraph checkpoint contract', () => {
  it('uses the official base and persists checkpoints, parents and pending writes across instances', async () => {
    const redis = fakeRedis();
    const saver = new AiRedisCheckpointer(redis as never, 'alice', 60);
    expect(saver).toBeInstanceOf(BaseCheckpointSaver);
    const first = { ...emptyCheckpoint(), id: '001', channel_values: { progress: 10 } };
    const saved = await saver.put(config, first, metadata, {});
    await Promise.all([
      saver.putWrites(saved, [['value', 'B']], 'task-b', 'b'),
      saver.putWrites(saved, [['value', 'A']], 'task-a', 'a'),
    ]);
    await saver.putWrites(saved, [['value', 'DO NOT OVERWRITE']], 'task-a', 'a');
    const reload = new AiRedisCheckpointer(redis as never, 'alice', 60);
    expect((await reload.getTuple(config))?.pendingWrites).toEqual([['task-a', 'value', 'A'], ['task-b', 'value', 'B']]);
    await reload.put(saved, { ...emptyCheckpoint(), id: '002' }, { ...metadata, step: 1 }, {});
    expect((await reload.getTuple(config))?.parentConfig).toEqual(saved);
    expect((await reload.get(config))?.id).toBe('002');
  });
  it('filters and limits history, and isolates owners and namespaces', async () => {
    const redis = fakeRedis();
    const alice = new AiRedisCheckpointer(redis as never, 'alice');
    const bob = new AiRedisCheckpointer(redis as never, 'bob');
    await alice.put(config, { ...emptyCheckpoint(), id: '001' }, metadata, {});
    await alice.put(config, { ...emptyCheckpoint(), id: '002' }, { ...metadata, step: 1 }, {});
    expect(await bob.getTuple(config)).toBeUndefined();
    expect(await alice.getTuple({ configurable: { ...config.configurable, checkpoint_ns: 'other' } })).toBeUndefined();
    const history = [];
    for await (const row of alice.list(config, { limit: 1, filter: { step: 0 }, before: { configurable: { checkpoint_id: '002' } } })) history.push(row.checkpoint.id);
    expect(history).toEqual(['001']);
    await bob.deleteThread('task-1');
    expect(await alice.getTuple(config)).toBeDefined();
    await alice.deleteThread('task-1');
    expect(await alice.getTuple(config)).toBeUndefined();
  });
  it('expires temporary checkpoints and does not claim success when Redis fails', async () => {
    const redis = fakeRedis();
    const saver = new AiRedisCheckpointer(redis as never, 'alice', 2);
    await saver.put(config, { ...emptyCheckpoint(), id: '001' }, metadata, {});
    redis.advance(3);
    expect(await saver.getTuple(config)).toBeUndefined();
    redis.writeState.mockRejectedValueOnce(new Error('Redis offline'));
    await expect(saver.put(config, emptyCheckpoint(), metadata, {})).rejects.toThrow('Redis offline');
  });
});
