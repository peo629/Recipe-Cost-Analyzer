import type { ChatProvider } from "../types.js";
import { createOpenAICompatibleProvider } from "./openai-compatible.js";

export function createOpenAIChatProvider(): ChatProvider {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("AI_PROVIDER=openai requires OPENAI_API_KEY.");
  }
  return createOpenAICompatibleProvider("openai", "gpt-5.4", { apiKey });
}
