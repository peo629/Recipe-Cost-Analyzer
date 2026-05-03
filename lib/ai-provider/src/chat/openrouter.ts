import type { ChatProvider } from "../types.js";
import { createOpenAICompatibleProvider } from "./openai-compatible.js";

export function createOpenRouterChatProvider(): ChatProvider {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("AI_PROVIDER=openrouter requires OPENROUTER_API_KEY.");
  }
  return createOpenAICompatibleProvider(
    "openrouter",
    process.env.OPENROUTER_DEFAULT_MODEL ?? "openai/gpt-4o-mini",
    { apiKey, baseURL: "https://openrouter.ai/api/v1" },
  );
}
