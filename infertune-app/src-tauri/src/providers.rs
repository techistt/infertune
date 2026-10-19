//! Local AI server providers.
//!
//! Two protocol families cover essentially every local runtime:
//!
//! * `ollama`  - Ollama's native API (`/api/tags`, `/api/chat`, `/api/pull`, ...)
//! * `openai`  - the OpenAI-compatible API (`/v1/models`, `/v1/chat/completions`)
//!               spoken by llama.cpp server, LM Studio, vLLM, Jan, KoboldCpp,
//!               LocalAI, text-generation-webui and many others.

use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

pub const DEFAULT_OLLAMA_URL: &str = "http://localhost:11434";

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderConfig {
    /// "ollama" or "openai"
    pub kind: String,
    pub base_url: String,
    #[serde(default)]
    pub api_key: String,
}

impl Default for ProviderConfig {
    fn default() -> Self {
        ProviderConfig {
            kind: "ollama".to_string(),
            base_url: DEFAULT_OLLAMA_URL.to_string(),
            api_key: String::new(),
        }
    }
}

impl ProviderConfig {
    pub fn is_ollama(&self) -> bool {
        self.kind.eq_ignore_ascii_case("ollama")
    }

    /// Base URL without a trailing slash (and without a trailing `/v1` for
    /// OpenAI-compatible servers, since `/v1` is added by the endpoints).
    pub fn root(&self) -> String {
        let mut url = self.base_url.trim().trim_end_matches('/').to_string();

        if url.is_empty() {
            url = DEFAULT_OLLAMA_URL.to_string();
        }

        if !self.is_ollama() && url.ends_with("/v1") {
            let keep = url.len() - 3;
            url.truncate(keep);
        }

        url
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct ModelEntry {
    pub name: String,
    pub size: u64,
}

/// One earlier turn of a conversation.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ChatMessage {
    /// "user" or "assistant"
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone)]
pub struct GenerateParams {
    pub model: String,
    pub system_prompt: String,
    /// Earlier turns, oldest first. Empty for a single prompt.
    pub history: Vec<ChatMessage>,
    pub user_prompt: String,
    pub temperature: f32,
    pub top_p: f32,
    pub top_k: u32,
    pub max_tokens: u32,
    pub seed: u32,
    pub context_length: u32,
    /// Ollama only: how many layers to offload to the GPU (None = automatic).
    pub num_gpu: Option<i32>,
}

#[derive(Debug, Clone, Serialize)]
pub struct GenerateOutput {
    pub text: String,
    pub tokens: u32,
    /// Milliseconds spent generating.
    pub generation_time: u64,
    /// True when the caller stopped a streaming request early.
    pub cancelled: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct PullProgress {
    pub model: String,
    pub status: String,
    pub completed: u64,
    pub total: u64,
}

fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())
}

fn authed(request: reqwest::RequestBuilder, cfg: &ProviderConfig) -> reqwest::RequestBuilder {
    let key = cfg.api_key.trim();

    if key.is_empty() {
        request
    } else {
        request.bearer_auth(key)
    }
}

/// Rounds so f32 values do not serialize as 0.699999988...
fn round3(value: f32) -> f64 {
    (value as f64 * 1000.0).round() / 1000.0
}

fn messages(p: &GenerateParams) -> Vec<Value> {
    let mut list = Vec::new();

    if !p.system_prompt.trim().is_empty() {
        list.push(json!({ "role": "system", "content": p.system_prompt }));
    }

    for turn in &p.history {
        // Only user/assistant turns are accepted from the UI.
        let role = if turn.role == "assistant" { "assistant" } else { "user" };
        list.push(json!({ "role": role, "content": turn.content }));
    }

    list.push(json!({ "role": "user", "content": p.user_prompt }));
    list
}

/// Request options for Ollama's native API.
fn ollama_options(p: &GenerateParams) -> Value {
    let mut options = json!({
        "temperature": round3(p.temperature),
        "top_p": round3(p.top_p),
        "top_k": p.top_k,
        "seed": p.seed,
        "num_predict": p.max_tokens,
        "num_ctx": p.context_length
    });

    if let Some(layers) = p.num_gpu {
        options["num_gpu"] = json!(layers);
    }

    options
}

