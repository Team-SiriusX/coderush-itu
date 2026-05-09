import { ChatOpenAI } from '@langchain/openai'
import 'dotenv/config'

const fleetLLM = new ChatOpenAI({
  modelName: 'google/gemini-2.5-flash',
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

async function test() {
  console.log("Calling OpenRouter...")
  try {
    const stream = await fleetLLM.stream("Hello, testing stream!")
    for await (const chunk of stream) {
      process.stdout.write(chunk.content.toString())
    }
    console.log("\nDone!")
  } catch (err) {
    console.error("Error:", err)
  }
}

test()
