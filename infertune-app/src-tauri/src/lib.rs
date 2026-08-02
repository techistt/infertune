// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use serde::{Deserialize, Serialize};

use sysinfo::{CpuExt, System, SystemExt};

#[derive(Serialize)]
struct SystemStats {
    cpu_usage: f32,
    ram_usage: f32,
}

#[derive(Serialize)]
struct OllamaRequest {
    model: String,
    prompt: String,
    stream: bool,
    options: OllamaOptions,
}

#[derive(Serialize)]
struct OllamaOptions {
    temperature: f32,
    top_p: f32,
    top_k: u32,
    seed: u32,
    num_predict: u32,
}

#[derive(Deserialize)]
struct OllamaResponse {
    response: String,
    eval_count: Option<u32>,
    eval_duration: Option<u64>,
}

#[derive(Serialize)]
struct GenerateResponse {
    text: String,
    tokens: u32,
    generation_time: u64,
}

#[derive(Deserialize)]
struct OllamaTags {
    models: Vec<OllamaModel>,
}

#[derive(Deserialize)]
struct OllamaModel {
    name: String,
}

#[tauri::command]
fn get_system_stats() -> SystemStats {
    let mut system = System::new_all();

    system.refresh_all();

    let cpu = system.global_cpu_info().cpu_usage();

    let total = system.total_memory();

    let used = system.used_memory();

    let ram = (used as f32 / total as f32) * 100.0;

    SystemStats {
        cpu_usage: cpu,
        ram_usage: ram,
    }
}

#[tauri::command]
async fn get_models() -> Vec<String> {
    let response = reqwest::get("http://localhost:11434/api/tags")
        .await
        .expect("Failed to connect to Ollama");

    let data: OllamaTags = response.json().await.expect("Invalid Ollama response");

    data.models.into_iter().map(|m| m.name).collect()
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn generate_text(
    model: String,
    system_prompt: String,
    user_prompt: String,
    temperature: f32,
    top_p: f32,
    top_k: u32,
    max_tokens: u32,
    seed: u32,
) -> GenerateResponse {
    let prompt = format!("System:\n{}\n\nUser:\n{}", system_prompt, user_prompt);

    let request = OllamaRequest {
        model,
        prompt,
        stream: false,

        options: OllamaOptions {
            temperature,
            top_p,
            top_k,
            seed,
            num_predict: max_tokens,
        },
    };

    let client = reqwest::Client::new();

    let response = client
        .post("http://localhost:11434/api/generate")
        .json(&request)
        .send()
        .await
        .expect("Failed to connect to Ollama");

    let body = response
        .text()
        .await
        .expect("Failed reading Ollama response");

    println!("OLLAMA RAW RESPONSE:");
    println!("{}", body);

    let result: OllamaResponse = match serde_json::from_str(&body) {
        Ok(value) => value,

        Err(_) => {
            return GenerateResponse {
                text: format!("Ollama Error: {}", body),
                tokens: 0,
                generation_time: 0,
            };
        }
    };

    GenerateResponse {
        text: result.response,
        tokens: result.eval_count.unwrap_or(0),
        generation_time: result.eval_duration.unwrap_or(0) / 1_000_000,
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            generate_text,
            get_models,
            get_system_stats
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