async fn error_text(response: reqwest::Response) -> String {
    let status = response.status();
    let body = response.text().await.unwrap_or_default();

    // Prefer the server's own message when it sends JSON.
    if let Ok(value) = serde_json::from_str::<Value>(&body) {
        if let Some(message) = value["error"]["message"].as_str() {
            return format!("HTTP {}: {}", status, message);
        }

        if let Some(message) = value["error"].as_str() {
            return format!("HTTP {}: {}", status, message);
        }
    }

    let snippet: String = body.chars().take(300).collect();
    format!("HTTP {}: {}", status, snippet)
}

/// True when the server answers its model-list endpoint.
pub async fn status(cfg: &ProviderConfig) -> bool {
    list_models(cfg).await.is_ok()
}

pub async fn list_models(cfg: &ProviderConfig) -> Result<Vec<ModelEntry>, String> {
    let url = if cfg.is_ollama() {
        format!("{}/api/tags", cfg.root())
    } else {
        format!("{}/v1/models", cfg.root())
    };

    let response = authed(client()?.get(&url), cfg)
        .timeout(Duration::from_secs(5))
        .send()
        .await
        .map_err(|e| format!("Cannot reach {}: {}", url, e))?;

    if !response.status().is_success() {
        return Err(format!("{} -> {}", url, error_text(response).await));
    }

    let data: Value = response
        .json()
        .await
        .map_err(|e| format!("Invalid response from {}: {}", url, e))?;

    let mut models = Vec::new();

    if cfg.is_ollama() {
        if let Some(list) = data["models"].as_array() {
            for item in list {
                if let Some(name) = item["name"].as_str() {
                    models.push(ModelEntry {
                        name: name.to_string(),
                        size: item["size"].as_u64().unwrap_or(0),
                    });
                }
            }
        }
    } else if let Some(list) = data["data"].as_array() {
        for item in list {
            if let Some(id) = item["id"].as_str() {
                models.push(ModelEntry {
                    name: id.to_string(),
                    size: 0,
                });
            }
        }
    }

    Ok(models)
}

pub async fn generate(
    cfg: &ProviderConfig,
    params: &GenerateParams,
) -> Result<GenerateOutput, String> {
    if cfg.is_ollama() {
        generate_ollama(cfg, params).await
    } else {
        generate_openai(cfg, params).await
    }
}

async fn generate_ollama(
    cfg: &ProviderConfig,
    p: &GenerateParams,
) -> Result<GenerateOutput, String> {
    let url = format!("{}/api/chat", cfg.root());

    let body = json!({
        "model": p.model,
        "stream": false,
        "messages": messages(p),
        "options": ollama_options(p)
    });

    let started = Instant::now();

    let response = authed(client()?.post(&url), cfg)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Could not connect to Ollama at {}: {}", cfg.root(), e))?;

    if !response.status().is_success() {
        return Err(format!("Ollama error ({})", error_text(response).await));
    }

    let data: Value = response
        .json()
        .await
        .map_err(|e| format!("Invalid response from Ollama: {}", e))?;

    if let Some(message) = data["error"].as_str() {
        return Err(format!("Ollama error: {}", message));
    }

    let text = data["message"]["content"]
        .as_str()
        .unwrap_or_default()
        .to_string();

    let tokens = data["eval_count"].as_u64().unwrap_or(0) as u32;

    // eval_duration is in nanoseconds.
    let generation_time = match data["eval_duration"].as_u64() {
        Some(ns) if ns > 0 => ns / 1_000_000,
        _ => started.elapsed().as_millis() as u64,
    };

    Ok(GenerateOutput {
        text,
        tokens,
        generation_time,
        cancelled: false,
    })
}

