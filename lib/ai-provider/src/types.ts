export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatCompleteOptions {
  messages: ChatMessage[];
  model?: string;
  maxTokens?: number;
  jsonMode?: boolean;
}

export interface ChatUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface ChatCompleteResult {
  text: string;
  usage: ChatUsage;
  model: string;
}

export interface ChatProvider {
  name: "replit" | "openai" | "openrouter";
  defaultModel: string;
  chatComplete(opts: ChatCompleteOptions): Promise<ChatCompleteResult>;
}

export interface EmbedOptions {
  input: string | string[];
  model?: string;
}

export interface EmbedUsage {
  promptTokens?: number;
  totalTokens?: number;
}

export interface EmbedResult {
  embeddings: number[][];
  usage: EmbedUsage;
  model: string;
  dimensions: number;
}

export interface EmbeddingProvider {
  name: "openai" | "voyage";
  defaultModel: string;
  defaultDimensions: number;
  embed(opts: EmbedOptions): Promise<EmbedResult>;
}
