// Disposable local fixtures only. No model API calls; no existing records are modified.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AiRedisService } from '../dist/ai-agent/ai-redis.service.js';
const base = process.env.VERIFY_API_URL ?? 'http://localhost:3001';
const ids = [randomUUID(), randomUUID()];
const marker = `W3_${randomUUID().slice(0, 8)}`;
const db = new pg.Client({ host: process.env.DATABASE_HOST, port: Number(process.env.DATABASE_PORT ?? 5432), user: process.env.DATABASE_USER, password: process.env.DATABASE_PASSWORD, database: process.env.DATABASE_NAME });
const redis = new AiRedisService(new ConfigService());
const jwt = new JwtService({ secret: process.env.JWT_SECRET });
const tokens = ids.map(id => jwt.sign({ sub: id, email: `${id}@verification.invalid` }, { expiresIn: '10m' }));
let checks = 0;
const pass = label => { checks++; console.log(`PASS ${label}`); };
async function req(path, actor = 0, body, method = body === undefined ? 'GET' : 'POST') {
  const start = performance.now();
  const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(actor === null ? {} : { Authorization: `Bearer ${tokens[actor]}` }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: res.status, body: await res.json(), ms: +(performance.now() - start).toFixed(2) };
}
const tool = (name, input = {}, actor = 0, mode = 'query') => req(`/ai-agent/tools/${name}/${mode}`, actor, { input });
const company = { companyCode: marker, companyName: marker, country: 'Japan', city: 'Tokyo', level: 2, foundedYear: 2000, annualRevenue: 100, employees: 2 };
// Watch mode may be restarting immediately after a build. Wait for readiness before fixtures.
for (let attempt = 0; ; attempt++) {
  try { const ready = await fetch(base, { signal: AbortSignal.timeout(2000) }); if (ready.ok) break; } catch { /* startup only */ }
  if (attempt >= 20) throw new Error('Backend is not ready; start it before integration verification');
  await new Promise(resolve => setTimeout(resolve, 1000));
}
await db.connect();
await redis.onModuleInit();
try {
  for (let i = 0; i < ids.length; i++) await db.query('INSERT INTO users (id, name, email, role, status, "passwordHash") VALUES ($1,$2,$3,$4,$5,$6)', [ids[i], marker, `${ids[i]}@verification.invalid`, i === 0 ? 'Admin' : 'Member', 'Active', 'disabled-fixture-login']);
  assert.equal((await req('/companies', 0, company)).status, 201);
  assert.equal((await tool('search_users', {}, null)).status, 401);
  assert.equal((await tool('search_users', {}, 1)).status, 403);
  pass('anonymous and member access denied');

  const readInputs = { search_users: { name: marker }, search_companies_table: { name: marker }, get_dashboard_metrics: {} };
  for (const [name, input] of Object.entries(readInputs)) {
    const cold = await tool(name, input); assert.equal(cold.status, 200); assert.equal(cold.body.cacheHit, false);
    const timings = [];
    for (let i = 0; i < 5; i++) { const hot = await tool(name, input); assert.equal(hot.body.cacheHit, true); assert.deepEqual(hot.body.data, cold.body.data); timings.push(hot.ms); }
    timings.sort((a,b) => a-b);
    console.log(`TIMING ${name} cold=${cold.ms}ms warm-p50=${timings[2]}ms warm-max=${timings[4]}ms`);
    if (name === 'search_users') {
      const business = await req(`/users?name=${marker}`);
      assert.deepEqual(cold.body.data.items.map(x => x.email).sort(), business.body.map(x => x.email).sort());
    } else if (name === 'search_companies_table') {
      const business = await req(`/companies?name=${marker}`);
      assert.equal(cold.body.data.total, business.body.total);
      assert.equal(cold.body.data.items[0].details.annualRevenue, business.body.items[0].annualRevenue);
    } else assert.deepEqual(cold.body.data.summary, (await req('/dashboard/summary')).body);
    pass(`${name}: matches business API and caches repeated queries`);
  }
  await req(`/companies/${marker}`, 0, { annualRevenue: 150 }, 'PATCH');
  const changed = await tool('search_companies_table', { name: marker });
  assert.equal(changed.body.cacheHit, false); assert.equal(changed.body.data.items[0].details.annualRevenue, 150);
  pass('business update invalidates query results');
  const keys = await redis.stateKeys(`ai:chat_cache:${ids[0]}:COMPANIES:*`);
  assert.ok(keys.length);
  for (const key of keys) await redis.writeState(key, await redis.readState(key), 1);
  await new Promise(resolve => setTimeout(resolve, 1100));
  for (const key of keys) assert.equal(await redis.readState(key), null);
  assert.equal((await tool('search_companies_table', { name: marker })).body.cacheHit, false);
  pass('real Redis query expiration falls back to business service');

  const before = await db.query('SELECT id,name,email FROM users WHERE id = ANY($1::uuid[]) ORDER BY id', [ids]);
  const previews = {
    userCreateTool: { name: marker, email: `${marker}@example.test`, password: 'test-only-password', role: 'Member', status: 'Active' },
    userUpdateTool: { id: ids[1], changes: { name: 'Must not save' } },
    userDeleteTool: { id: ids[1] }, userBatchDeleteTool: { ids },
    companyCreateTool: { ...company, companyCode: `${marker}_NEW` },
    companyUpdateTool: { companyCode: marker, changes: { employees: 99 } },
    companyDeleteTool: { companyCode: marker },
  };
  for (const [name,input] of Object.entries(previews)) {
    assert.equal((await tool(name,input,1,'preview')).status,403);
    const result = await tool(name,input,0,'preview'); assert.equal(result.status,200); assert.equal(result.body.data.executed,false);
    assert.ok(!JSON.stringify(result.body).includes('test-only-password'));
  }
  assert.deepEqual((await db.query('SELECT id,name,email FROM users WHERE id = ANY($1::uuid[]) ORDER BY id', [ids])).rows, before.rows);
  assert.equal((await db.query('SELECT employees FROM companies WHERE company_code=$1',[marker])).rows[0].employees,2);
  assert.equal((await db.query('SELECT count(*) FROM companies WHERE company_code=$1',[`${marker}_NEW`])).rows[0].count,'0');
  assert.equal((await db.query('SELECT count(*) FROM users WHERE email=$1',[`${marker}@example.test`])).rows[0].count,'0');
  pass('all seven previews enforce permissions and never write business data');
  const invalid = { ...previews.userCreateTool, email: 'bad' };
  const previewError = await tool('userCreateTool',invalid,0,'preview');
  const apiError = await req('/users',0,invalid);
  assert.equal(previewError.status,400); assert.deepEqual(previewError.body,apiError.body);
  assert.equal((await tool('companyCreateTool',company,0,'preview')).status,409);
  assert.equal((await tool('companyDeleteTool',{companyCode:'W3_MISSING'},0,'preview')).status,404);
  pass('DTO errors match business API; conflicts and missing records rejected');

  for (const prompt of ['search users', '查询日本 Level 2 的公司', 'dashboard metrics']) {
    const session = await req('/ai-agent/sessions',0,{provider:'mock',title:marker});
    const reply = await req(`/ai-agent/sessions/${session.body.id}/messages`,0,{content:prompt});
    assert.equal(reply.status,201);
    const message = reply.body.messages.at(-1);
    assert.ok(message.toolResults?.length); assert.equal(message.toolResults[0].code,200);
  }
  pass('three chat-to-tool paths persist successful structured results in Mock mode');
  const audit = await db.query('SELECT details FROM ai_operation_audit WHERE user_id = ANY($1::uuid[]) AND action IN ($2,$3)',[ids,'tool.execute','tool.preview']);
  assert.ok(audit.rows.length >= 35);
  for (const {details} of audit.rows) { assert.equal(typeof details.durationMs,'number'); assert.ok(details.operationType); }
  const auditText = JSON.stringify(audit.rows);
  assert.ok(!auditText.includes('test-only-password')); assert.ok(!auditText.includes('@verification.invalid'));
  pass('success, denial, preview and cache-hit audits exist, timed and redacted');
  for (const table of ['ai_chat_sessions','ai_user_memory','ai_task_record','ai_operation_audit']) {
    const dangling = await db.query(`SELECT count(*) FROM ${table} a LEFT JOIN users u ON a.user_id=u.id WHERE a.user_id IS NOT NULL AND u.id IS NULL`);
    assert.equal(dangling.rows[0].count,'0');
  }
  pass('four AI tables have no dangling user references');
  console.log(`Completed ${checks} week-three checks without paid model calls.`);
} finally {
  await db.query('DELETE FROM relationships WHERE company_code=$1',[marker]);
  await db.query('DELETE FROM companies WHERE company_code=$1',[marker]);
  await db.query('DELETE FROM ai_operation_audit WHERE user_id=ANY($1::uuid[])',[ids]);
  await db.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[ids]);
  for (const id of ids) for (const prefix of ['ai:session:','ai:chat_cache:','ai:task_state:']) await redis.deletePattern(`${prefix}${id}:*`);
  await redis.onModuleDestroy(); await db.end();
  console.log('Disposable fixtures cleaned up.');
}
