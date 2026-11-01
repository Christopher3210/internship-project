import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AiChatMessage } from './ai-chat-session.entity.js';
import type { AiProviderName } from './dto/create-chat-session.dto.js';
import { AiAgentToolsService } from './ai-agent-tools.service.js';

type ToolExecutor = (name: string, args: Record<string, unknown>) => Promise<unknown>;
type ModelToolCall = { id: string; type: 'function'; function: { name: string; arguments: string } };

type ProviderConfig = {
  id: AiProviderName;
  label: string;
  model: string;
  baseUrl: string;
  apiKey?: string;
  configured: boolean;
};

const providerSettings: Record<Exclude<AiProviderName, 'mock'>, { label: string; defaultModel: string; defaultBaseUrl?: string; keyName?: string; modelName?: string; baseUrlName?: string }> = {
  deepseek: { label: 'DeepSeek', defaultModel: 'deepseek-chat', defaultBaseUrl: 'https://api.deepseek.com/v1', keyName: 'DEEPSEEK_API_KEY', modelName: 'DEEPSEEK_MODEL', baseUrlName: 'DEEPSEEK_BASE_URL' },
  qwen: { label: 'Qwen', defaultModel: 'qwen-plus', defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', keyName: 'QWEN_API_KEY', modelName: 'QWEN_MODEL', baseUrlName: 'QWEN_BASE_URL' },
  openai: { label: 'OpenAI', defaultModel: 'gpt-4o-mini', defaultBaseUrl: 'https://api.openai.com/v1', keyName: 'OPENAI_API_KEY', modelName: 'OPENAI_MODEL', baseUrlName: 'OPENAI_BASE_URL' },
  kimi: { label: 'Kimi', defaultModel: 'moonshot-v1-8k', defaultBaseUrl: 'https://api.moonshot.cn/v1', keyName: 'KIMI_API_KEY', modelName: 'KIMI_MODEL', baseUrlName: 'KIMI_BASE_URL' },
  local: { label: 'Local OpenAI-compatible', defaultModel: 'local-model', keyName: 'LOCAL_LLM_API_KEY', modelName: 'LOCAL_LLM_MODEL', baseUrlName: 'LOCAL_LLM_BASE_URL' },
};

@Injectable()
export class AiModelService {
  constructor(
    private readonly config: ConfigService,
    private readonly tools: AiAgentToolsService,
  ) {}

  getDefaultProvider(): AiProviderName {
    const requested = this.config.get<string>('AI_PROVIDER') ?? 'mock';
    return requested in providerSettings || requested === 'mock' ? requested as AiProviderName : 'mock';
  }

  getProviders() {
    const mock: ProviderConfig = { id: 'mock', label: 'Local demo (no API key)', model: 'mock-chat', baseUrl: '', configured: true };
    return [mock, ...Object.entries(providerSettings).map(([id, settings]) => {
      const apiKey = settings.keyName ? this.config.get<string>(settings.keyName) : undefined;
      const baseUrl = settings.baseUrlName ? this.config.get<string>(settings.baseUrlName) ?? settings.defaultBaseUrl ?? '' : '';
      const model = settings.modelName ? this.config.get<string>(settings.modelName) ?? settings.defaultModel : settings.defaultModel;
      return {
        id: id as AiProviderName,
        label: settings.label,
        model,
        baseUrl,
        apiKey,
        configured: id === 'local' ? Boolean(baseUrl && model) : Boolean(apiKey && baseUrl && model),
      };
    })];
  }

  getProviderInfo(provider: AiProviderName) {
    const config = this.getProviders().find((item) => item.id === provider);
    if (!config) throw new ServiceUnavailableException('AI provider is not supported');
    return { id: config.id, label: config.label, model: config.model, configured: config.configured };
  }

  async generateReply(provider: AiProviderName, messages: AiChatMessage[], toolExecutor?: ToolExecutor) {
    const providerConfig = this.getProviders().find((item) => item.id === provider);
    if (!providerConfig) throw new ServiceUnavailableException('AI provider is not supported');

    const latest = messages[messages.length - 1];
    if (provider === 'mock') {
      if (toolExecutor && /公司|company/i.test(latest.content) && /多少|数量|总数|count|how many/i.test(latest.content)) {
        const summary = await toolExecutor('get_company_summary', {}) as { companyCount: number; totalRevenue: number; countryCount: number; employeeCount: number };
        return {
          content: `我调用了项目的公司统计工具，当前有 ${summary.companyCount.toLocaleString()} 家公司，覆盖 ${summary.countryCount.toLocaleString()} 个国家/地区，共有 ${summary.employeeCount.toLocaleString()} 名员工。`,
          model: providerConfig.model,
        };
      }
      if (toolExecutor && /公司|company|供应商|supplier/i.test(latest.content) && /查询|查找|搜索|找一下|search|find/i.test(latest.content)) {
        const levelMatch = latest.content.match(/(?:level|等级|层级|L)\s*[:：]?\s*([1-4])|第\s*([1-4])\s*级/i);
        const quotedName = latest.content.match(/["“'‘]([^"”'’]+)["”'’]/)?.[1];
        const extractedName = latest.content
          .replace(/(?:level|等级|层级|L)\s*[:：]?\s*[1-4]|第\s*[1-4]\s*级/gi, ' ')
          .replace(/请|帮我|查询|查找|搜索|找一下|查一下|搜一下|一下|公司名称|公司名|公司信息|公司资料|公司数据|公司|供应商|有哪些|所有|全部|的|search|find|company|companies|supplier/gi, ' ')
          .replace(/[？！?。，,.：:]/g, ' ')
          .trim();
        const name = quotedName?.trim() || (levelMatch ? '' : extractedName);
        const level = Number(levelMatch?.[1] ?? levelMatch?.[2]);
        const result = await toolExecutor('search_companies', {
          ...(name ? { name } : {}),
          ...(levelMatch ? { level } : {}),
          limit: 5,
        }) as { total: number; items: Array<{ companyName: string; companyCode: string; level: number; country: string; city: string }> };
        const rows = result.items.map((item) => `${item.companyName}（${item.companyCode}），Level ${item.level}，${item.country} ${item.city}`).join('\n');
        return {
          content: `我调用了公司搜索工具，共找到 ${result.total} 家，展示 ${result.items.length} 条：\n${rows || '没有匹配结果。'}`,
          model: providerConfig.model,
        };
      }
      const attachmentNote = latest.attachments?.length ? `（收到附件：${latest.attachments.map((file) => file.name).join('、')}）` : '';
      const text = latest.attachments?.map((file) => file.textContent).filter(Boolean).join('\n\n') ?? '';
      const answer = text
        ? `我收到了你的文本附件${attachmentNote}。\n\n文件内容摘要预览：\n${text.slice(0, 800)}${text.length > 800 ? '\n\n（演示模式只展示前 800 个字符）' : ''}`
        : `收到：${latest.content || '你发来的附件'}${attachmentNote}。\n\n当前使用本地演示模式，尚未调用外部大模型。配置 DeepSeek、Qwen、OpenAI、Kimi 或本地 OpenAI-compatible 服务后，就可以切换为真实模型回复。`;
      return { content: answer, model: providerConfig.model };
    }

    if (!providerConfig.configured) {
      throw new ServiceUnavailableException(`${providerConfig.label} is not configured; set its API key and base URL in the backend environment`);
    }

    const apiMessages: Array<Record<string, unknown>> = [{
      role: 'system',
      content: '你是供应链管理系统的 AI 助手。回答当前公司的数量、收入、国家覆盖或员工统计时，必须调用 get_company_summary；用户查询具体公司或供应商等级时，必须调用 search_companies。只使用提供的只读工具，不要猜测或编造数据库事实。',
    }, ...messages.map((message) => {
      const attachmentText = message.attachments?.map((file) => file.textContent ? `\n\n[Attachment: ${file.name}]\n${file.textContent}` : `[Attachment: ${file.name}; content is not available to the model]`).join('') ?? '';
      return { role: message.role, content: `${message.content}${attachmentText}` };
    })];
    const endpoint = providerConfig.baseUrl.replace(/\/$/, '').endsWith('/chat/completions')
      ? providerConfig.baseUrl
      : `${providerConfig.baseUrl.replace(/\/$/, '')}/chat/completions`;

    const runTool = toolExecutor ?? ((name: string) => this.tools.execute(name));
    const toolDefinitions = this.tools.getDefinitions();

    for (let round = 0; round < 3; round += 1) {
      let response: Response;
      try {
        response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(providerConfig.apiKey ? { Authorization: `Bearer ${providerConfig.apiKey}` } : {}),
          },
          body: JSON.stringify({
            model: providerConfig.model,
            messages: apiMessages,
            stream: false,
            tools: toolDefinitions,
            tool_choice: 'auto',
          }),
          signal: AbortSignal.timeout(60_000),
        });
      } catch {
        throw new BadGatewayException('Could not connect to the configured AI provider');
      }
      if (!response.ok) throw new BadGatewayException(`AI provider returned HTTP ${response.status}`);

      const result = await response.json() as { choices?: Array<{ message?: { content?: string | null; tool_calls?: ModelToolCall[] } }> };
      const message = result.choices?.[0]?.message;
      const toolCalls = message?.tool_calls ?? [];
      if (!toolCalls.length) {
        const content = message?.content;
        if (typeof content !== 'string' || !content.trim()) throw new BadGatewayException('AI provider returned an empty response');
        return { content, model: providerConfig.model };
      }

      if (round === 2) throw new BadGatewayException('AI provider exceeded the tool-call limit');
      apiMessages.push({ role: 'assistant', content: message?.content ?? null, tool_calls: toolCalls });
      for (const call of toolCalls) {
        let args: Record<string, unknown> = {};
        try {
          const parsed = JSON.parse(call.function.arguments || '{}') as unknown;
          if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) args = parsed as Record<string, unknown>;
        } catch {
          apiMessages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify({ error: 'Tool arguments must be valid JSON' }) });
          continue;
        }
        try {
          const toolResult = await runTool(call.function.name, args);
          apiMessages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(toolResult) });
        } catch {
          apiMessages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify({ error: 'The requested project tool could not be completed' }) });
        }
      }
    }
    throw new BadGatewayException('AI provider did not return a final response');
  }
}
