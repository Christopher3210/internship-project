import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseCheckpointSaver, WRITES_IDX_MAP, compareWritesSortKeys, writesSortKey, type Checkpoint, type CheckpointTuple, type CheckpointListOptions, type CheckpointMetadata, type ChannelVersions, type PendingWrite } from '@langchain/langgraph-checkpoint';
import type { RunnableConfig } from '@langchain/core/runnables';
import { AiRedisService } from './ai-redis.service.js';

type Blob = [string, string];
type Stored = { thread: string; ns: string; id: string; parent?: string; checkpoint: Blob; metadata: Blob };
type Write = { task: string; path: string; index: number; channel: string; value: Blob };
const encode = (value: string) => Buffer.from(value).toString('base64url');

/** One server-bound owner per saver. Never take owner identity from model/config input. */
export class AiRedisCheckpointer extends BaseCheckpointSaver {
  private readonly prefix: string;
  constructor(private readonly redis: AiRedisService, ownerId: string, private readonly ttl = 86400) {
    super();
    if (!ownerId || !Number.isInteger(ttl) || ttl <= 0) throw new Error('Owner and positive TTL are required');
    this.prefix = `ai:task_state:checkpoint:${encode(ownerId)}:`;
  }
  private fields(config: RunnableConfig) {
    const thread = config.configurable?.thread_id;
    const ns = config.configurable?.checkpoint_ns ?? '';
    const id = config.configurable?.checkpoint_id;
    if (typeof thread !== 'string' || !thread || typeof ns !== 'string' || (id !== undefined && typeof id !== 'string')) throw new Error('Invalid checkpoint identifiers');
    return { thread, ns, id: id as string | undefined };
  }
  private key(thread: string, ns: string, id: string) { return `${this.prefix}${encode(thread)}:${encode(ns)}:${encode(id)}`; }
  private config(thread: string, ns: string, id: string): RunnableConfig { return { configurable: { thread_id: thread, checkpoint_ns: ns, checkpoint_id: id } }; }
  private async pack(value: unknown): Promise<Blob> {
    const [type, bytes] = await this.serde.dumpsTyped(value);
    return [type, Buffer.from(bytes).toString('base64')];
  }
  private unpack(blob: Blob) { return this.serde.loadsTyped(blob[0], Buffer.from(blob[1], 'base64')); }
  private async tuple(row: Stored): Promise<CheckpointTuple> {
    const writes = await this.redis.stateWrites<Write>(`${this.key(row.thread, row.ns, row.id)}:writes`);
    writes.sort((a, b) => compareWritesSortKeys(writesSortKey(a.path, a.task, a.index), writesSortKey(b.path, b.task, b.index)));
    return {
      config: this.config(row.thread, row.ns, row.id),
      checkpoint: await this.unpack(row.checkpoint) as Checkpoint,
      metadata: await this.unpack(row.metadata) as CheckpointMetadata,
      ...(row.parent ? { parentConfig: this.config(row.thread, row.ns, row.parent) } : {}),
      pendingWrites: await Promise.all(writes.map(async (write) => [write.task, write.channel, await this.unpack(write.value)] as [string, string, unknown])),
    };
  }
  async getTuple(config: RunnableConfig) {
    const { thread, ns, id } = this.fields(config);
    if (id) {
      const row = await this.redis.readState<Stored>(this.key(thread, ns, id));
      return row ? this.tuple(row) : undefined;
    }
    for await (const tuple of this.list({ configurable: { thread_id: thread, checkpoint_ns: ns } }, { limit: 1 })) return tuple;
    return undefined;
  }
  async *list(config: RunnableConfig, options: CheckpointListOptions = {}): AsyncGenerator<CheckpointTuple> {
    const thread = config.configurable?.thread_id;
    if (thread !== undefined) this.fields(config);
    const pattern = thread === undefined ? `${this.prefix}*` : `${this.prefix}${encode(thread)}:*`;
    const rows: Stored[] = [];
    for (const key of await this.redis.stateKeys(pattern)) {
      if (key.endsWith(':writes')) continue;
      const row = await this.redis.readState<Stored>(key);
      if (!row || (config.configurable?.checkpoint_ns !== undefined && row.ns !== config.configurable.checkpoint_ns)
        || (config.configurable?.checkpoint_id && row.id !== config.configurable.checkpoint_id)
        || (options.before?.configurable?.checkpoint_id && row.id >= options.before.configurable.checkpoint_id)) continue;
      rows.push(row);
    }
    rows.sort((a, b) => a.id === b.id ? 0 : a.id > b.id ? -1 : 1);
    let count = 0;
    for (const row of rows) {
      if (options.limit !== undefined && count >= options.limit) break;
      const tuple = await this.tuple(row);
      if (options.filter && !Object.entries(options.filter).every(([key, value]) => (tuple.metadata as Record<string, unknown> | undefined)?.[key] === value)) continue;
      count++;
      yield tuple;
    }
  }
  async put(config: RunnableConfig, checkpoint: Checkpoint, metadata: CheckpointMetadata, _newVersions: ChannelVersions): Promise<RunnableConfig> {
    const { thread, ns, id: parent } = this.fields(config);
    if (!checkpoint.id || typeof checkpoint.id !== 'string') throw new Error('Checkpoint ID is required');
    if (checkpoint.v < 4) throw new Error('Checkpoint format v4 or newer is required');
    const row: Stored = { thread, ns, id: checkpoint.id, parent, checkpoint: await this.pack(checkpoint), metadata: await this.pack(metadata) };
    await this.redis.writeState(this.key(thread, ns, checkpoint.id), row, this.ttl);
    return this.config(thread, ns, checkpoint.id);
  }
  async putWrites(config: RunnableConfig, writes: PendingWrite[], taskId: string, taskPath = '') {
    const { thread, ns, id } = this.fields(config);
    if (!id || !taskId) throw new Error('Checkpoint ID and task ID are required');
    for (let i = 0; i < writes.length; i++) {
      const [channel, value] = writes[i];
      const index = WRITES_IDX_MAP[channel] ?? i;
      const row: Write = { task: taskId, path: taskPath, index, channel, value: await this.pack(value) };
      await this.redis.writeStateField(`${this.key(thread, ns, id)}:writes`, JSON.stringify([taskId, index]), row, this.ttl, index < 0);
    }
  }
  async deleteThread(threadId: string) {
    if (!threadId) throw new Error('Thread ID is required');
    await this.redis.deleteStateKeys(await this.redis.stateKeys(`${this.prefix}${encode(threadId)}:*`));
  }
}

@Injectable()
export class AiCheckpointerFactory {
  constructor(private readonly redis: AiRedisService, private readonly config: ConfigService) {}
  forUser(authenticatedUserId: string) {
    return new AiRedisCheckpointer(this.redis, authenticatedUserId, Number(this.config.get('AI_TASK_STATE_TTL_SECONDS') ?? 86400));
  }
}
