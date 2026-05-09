import { ChatOpenAI } from '@langchain/openai'

export const fleetLLM = new ChatOpenAI({
  modelName: 'mistralai/mistral-7b-instruct',
  temperature: 0.3,
  maxTokens: 800,
  streaming: true,
  configuration: {
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPEN_ROUTER_API_KEY ?? '',
    defaultHeaders: {
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
      'X-Title': 'HORMUZ Fleet Command',
    },
  },
})
