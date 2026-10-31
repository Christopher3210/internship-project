import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AiChatMessage } from './ai-chat-session.entity.js';
import type { AiProviderName } from './dto/create-chat-session.dto.js';

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
  constructor(private readonly config: ConfigService) {}

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

  async generateReply(provider: AiProviderName, messages: AiChatMessage[]) {
    const providerConfig = this.getProviders().find((item) => item.id === provider);
    if (!providerConfig) throw new ServiceUnavailableException('AI provider is not supported');

    const latest = messages[messages.length - 1];
    if (provider === 'mock') {
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

    const apiMessages = messages.map((message) => {
      const attachmentText = message.attachments?.map((file) => file.textContent ? `\n\n[Attachment: ${file.name}]\n${file.textContent}` : `[Attachment: ${file.name}; content is not available to the model]`).join('') ?? '';
      return { role: message.role, content: `${message.content}${attachmentText}` };
    });
    const endpoint = providerConfig.baseUrl.replace(/\/$/, '').endsWith('/chat/completions')
      ? providerConfig.baseUrl
      : `${providerConfig.baseUrl.replace(/\/$/, '')}/chat/completions`;

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(providerConfig.apiKey ? { Authorization: `Bearer ${providerConfig.apiKey}` } : {}),
        },
        body: JSON.stringify({ model: providerConfig.model, messages: apiMessages, stream: false }),
        signal: AbortSignal.timeout(60_000),
      });
    } catch {
      throw new BadGatewayException('Could not connect to the configured AI provider');
    }
    if (!response.ok) throw new BadGatewayException(`AI provider returned HTTP ${response.status}`);

    const result = await response.json() as { choices?: Array<{ message?: { content?: string | null } }> };
    const content = result.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) throw new BadGatewayException('AI provider returned an empty response');
    return { content, model: providerConfig.model };
  }
}
