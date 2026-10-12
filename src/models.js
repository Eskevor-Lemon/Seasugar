// Free-tier availability verified against the linked official pages on 2026-10-12.
export const modelPresets = {
  gemini: {
    label: 'Gemini 3.5 Flash-Lite · 免费额度',
    base: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-3.5-flash-lite',
    keyURL: 'https://aistudio.google.com/apikey',
    docsURL: 'https://ai.google.dev/gemini-api/docs/pricing',
    note: '使用 Google AI Studio 的 API Key。请确认项目处于免费层；已开通计费的项目可能收费。额度与支持地区以 Google 为准，免费层内容可能用于改进产品。',
  },
  gemma: {
    label: 'Gemma 4 31B · OpenRouter 免费版',
    base: 'https://openrouter.ai/api/v1',
    model: 'google/gemma-4-31b-it:free',
    keyURL: 'https://openrouter.ai/settings/keys',
    docsURL: 'https://openrouter.ai/google/gemma-4-31b-it:free',
    note: '使用 OpenRouter 的 API Key。固定调用 :free 免费端点，受每日额度、限流及提供商可用性限制。不会自动切换到付费端点。',
  },
};
