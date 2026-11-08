// Run after npm run build, with the local backend running:
// node --env-file=.env scripts/verify-ai-foundation.mjs
// Creates only disposable fixtures; no paid model requests. Cleanup is limited to generated IDs.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { emptyCheckpoint } from '@langchain/langgraph-checkpoint';
import { AiRedisService } from '../dist/ai-agent/ai-redis.service.js';
import { AiRedisCheckpointer } from '../dist/ai-agent/ai-checkpointer.js';
import { AiQueryCacheService } from '../dist/ai-agent/ai-query-cache.service.js';

const base = process.env.VERIFY_API_URL ?? 'http://localhost:3001';
const ids = [randomUUID(), randomUUID(), randomUUID()];
const companyCode = `QA_${randomUUID().slice(0, 8)}`;
const db = new pg.Client({ host: process.env.DATABASE_HOST, port: Number(process.env.DATABASE_PORT ?? 5432), user: process.env.DATABASE_USER, password: process.env.DATABASE_PASSWORD, database: process.env.DATABASE_NAME });
const redis = new AiRedisService(new ConfigService());
const jwt = new JwtService({ secret: process.env.JWT_SECRET });
const tokens = ids.map((id) => jwt.sign({ sub: id, email: `${id}@verification.invalid` }, { expiresIn: '5m' }));
let passed = 0;
async function request(path, index, method = 'GET', body) {
  const response = await fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(index === undefined ? {} : { Authorization: `Bearer ${tokens[index]}` }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = await response.json().catch(() => null);
  return { status: response.status, data };
}
await db.connect();
await redis.onModuleInit();
try {
  for (let i = 0; i < ids.length; i++) {
    await db.query('INSERT INTO users (id, name, email, role, status, "passwordHash") VALUES ($1, $2, $3, $4, $5, $6)', [ids[i], 'Disposable verification account', `${ids[i]}@verification.invalid`, i === 2 ? 'Admin' : 'Member', 'Active', 'not-a-login-password']);
  }
  assert.equal((await request('/users', undefined)).status, 401);
  passed++; console.log('PASS anonymous user management denied');
  assert.equal((await request(`/users/${ids[0]}`, 0, 'PATCH', { role: 'Admin' })).status, 403);
  passed++; console.log('PASS member cannot elevate role');
  assert.equal((await request('/users', 2)).status, 200);
  passed++; console.log('PASS admin user management authenticated');
  const session = await request('/ai-agent/sessions', 0, 'POST', { provider: 'mock', title: 'Disposable QA session' });
  assert.equal(session.status, 201);
  for (const other of [1, 2]) assert.equal((await request(`/ai-agent/sessions/${session.data.id}`, other)).status, 404);
  passed++; console.log('PASS sessions isolated from other members and administrators');
  const memory = await request('/ai-agent/memory', 0, 'POST', { key: 'qa_preference', value: 'fixture-only' });
  assert.equal(memory.status, 201);
  assert.equal((await request(`/ai-agent/memory/${memory.data.id}`, 1)).status, 404);
  assert.equal((await request('/ai-agent/memory', 1)).data.total, 0);
  assert.equal((await request(`/ai-agent/memory?userId=${ids[0]}`, 1)).status, 403);
  passed++; console.log('PASS memory identity and filter isolation');
  const sent = await request(`/ai-agent/sessions/${session.data.id}/messages`, 0, 'POST', { content: 'Hello verification' });
  assert.equal(sent.status, 201);
  const contextKey = `ai:session:${ids[0]}:${session.data.id}`;
  assert.equal((await redis.get(contextKey)).length, 2);
  assert.equal((await request(`/ai-agent/sessions/${session.data.id}/close`, 0, 'POST')).status, 201);
  assert.equal(await redis.get(contextKey), null);
  assert.equal((await request(`/ai-agent/sessions/${session.data.id}`, 0)).data.messages.length, 2);
  assert.equal((await redis.get(contextKey)).length, 2);
  passed++; console.log('PASS close clears Redis and history recovers from PostgreSQL');
  const task = await request('/ai-agent/tasks', 0, 'POST', { taskType: 'qa_manual' });
  assert.equal(task.status, 201);
  assert.equal((await request(`/ai-agent/tasks/${task.data.id}`, 1)).status, 404);
  assert.equal((await request(`/ai-agent/tasks/${task.data.id}`, 0, 'PATCH', { progress: 40 })).data.status, 'running');
  assert.equal((await request(`/ai-agent/tasks/${task.data.id}`, 0, 'PATCH', { status: 'completed' })).data.progress, 100);
  assert.equal((await request(`/ai-agent/tasks/${task.data.id}`, 0, 'PATCH', { progress: 50 })).status, 409);
  passed++; console.log('PASS task ownership and terminal progress validation');
  const managed = await request('/ai-agent/tasks', 0, 'POST', { taskType: 'company_search' });
  assert.equal((await request(`/ai-agent/tasks/${managed.data.id}`, 0, 'PATCH', { progress: 50 })).status, 409);
  passed++; console.log('PASS REST cannot overwrite execution-managed progress');
  const ownAudits = await request('/ai-agent/audits', 0);
  assert(ownAudits.data.total > 0);
  assert(ownAudits.data.items.every((item) => item.userId === ids[0]));
  assert.equal((await request(`/ai-agent/audits?userId=${ids[0]}`, 2)).data.total, ownAudits.data.total);
  passed++; console.log('PASS own audit isolation and administrator audit filter');
  const saver = new AiRedisCheckpointer(redis, ids[0], 2);
  const thread = { configurable: { thread_id: 'qa-thread', checkpoint_ns: '' } };
  const saved = await saver.put(thread, emptyCheckpoint(), { source: 'input', step: 0, parents: {} }, {});
  await saver.putWrites(saved, [['value', 42]], 'qa-task');
  assert.equal((await saver.getTuple(thread)).pendingWrites[0][2], 42);
  assert.equal(await new AiRedisCheckpointer(redis, ids[1], 2).getTuple(thread), undefined);
  await new Promise((resolve) => setTimeout(resolve, 2200));
  assert.equal(await saver.getTuple(thread), undefined);
  passed++; console.log('PASS real Redis Checkpointer writes, isolation and expiration');
  const cache = new AiQueryCacheService(redis, new ConfigService());
  const before = await cache.key(ids[0], 'search_companies_table', {});
  const company = await request('/companies', 2, 'POST', { companyCode, companyName: 'Disposable verification company', level: 1, country: 'QA', city: 'QA', foundedYear: 2020, annualRevenue: 1, employees: 1 });
  assert.equal(company.status, 201);
  const after = await cache.key(ids[0], 'search_companies_table', {});
  assert.notEqual(before.key, after.key);
  passed++; console.log('PASS business mutation invalidates cached queries');
  await db.query('UPDATE users SET status = $1 WHERE id = $2', ['Inactive', ids[1]]);
  assert.equal((await request('/ai-agent/memory', 1)).status, 401);
  passed++; console.log('PASS inactive account token rejected');
  console.log(`Verified ${passed} checks without paid model calls.`);
} finally {
  await db.query('DELETE FROM relationships WHERE company_code = $1', [companyCode]).catch(() => undefined);
  await db.query('DELETE FROM companies WHERE company_code = $1', [companyCode]);
  await db.query('DELETE FROM ai_operation_audit WHERE user_id = ANY($1::uuid[])', [ids]);
  await db.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [ids]);
  for (const id of ids) {
    await redis.deletePattern(`ai:session:${id}:*`);
    await redis.deletePattern(`ai:task_state:${id}:*`);
    await redis.deletePattern(`ai:chat_cache:${id}:*`);
    await new AiRedisCheckpointer(redis, id).deleteThread('qa-thread');
  }
  await redis.onModuleDestroy();
  await db.end();
  console.log('Disposable verification fixtures cleaned up.');
}