async fn generate_openai(
    cfg: &ProviderConfig,
    p: &GenerateParams,
) -> Result<GenerateOutput, String> {
    let url = format!("{}/v1/chat/completions", cfg.root());

    // top_k and seed are extensions that llama.cpp, vLLM, KoboldCpp etc.
    // accept; servers that do not know them ignore them.
    let body = json!({
        "model": p.model,
        "stream": false,
        "messages": messages(p),
        "temperature": round3(p.temperature),
        "top_p": round3(p.top_p),
        "top_k": p.top_k,
        "max_tokens": p.max_tokens,
        "seed": p.seed
    });

    let started = Instant::now();

    let response = authed(client()?.post(&url), cfg)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Could not connect to {}: {}", cfg.root(), e))?;

    if !response.status().is_success() {
        return Err(format!("Server error ({})", error_text(response).await));
    }

    let data: Value = response
        .json()
        .await
        .map_err(|e| format!("Invalid response from server: {}", e))?;

    if let Some(message) = data["error"]["message"].as_str() {
        return Err(format!("Server error: {}", message));
    }

    let text = data["choices"][0]["message"]["content"]
        .as_str()
        .or_else(|| data["choices"][0]["text"].as_str())
        .unwrap_or_default()
        .to_string();

    let tokens = data["usage"]["completion_tokens"]
        .as_u64()
        .or_else(|| data["timings"]["predicted_n"].as_u64())
        .unwrap_or_else(|| (text.chars().count() as u64 / 4).max(1)) as u32;

    // llama.cpp reports pure generation time; otherwise use wall-clock time
    // (which also includes prompt processing).
    let generation_time = match data["timings"]["predicted_ms"].as_f64() {
        Some(ms) if ms > 0.0 => ms.round() as u64,
        _ => started.elapsed().as_millis() as u64,
    };

    Ok(GenerateOutput {
        text,
        tokens,
        generation_time,
        cancelled: false,
    })
}

