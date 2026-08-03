// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use serde::{Deserialize, Serialize};

use std::sync::Mutex;
use sysinfo::System;

use nvml_wrapper::Nvml;

use windows::Win32::Graphics::Dxgi::{CreateDXGIFactory1, IDXGIFactory1};

#[derive(Serialize)]
struct SystemStats {
    cpu_usage: f32,
    ram_used: u64,
    ram_total: u64,
}

struct AppState {
    system: Mutex<System>,
}

#[derive(Serialize)]
struct GpuInfo {
    name: String,
    vendor: String,
}

#[derive(Serialize)]
struct GpuStats {
    id: u32,
    name: String,
    vendor: String,
    usage: u32,
    memory_used: u64,
    memory_total: u64,
    temperature: u32,
}

#[derive(Serialize)]
struct GpuInfoList {
    gpus: Vec<GpuStats>,
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

fn detect_gpu_vendor(name: &str) -> String {
    let gpu_name = name.to_lowercase();

    if gpu_name.contains("nvidia") {
        "NVIDIA".to_string()
    } else if gpu_name.contains("amd") || gpu_name.contains("radeon") {
        "AMD".to_string()
    } else if gpu_name.contains("intel") {
        "Intel".to_string()
    } else {
        "Unknown".to_string()
    }
}

fn get_gpu_info_internal() -> GpuInfo {
    unsafe {
        let factory = match CreateDXGIFactory1::<IDXGIFactory1>() {
            Ok(factory) => factory,

            Err(_) => {
                return GpuInfo {
                    name: "GPU Detection Failed".to_string(),
                    vendor: "Unknown".to_string(),
                };
            }
        };

        let mut index = 0;

        loop {
            let adapter = factory.EnumAdapters1(index);

            if adapter.is_err() {
                break;
            }

            let adapter = adapter.unwrap();

            let desc = match adapter.GetDesc1() {
                Ok(desc) => desc,

                Err(_) => {
                    index += 1;
                    continue;
                }
            };

            let name = String::from_utf16_lossy(&desc.Description);

            let vendor = detect_gpu_vendor(&name);

            return GpuInfo { name, vendor };
        }
    }

    GpuInfo {
        name: "No GPU Found".to_string(),

        vendor: "Unknown".to_string(),
    }
}

#[tauri::command]
fn get_all_gpus() -> Vec<GpuStats> {
    let mut gpus = Vec::new();

    unsafe {
        let factory = match CreateDXGIFactory1::<IDXGIFactory1>() {
            Ok(factory) => factory,

            Err(_) => {
                return gpus;
            }
        };

        let mut index = 0;

        loop {
            let adapter = factory.EnumAdapters1(index);

            if adapter.is_err() {
                break;
            }

            let adapter = adapter.unwrap();

            let desc = match adapter.GetDesc1() {
                Ok(desc) => desc,

                Err(_) => {
                    index += 1;
                    continue;
                }
            };

            let name = String::from_utf16_lossy(&desc.Description);

            let vendor = detect_gpu_vendor(&name);

            gpus.push(GpuStats {
                id: index,

                name,

                vendor,

                usage: 0,

                memory_used: 0,

                memory_total: 0,

                temperature: 0,
            });

            index += 1;
        }
    }

    gpus
}

#[tauri::command]
fn get_gpu_info() -> GpuInfo {
    get_gpu_info_internal()
}

#[tauri::command]
fn get_system_stats(state: tauri::State<AppState>) -> SystemStats {
    let mut system = state.system.lock().unwrap();

    system.refresh_cpu_usage();
    system.refresh_memory();

    SystemStats {
        cpu_usage: system.global_cpu_usage(),
        ram_used: system.used_memory(),
        ram_total: system.total_memory(),
    }
}

fn empty_gpu_stats(name: String, vendor: String) -> GpuStats {
    GpuStats {
        id: 0,
        name,
        vendor,
        usage: 0,
        memory_used: 0,
        memory_total: 0,
        temperature: 0,
    }
}

#[tauri::command]
fn get_gpu_stats(id: u32) -> Result<GpuStats, String> {
    let gpu_info = get_gpu_info_internal();

    let detected_name = gpu_info.name.clone();

    let detected_vendor = gpu_info.vendor.clone();

    if detected_vendor != "NVIDIA" {
        return Ok(empty_gpu_stats(detected_name, detected_vendor));
    }

    let nvml = match Nvml::init() {
        Ok(nvml) => nvml,

        Err(_) => {
            return Ok(GpuStats {
                id: 0,

                name: "GPU Not Supported".to_string(),

                vendor: "Unknown".to_string(),

                usage: 0,

                memory_used: 0,

                memory_total: 0,

                temperature: 0,
            });
        }
    };

    let gpu = match nvml.device_by_index(id) {
        Ok(device) => device,

        Err(_) => {
            return Ok(GpuStats {
                id: 0,

                name: "GPU Not Detected".to_string(),

                vendor: "Unknown".to_string(),

                usage: 0,

                memory_used: 0,

                memory_total: 0,

                temperature: 0,
            });
        }
    };

    let gpu_info = get_gpu_info_internal();

    let name = gpu_info.name;

    let vendor = gpu_info.vendor;

    let utilization = match gpu.utilization_rates() {
        Ok(value) => value,

        Err(_) => {
            return Ok(GpuStats {
                id: 0,
                name,
                vendor: vendor.clone(),
                usage: 0,
                memory_used: 0,
                memory_total: 0,
                temperature: 0,
            });
        }
    };

    let memory = match gpu.memory_info() {
        Ok(value) => value,

        Err(_) => {
            return Ok(GpuStats {
                id: 0,
                name,
                vendor: vendor.clone(),
                usage: utilization.gpu,
                memory_used: 0,
                memory_total: 0,
                temperature: 0,
            });
        }
    };

    let temperature = gpu
        .temperature(nvml_wrapper::enum_wrappers::device::TemperatureSensor::Gpu)
        .unwrap_or(0);

    Ok(GpuStats {
        id: 0,

        name,

        vendor,

        usage: utilization.gpu,

        memory_used: memory.used,

        memory_total: memory.total,

        temperature,
    })
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

#[tauri::command]
async fn check_ollama_status() -> bool {
    let response = reqwest::get("http://localhost:11434/api/tags").await;

    response.is_ok()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState {
            system: Mutex::new(System::new_all()),
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            generate_text,
            get_models,
            get_system_stats,
            get_gpu_stats,
            check_ollama_status,
            get_gpu_info,
            get_all_gpus
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
