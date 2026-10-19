export type ProviderKind = "ollama" | "openai";

/** What the Rust backend needs to talk to a server. */
export interface ProviderConfig {
  kind: ProviderKind;
  baseUrl: string;
  apiKey: string;
}

/** A saved server the user can switch between. */
export interface ProviderProfile extends ProviderConfig {
  id: string;
  name: string;
  preset: string;
}

export interface ProviderPreset {
  id: string;
  name: string;
  kind: ProviderKind;
  baseUrl: string;
  note: string;
}

/**
 * Every server that speaks the OpenAI-compatible API works as "openai".
 * Ollama also has its own native API, which adds model download/removal and
 * precise memory estimates.
 */
export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: "ollama",
    name: "Ollama",
    kind: "ollama",
    baseUrl: "http://localhost:11434",
    note: "Native API. Supports downloading and removing models.",
  },
  {
    id: "lmstudio",
    name: "LM Studio",
    kind: "openai",
    baseUrl: "http://localhost:1234",
    note: "Start the local server from LM Studio's Developer tab.",
  },
  {
    id: "llamacpp",
    name: "llama.cpp server",
    kind: "openai",
    baseUrl: "http://localhost:8080",
    note: "Run: llama-server -m your-model.gguf",
  },
  {
    id: "vllm",
    name: "vLLM",
    kind: "openai",
    baseUrl: "http://localhost:8000",
    note: "Run: vllm serve your-model",
  },
  {
    id: "jan",
    name: "Jan",
    kind: "openai",
    baseUrl: "http://localhost:1337",
    note: "Turn on the local API server in Jan's settings.",
  },
  {
    id: "koboldcpp",
    name: "KoboldCpp",
    kind: "openai",
    baseUrl: "http://localhost:5001",
    note: "Serves an OpenAI-compatible API on port 5001 by default.",
  },
  {
    id: "localai",
    name: "LocalAI",
    kind: "openai",
    baseUrl: "http://localhost:8081",
    note: "Default port is 8080; change it if llama.cpp uses that port.",
  },
  {
    id: "textgen",
    name: "text-generation-webui",
    kind: "openai",
    baseUrl: "http://localhost:5000",
    note: "Start it with the --api flag.",
  },
  {
    id: "custom",
    name: "Custom (OpenAI-compatible)",
    kind: "openai",
    baseUrl: "http://localhost:8000",
    note: "Any server that exposes /v1/chat/completions.",
  },
];

export function toConfig(profile: ProviderProfile): ProviderConfig {
  return {
    kind: profile.kind,
    baseUrl: profile.baseUrl,
    apiKey: profile.apiKey,
  };
}