/// Like [`generate`], but reports text as it arrives. Setting `cancel` stops
/// the request; the text received so far is returned with `cancelled = true`.
pub async fn generate_stream<F: FnMut(&str)>(
    cfg: &ProviderConfig,
    params: &GenerateParams,
    cancel: Arc<AtomicBool>,
    mut on_chunk: F,
) -> Result<GenerateOutput, String> {
    let started = Instant::now();

    let request = if cfg.is_ollama() {
        authed(client()?.post(format!("{}/api/chat", cfg.root())), cfg).json(&json!({
            "model": params.model,
            "stream": true,
            "messages": messages(params),
            "options": ollama_options(params)
        }))
    } else {
        authed(
            client()?.post(format!("{}/v1/chat/completions", cfg.root())),
            cfg,
        )
        .json(&json!({
            "model": params.model,
            "stream": true,
            "stream_options": { "include_usage": true },
            "messages": messages(params),
            "temperature": round3(params.temperature),
            "top_p": round3(params.top_p),
            "top_k": params.top_k,
            "max_tokens": params.max_tokens,
            "seed": params.seed
        }))
    };

    let response = request
        .send()
        .await
        .map_err(|e| format!("Could not connect to {}: {}", cfg.root(), e))?;

    if !response.status().is_success() {
        let label = if cfg.is_ollama() { "Ollama error" } else { "Server error" };
        return Err(format!("{} ({})", label, error_text(response).await));
    }

    let mut stream = response.bytes_stream();
    let mut buffer = String::new();
    let mut text = String::new();
    let mut pieces: u32 = 0;
    let mut reported_tokens: Option<u32> = None;
    let mut reported_ms: Option<u64> = None;
    let mut first_piece_at: Option<Instant> = None;
    let mut cancelled = false;
    let mut finished = false;

    'outer: loop {
        // Wake up regularly so a cancel request is noticed even while the
        // server is silent (for example while it loads a model).
        let next = match tokio::time::timeout(Duration::from_millis(250), stream.next()).await {
            Ok(item) => item,
            Err(_) => {
                if cancel.load(Ordering::Relaxed) {
                    cancelled = true;
                    break;
                }
                continue;
            }
        };

        let chunk = match next {
            Some(chunk) => chunk,
            None => break,
        };

        if cancel.load(Ordering::Relaxed) {
            cancelled = true;
            break;
        }

        let chunk = chunk.map_err(|e| format!("Connection interrupted: {}", e))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(position) = buffer.find('\n') {
            let line: String = buffer.drain(..=position).collect();
            let line = line.trim();

            // Server-sent events prefix each JSON object with "data:".
            let line = line.strip_prefix("data:").map(str::trim).unwrap_or(line);

            if line.is_empty() || line.starts_with(':') {
                continue;
            }

            if line == "[DONE]" {
                finished = true;
                break 'outer;
            }

            let value: Value = match serde_json::from_str(line) {
                Ok(v) => v,
                Err(_) => continue,
            };

            if let Some(message) = value["error"].as_str() {
                return Err(format!("Server error: {}", message));
            }

            if let Some(message) = value["error"]["message"].as_str() {
                return Err(format!("Server error: {}", message));
            }

            let piece = if cfg.is_ollama() {
                value["message"]["content"].as_str().unwrap_or("")
            } else {
                value["choices"][0]["delta"]["content"]
                    .as_str()
                    .or_else(|| value["choices"][0]["text"].as_str())
                    .unwrap_or("")
            };

            if !piece.is_empty() {
                if first_piece_at.is_none() {
                    first_piece_at = Some(Instant::now());
                }

                pieces += 1;
                text.push_str(piece);
                on_chunk(piece);
            }

            if cfg.is_ollama() {
                if value["done"].as_bool().unwrap_or(false) {
                    reported_tokens = value["eval_count"].as_u64().map(|n| n as u32);
                    reported_ms = value["eval_duration"]
                        .as_u64()
                        .filter(|ns| *ns > 0)
                        .map(|ns| ns / 1_000_000);
                    finished = true;
                }
            } else {
                if let Some(n) = value["usage"]["completion_tokens"].as_u64() {
                    reported_tokens = Some(n as u32);
                }

                if let Some(ms) = value["timings"]["predicted_ms"].as_f64() {
                    if ms > 0.0 {
                        reported_ms = Some(ms.round() as u64);
                    }
                }
            }
        }

        if finished && cfg.is_ollama() {
            break;
        }
    }

    // Wall-clock fallback: time from the first token to the end.
    let measured_ms = first_piece_at
        .map(|t| t.elapsed().as_millis() as u64)
        .unwrap_or_else(|| started.elapsed().as_millis() as u64)
        .max(1);

    Ok(GenerateOutput {
        tokens: reported_tokens.unwrap_or(pieces),
        generation_time: reported_ms.unwrap_or(measured_ms),
        text,
        cancelled,
    })
}

/// Streams an Ollama model download, reporting progress as it goes.
pub async fn pull_model<F: FnMut(PullProgress)>(
    cfg: &ProviderConfig,
    model: &str,
    mut on_progress: F,
) -> Result<(), String> {
    if !cfg.is_ollama() {
        return Err("Model downloads are only supported for Ollama".to_string());
    }

    let url = format!("{}/api/pull", cfg.root());

    let response = authed(client()?.post(&url), cfg)
        .json(&json!({ "model": model, "stream": true }))
        .send()
        .await
        .map_err(|e| format!("Could not connect to Ollama at {}: {}", cfg.root(), e))?;

    if !response.status().is_success() {
        return Err(format!("Pull failed ({})", error_text(response).await));
    }

    stream_progress(response, model, "Download", on_progress).await
}

