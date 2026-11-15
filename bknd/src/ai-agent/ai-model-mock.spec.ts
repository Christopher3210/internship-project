import { describe, it, expect, vi } from 'vitest';
import { AiModelService } from './ai-model.service.js';
describe('Mock core tool routing', () => {
  for (const [prompt, tool, input] of [
    ['search users', 'search_users', {page:1,pageSize:20}],
    ['查询日本 Level 2 的公司', 'search_companies_table', {country:'Japan',levels:[2],page:1,pageSize:20}],
    ['dashboard metrics', 'get_dashboard_metrics', {}],
  ] as const) it(prompt, async () => {
    const service = new AiModelService({get:()=>undefined} as never, {} as never);
    const execute = vi.fn(async () => ({code:200,data:{summary:{}},message:'ok'}));
    await service.generateReply('mock',[{id:'test',role:'user',content:prompt,createdAt:''}],execute);
    expect(execute).toHaveBeenCalledWith(tool,input);
  });
});
