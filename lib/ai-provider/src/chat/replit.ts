import type { ChatProvider } from "../types.js";
import { createOpenAICompatibleProvider } from "./openai-compatible.js";

export function createReplitChatProvider(): ChatProvider {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  if (!apiKey || !baseURL) {
    throw new Error(
      "AI_PROVIDER=replit requires AI_INTEGRATIONS_OPENAI_API_KEY and AI_INTEGRATIONS_OPENAI_BASE_URL (provisioned automatically by the Replit AI integration).",
    );
  }
  return createOpenAICompatibleProvider("replit", "gpt-5.4", {
    apiKey,
    baseURL,
  });
}