/// Reads Ollama's newline-delimited progress stream until it ends.
async fn stream_progress<F: FnMut(PullProgress)>(
    response: reqwest::Response,
    model: &str,
    what: &str,
    mut on_progress: F,
) -> Result<(), String> {
    let mut stream = response.bytes_stream();
    let mut buffer = String::new();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("{} interrupted: {}", what, e))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(position) = buffer.find('\n') {
            let line: String = buffer.drain(..=position).collect();
            let line = line.trim();

            if line.is_empty() {
                continue;
            }

            if let Ok(value) = serde_json::from_str::<Value>(line) {
                if let Some(message) = value["error"].as_str() {
                    return Err(message.to_string());
                }

                on_progress(PullProgress {
                    model: model.to_string(),
                    status: value["status"].as_str().unwrap_or("").to_string(),
                    completed: value["completed"].as_u64().unwrap_or(0),
                    total: value["total"].as_u64().unwrap_or(0),
                });
            }
        }
    }

    Ok(())
}

/// Quantization levels Ollama can create a model at.
pub const QUANTIZATIONS: [&str; 14] = [
    "q2_K", "q3_K_S", "q3_K_M", "q3_K_L", "q4_0", "q4_1", "q4_K_S", "q4_K_M", "q5_0", "q5_1",
    "q5_K_S", "q5_K_M", "q6_K", "q8_0",
];

pub fn is_valid_quantization(value: &str) -> bool {
    QUANTIZATIONS.contains(&value)
}

/// Creates `target` from `source` at a lower precision (Ollama only). The
/// source must be a 16-bit or 32-bit model.
pub async fn quantize_model<F: FnMut(PullProgress)>(
    cfg: &ProviderConfig,
    source: &str,
    target: &str,
    quantize: &str,
    on_progress: F,
) -> Result<(), String> {
    if !cfg.is_ollama() {
        return Err("Quantizing is only supported for Ollama".to_string());
    }

    if !is_valid_quantization(quantize) {
        return Err(format!("Unknown quantization level: {}", quantize));
    }

    if target.trim().is_empty() || source.trim().is_empty() {
        return Err("Source and new model names are required".to_string());
    }

    let url = format!("{}/api/create", cfg.root());

    // "name" is what older Ollama versions call "model".
    let response = authed(client()?.post(&url), cfg)
        .json(&json!({
            "model": target,
            "name": target,
            "from": source,
            "quantize": quantize,
            "stream": true
        }))
        .send()
        .await
        .map_err(|e| format!("Could not connect to Ollama at {}: {}", cfg.root(), e))?;

    if !response.status().is_success() {
        return Err(format!("Quantize failed ({})", error_text(response).await));
    }

    stream_progress(response, target, "Quantize", on_progress).await
}

pub async fn delete_model(cfg: &ProviderConfig, model: &str) -> Result<(), String> {
    if !cfg.is_ollama() {
        return Err("Removing models is only supported for Ollama".to_string());
    }

    let url = format!("{}/api/delete", cfg.root());

    let response = authed(client()?.delete(&url), cfg)
        .json(&json!({ "model": model }))
        .timeout(Duration::from_secs(30))
        .send()
        .await
        .map_err(|e| format!("Could not connect to Ollama at {}: {}", cfg.root(), e))?;

    if response.status().is_success() {
        Ok(())
    } else {
        Err(format!("Delete failed ({})", error_text(response).await))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn root_strips_slash_and_v1() {
        let mut cfg = ProviderConfig::default();
        cfg.kind = "openai".into();
        cfg.base_url = " http://localhost:1234/v1/ ".into();
        assert_eq!(cfg.root(), "http://localhost:1234");

        cfg.kind = "ollama".into();
        cfg.base_url = "http://localhost:11434/".into();
        assert_eq!(cfg.root(), "http://localhost:11434");

        cfg.base_url = "".into();
        assert_eq!(cfg.root(), DEFAULT_OLLAMA_URL);
    }

    #[test]
    fn quantization_names_are_checked() {
        assert!(is_valid_quantization("q4_K_M"));
        assert!(is_valid_quantization("q8_0"));
        assert!(!is_valid_quantization("q4_k_m"));
        assert!(!is_valid_quantization("fp8; rm"));
    }

    #[test]
    fn round3_has_no_float_noise() {
        assert_eq!(round3(0.7), 0.7);
        assert_eq!(round3(0.9), 0.9);
    }
}
