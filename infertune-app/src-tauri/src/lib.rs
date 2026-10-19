use serde::{Deserialize, Serialize};

use std::process::Command;
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use sysinfo::System;

use nvml_wrapper::Nvml;

use std::os::windows::process::CommandExt;
use windows::Win32::Graphics::Dxgi::{
    CreateDXGIFactory1, IDXGIFactory1, DXGI_ADAPTER_DESC1, DXGI_ADAPTER_FLAG_SOFTWARE,
};

/// Prevents a console window from flashing when spawning helper processes.
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// DXGI descriptions are fixed-size, NUL-padded UTF-16 buffers.
fn adapter_name(desc: &DXGI_ADAPTER_DESC1) -> String {
    let end = desc
        .Description
        .iter()
        .position(|&c| c == 0)
        .unwrap_or(desc.Description.len());
    String::from_utf16_lossy(&desc.Description[..end])
}

fn is_software_adapter(desc: &DXGI_ADAPTER_DESC1) -> bool {
    (desc.Flags & DXGI_ADAPTER_FLAG_SOFTWARE.0 as u32) != 0
}

/// Prefer the PCI vendor id; fall back to the name.
fn vendor_from_desc(desc: &DXGI_ADAPTER_DESC1, name: &str) -> String {
    match desc.VendorId {
        0x10DE => "NVIDIA".to_string(),
        0x1002 | 0x1022 => "AMD".to_string(),
        0x8086 => "Intel".to_string(),
        _ => detect_gpu_vendor(name),
    }
}

/// Finds the NVML device that matches a DXGI adapter name.
/// DXGI and NVML enumerate in different orders, so indexes cannot be shared.
fn find_nvml_device<'a>(nvml: &'a Nvml, name: &str) -> Option<nvml_wrapper::Device<'a>> {
    let count = nvml.device_count().ok()?;
    let mut first = None;

    for i in 0..count {
        if let Ok(device) = nvml.device_by_index(i) {
            if let Ok(nvml_name) = device.name() {
                if nvml_name.trim().eq_ignore_ascii_case(name.trim()) {
                    return Some(device);
                }
            }
            if first.is_none() {
                first = Some(device);
            }
        }
    }

    first
}

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
    /// (high, low) parts of the adapter LUID; used to match Windows perf counters.
    #[serde(skip_serializing)]
    luid: (u32, u32),
}

#[derive(Serialize)]
struct GpuStats {
    id: u32,
    name: String,
    vendor: String,
    backend: String,
    usage: u32,
    memory_used: u64,
    memory_total: u64,
    temperature: u32,
}

#[derive(Serialize)]
struct GpuRecommendation {
    recommended_gpu: u32,
    gpu_name: String,
    vendor: String,
    backend: String,
    vram_total: u64,
    vram_used: u64,
    score: u32,
    reason: String,
}

#[derive(Serialize)]
struct ModelRecommendation {
    recommended_model: String,
    category: String,
    size_gb: f32,
    reason: String,
    score: u32,
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
    num_ctx: u32,
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

#[derive(Deserialize, Serialize)]
struct OllamaModel {
    name: String,
    size: u64,
}

#[derive(Debug, Serialize, Clone)]
struct ScoredModel {
    name: String,
    family: String,
    purpose: String,
    parameters: Option<f32>,
    quantization: Option<String>,
    size_gb: f32,
    estimated_vram_gb: f32,
    estimated_ram_gb: f32,
    score: u32,
    breakdown: Vec<String>,
}

#[derive(Debug, Serialize, Clone)]
struct ModelRanking {
    name: String,
    family: String,
    purpose: String,
    size_gb: f32,
    score: u32,
    reasons: Vec<String>,
}

#[derive(Debug, Clone)]
struct ParsedModel {
    name: String,
    family: String,
    purpose: String,
    parameters: Option<f32>,
    quantization: Option<String>,
    size_gb: f32,
    estimated_vram_gb: f32,
    estimated_ram_gb: f32,
}

#[derive(Debug, Clone)]
pub enum TaskType {
    Chat,
    Coding,
    Reasoning,
    Fast,
    General,
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

fn detect_gpu_backend(vendor: &str) -> String {
    match vendor {
        "NVIDIA" => "NVML".to_string(),

        "AMD" => "ROCm".to_string(),

        "Intel" => "Intel GPU API".to_string(),

        _ => "Unknown".to_string(),
    }
}

fn get_amd_gpu_stats(name: String) -> Option<GpuStats> {
    let output = Command::new("rocm-smi")
        .creation_flags(CREATE_NO_WINDOW)
        .args([
            "--showuse",
            "--showmeminfo",
            "vram",
            "--showtemp",
            "--showproductname",
        ])
        .output()
        .ok()?;

    let text = String::from_utf8_lossy(&output.stdout);

    let mut usage = 0;
    let mut temperature = 0;
    let mut memory_used = 0;
    let mut memory_total = 0;

    for line in text.lines() {
        if line.contains("GPU use") {
            if let Some(value) = line.split_whitespace().find(|x| x.parse::<u32>().is_ok()) {
                usage = value.parse().unwrap_or(0);
            }
        }

        if line.contains("Temperature") {
            if let Some(value) = line.split_whitespace().find(|x| x.parse::<u32>().is_ok()) {
                temperature = value.parse().unwrap_or(0);
            }
        }

        if line.contains("Total Memory") {
            if let Some(value) = line.split_whitespace().find(|x| x.parse::<u64>().is_ok()) {
                memory_total = value.parse().unwrap_or(0) * 1024 * 1024;
            }
        }

        if line.contains("Used Memory") {
            if let Some(value) = line.split_whitespace().find(|x| x.parse::<u64>().is_ok()) {
                memory_used = value.parse().unwrap_or(0) * 1024 * 1024;
            }
        }
    }

    Some(GpuStats {
        id: 0,

        name,

        vendor: "AMD".to_string(),

        backend: "ROCm".to_string(),

        usage,

        memory_used,

        memory_total,

        temperature,
    })
}

fn get_intel_gpu_stats(name: String, luid: (u32, u32)) -> Option<GpuStats> {
    let output = Command::new("powershell")
        .creation_flags(CREATE_NO_WINDOW)
        .args([
            "-NoProfile",
            "-Command",
            "Get-Counter '\\GPU Engine(*)\\Utilization Percentage' | Select -Expand CounterSamples | ForEach-Object { \"$($_.Path)|$($_.CookedValue)\" }",
        ])
        .output()
        .ok()?;

    let text = String::from_utf8_lossy(&output.stdout);

    // Counter instances look like: pid_123_luid_0x00000000_0x0000abcd_phys_0_eng_0_engtype_3d
    let wanted = format!("luid_0x{:08x}_0x{:08x}", luid.0, luid.1);

    // Like Task Manager: sum load per engine type across processes,
    // then report the busiest engine type.
    let mut per_engine: HashMap<String, f32> = HashMap::new();

    for line in text.lines() {
        let Some((path, value)) = line.rsplit_once('|') else {
            continue;
        };

        let path = path.to_lowercase();

        if !path.contains(&wanted) {
            continue;
        }

        let Ok(value) = value.trim().replace(',', ".").parse::<f32>() else {
            continue;
        };

        let engine = path
            .split("engtype_")
            .nth(1)
            .and_then(|rest| rest.split(')').next())
            .unwrap_or("unknown")
            .to_string();

        *per_engine.entry(engine).or_insert(0.0) += value;
    }

    let usage = per_engine
        .values()
        .cloned()
        .fold(0.0_f32, f32::max)
        .min(100.0) as u32;

    Some(GpuStats {
        id: 0,
        name,
        vendor: "Intel".to_string(),
        backend: "Windows GPU Counter".to_string(),
        usage,
        memory_used: 0,
        memory_total: 0,
        temperature: 0,
    })
}

fn get_gpu_info_internal() -> GpuInfo {
    get_gpu_info_at(0).unwrap_or(GpuInfo {
        name: "No GPU Found".to_string(),
        vendor: "Unknown".to_string(),
        luid: (0, 0),
    })
}

/// Returns the GPU at position `id` in the list produced by `get_all_gpus`
/// (software adapters excluded), so ids stay consistent across commands.
fn get_gpu_info_at(id: u32) -> Option<GpuInfo> {
    let mut position = 0;

    unsafe {
        let factory = CreateDXGIFactory1::<IDXGIFactory1>().ok()?;

        let mut index = 0;

        while let Ok(adapter) = factory.EnumAdapters1(index) {
            index += 1;

            let desc = match adapter.GetDesc1() {
                Ok(desc) => desc,
                Err(_) => continue,
            };

            if is_software_adapter(&desc) {
                continue;
            }

            if position == id {
                let name = adapter_name(&desc);
                let vendor = vendor_from_desc(&desc, &name);
                let luid = (desc.AdapterLuid.HighPart as u32, desc.AdapterLuid.LowPart);
                return Some(GpuInfo { name, vendor, luid });
            }

            position += 1;
        }
    }

    None
}

#[tauri::command]
fn get_all_gpus() -> Vec<GpuStats> {
    let mut gpus = Vec::new();

    unsafe {
        let factory = match CreateDXGIFactory1::<IDXGIFactory1>() {
            Ok(factory) => factory,
            Err(_) => return gpus,
        };

        let nvml = Nvml::init().ok();

        let mut index = 0;
        let mut id = 0;

        while let Ok(adapter) = factory.EnumAdapters1(index) {
            index += 1;

            let desc = match adapter.GetDesc1() {
                Ok(desc) => desc,
                Err(_) => continue,
            };

            if is_software_adapter(&desc) {
                continue;
            }

            let name = adapter_name(&desc);
            let vendor = vendor_from_desc(&desc, &name);
            let backend = detect_gpu_backend(&vendor);

            let mut memory_used = 0;
            let mut memory_total = 0;

            if vendor == "NVIDIA" {
                if let Some(nvml) = nvml.as_ref() {
                    if let Some(device) = find_nvml_device(nvml, &name) {
                        if let Ok(memory) = device.memory_info() {
                            memory_used = memory.used;
                            memory_total = memory.total;
                        }
                    }
                }
            } else if desc.DedicatedVideoMemory > 0 {
                memory_total = desc.DedicatedVideoMemory as u64;
            }

            gpus.push(GpuStats {
                id,
                name,
                vendor,
                backend,
                usage: 0,
                memory_used,
                memory_total,
                temperature: 0,
            });

            id += 1;
        }
    }

    gpus
}

#[tauri::command]
fn recommend_gpu() -> GpuRecommendation {
    let gpus = get_all_gpus();

    if gpus.is_empty() {
        return GpuRecommendation {
            recommended_gpu: 0,

            gpu_name: "No GPU".to_string(),

            vendor: "Unknown".to_string(),

            backend: "Unknown".to_string(),

            vram_total: 0,

            vram_used: 0,

            score: 0,

            reason: "No GPU detected".to_string(),
        };
    }

    let mut best_score = 0;

    let mut best_gpu = &gpus[0];

    for gpu in &gpus {
        let mut score = 0;

        // Vendor + backend support

        match gpu.vendor.as_str() {
            "NVIDIA" => {
                score += 40;
            }

            "AMD" => {
                score += 35;
            }

            "Intel" => {
                score += 20;
            }

            _ => {}
        }

        match gpu.backend.as_str() {
            "NVML" => {
                score += 10;
            }

            "ROCm" => {
                score += 10;
            }

            "Intel GPU API" => {
                score += 5;
            }

            _ => {}
        }

        // VRAM scoring

        let vram_gb = gpu.memory_total / 1024 / 1024 / 1024;

        if vram_gb >= 16 {
            score += 30;
        } else if vram_gb >= 8 {
            score += 25;
        } else if vram_gb >= 6 {
            score += 15;
        } else if vram_gb > 0 {
            score += 5;
        }

        // GPU detected and usable

        if gpu.name != "GPU Not Detected" {
            score += 10;
        }

        if score > best_score {
            best_score = score;

            best_gpu = gpu;
        }
    }

    GpuRecommendation {
        recommended_gpu: best_gpu.id,

        gpu_name: best_gpu.name.clone(),

        vendor: best_gpu.vendor.clone(),

        backend: best_gpu.backend.clone(),

        vram_total: best_gpu.memory_total,

        vram_used: best_gpu.memory_used,

        score: best_score,

        reason: format!(
            "Selected {} because it provides the best LLM acceleration support",
            best_gpu.name
        ),
    }
}

#[tauri::command]
async fn recommend_model(
    ram_total: u64,
    gpu_memory: u64,
    vendor: String,
    task: String,
    context: Option<u64>,
) -> ModelRecommendation {
    let ram_gb = ram_total as f32 / 1024.0 / 1024.0 / 1024.0;
    let vram_gb = gpu_memory as f32 / 1024.0 / 1024.0 / 1024.0;

    let task_type = match task.to_lowercase().as_str() {
        "coding" => TaskType::Coding,
        "chat" => TaskType::Chat,
        "reasoning" => TaskType::Reasoning,
        "fast" => TaskType::Fast,
        _ => TaskType::General,
    };

    // Get installed Ollama models
    let installed = match get_installed_models().await {
        Ok(models) => models,
        Err(_) => {
            return ModelRecommendation {
                recommended_model: "None".to_string(),
                category: "Unavailable".to_string(),
                size_gb: 0.0,
                reason: "Unable to retrieve installed models".to_string(),
                score: 0,
            };
        }
    };

    // Parse and score every model
    let mut scored = score_installed(&installed, ram_gb, vram_gb, &vendor, &task_type, context.unwrap_or(DEFAULT_CONTEXT)).await;

    // No models installed
    if scored.is_empty() {
        return ModelRecommendation {
            recommended_model: "None".to_string(),
            category: "Unavailable".to_string(),
            size_gb: 0.0,
            reason: "No installed models found".to_string(),
            score: 0,
        };
    }

    // Highest score first
    scored.sort_by(|a, b| b.score.cmp(&a.score));

    let best = &scored[0];

    // Determine category
    let category = match best.parameters {
        Some(p) if p >= 30.0 => "Very Large",
        Some(p) if p >= 13.0 => "Large",
        Some(p) if p >= 7.0 => "Balanced",
        Some(p) if p >= 3.0 => "Lightweight",
        Some(_) => "Small",
        None => {
            if best.size_gb >= 15.0 {
                "Large"
            } else if best.size_gb >= 8.0 {
                "Balanced"
            } else {
                "Lightweight"
            }
        }
    };

    ModelRecommendation {
        recommended_model: best.name.clone(),
        category: category.to_string(),
        size_gb: best.size_gb,
        reason: best.breakdown.join("\n"),
        score: best.score,
    }
}

async fn score_installed(
    installed: &[OllamaModel],
    ram_gb: f32,
    vram_gb: f32,
    vendor: &str,
    task: &TaskType,
    context: u64,
) -> Vec<ScoredModel> {
    let mut scored = Vec::with_capacity(installed.len());

    for model in installed {
        let meta = fetch_model_meta(&model.name).await;
        let parsed = parse_model(model, meta, context);
        scored.push(score_model(&parsed, ram_gb, vram_gb, vendor, task));
    }

    scored
}

fn family_bonus(family: &str) -> u32 {
    match family {
        "gemma" => 5,

        "qwen" => 5,

        "llama" => 5,

        "mistral" => 5,

        "phi" => 6,

        _ => 3,
    }
}

/// Largest context length the model supports (None if unknown / Ollama down).
#[tauri::command]
async fn get_model_context_limit(model: String) -> Option<u64> {
    fetch_model_meta(&model).await?.max_context
}

#[tauri::command]
fn get_gpu_info() -> GpuInfo {
    get_gpu_info_internal()
}

#[tauri::command]
fn get_system_stats(state: tauri::State<AppState>) -> SystemStats {
    let mut system = state.system.lock().unwrap_or_else(|e| e.into_inner());

    system.refresh_cpu_usage();
    system.refresh_memory();

    SystemStats {
        cpu_usage: system.global_cpu_usage(),
        ram_used: system.used_memory(),
        ram_total: system.total_memory(),
    }
}

fn empty_gpu_stats(name: String, vendor: String) -> GpuStats {
    let backend = detect_gpu_backend(&vendor);
    GpuStats {
        id: 0,
        name,
        vendor,
        backend,
        usage: 0,
        memory_used: 0,
        memory_total: 0,
        temperature: 0,
    }
}

fn collect_gpu_stats(id: u32) -> GpuStats {
    let info = match get_gpu_info_at(id) {
        Some(info) => info,
        None => {
            return GpuStats {
                id,
                name: "GPU Not Detected".to_string(),
                vendor: "Unknown".to_string(),
                backend: "Unknown".to_string(),
                usage: 0,
                memory_used: 0,
                memory_total: 0,
                temperature: 0,
            };
        }
    };

    let mut stats = match info.vendor.as_str() {
        "AMD" => get_amd_gpu_stats(info.name.clone())
            .unwrap_or_else(|| empty_gpu_stats(info.name.clone(), info.vendor.clone())),

        "Intel" => get_intel_gpu_stats(info.name.clone(), info.luid)
            .unwrap_or_else(|| empty_gpu_stats(info.name.clone(), info.vendor.clone())),

        "NVIDIA" => nvidia_gpu_stats(&info.name).unwrap_or_else(|| {
            empty_gpu_stats(info.name.clone(), info.vendor.clone())
        }),

        _ => empty_gpu_stats(info.name.clone(), info.vendor.clone()),
    };

    stats.id = id;
    stats
}

fn nvidia_gpu_stats(name: &str) -> Option<GpuStats> {
    let nvml = Nvml::init().ok()?;
    let device = find_nvml_device(&nvml, name)?;

    let usage = device.utilization_rates().map(|u| u.gpu).unwrap_or(0);

    let (memory_used, memory_total) = device
        .memory_info()
        .map(|m| (m.used, m.total))
        .unwrap_or((0, 0));

    let temperature = device
        .temperature(nvml_wrapper::enum_wrappers::device::TemperatureSensor::Gpu)
        .unwrap_or(0);

    Some(GpuStats {
        id: 0,
        name: name.to_string(),
        vendor: "NVIDIA".to_string(),
        backend: detect_gpu_backend("NVIDIA"),
        usage,
        memory_used,
        memory_total,
        temperature,
    })
}

// Async + spawn_blocking so slow probes (powershell, rocm-smi) never block the UI thread.
#[tauri::command]
async fn get_gpu_stats(id: u32) -> Result<GpuStats, String> {
    tauri::async_runtime::spawn_blocking(move || collect_gpu_stats(id))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_models() -> Vec<String> {
    match get_installed_models().await {
        Ok(models) => models.into_iter().map(|m| m.name).collect(),
        Err(_) => Vec::new(),
    }
}

async fn get_installed_models() -> Result<Vec<OllamaModel>, String> {
    let response = reqwest::get("http://localhost:11434/api/tags")
        .await
        .map_err(|e| e.to_string())?;

    let data: OllamaTags = response.json().await.map_err(|e| e.to_string())?;

    Ok(data.models)
}

fn detect_family(name: &str) -> String {
    let lower = name.to_lowercase();

    let families = [
        "llama",
        "qwen",
        "gemma",
        "mistral",
        "phi",
        "deepseek",
        "hermes",
        "command-r",
        "codestral",
        "mixtral",
        "yi",
        "falcon",
        "granite",
        "internlm",
        "starcoder",
        "wizardlm",
    ];

    for family in families {
        if lower.contains(family) {
            return family.to_string();
        }
    }

    "unknown".to_string()
}

fn detect_parameters(name: &str) -> Option<f32> {
    let lower = name.to_lowercase();

    for part in lower.split([':', '-', '_']) {
        if part.ends_with('b') {
            let value = part.trim_end_matches('b');

            // Skip formats like 8x7b
            if value.contains('x') {
                continue;
            }

            if let Ok(num) = value.parse::<f32>() {
                return Some(num);
            }
        }
    }

    None
}

fn detect_quantization(name: &str) -> Option<String> {
    let lower = name.to_lowercase();

    let known_quantizations = [
        "iq2_xxs", "iq2_xs", "iq3_xxs", "iq3_xs", "iq4_xs", "iq4_nl", "q2_k", "q3_k_s", "q3_k_m",
        "q3_k_l", "q4_0", "q4_1", "q4_k_s", "q4_k_m", "q5_0", "q5_1", "q5_k_s", "q5_k_m", "q6_k",
        "q8_0", "f16", "f32",
    ];

    for quant in known_quantizations {
        if lower.contains(quant) {
            return Some(quant.to_string());
        }
    }

    None
}

fn quantization_bonus(quant: Option<&str>) -> u32 {
    match quant {
        Some("iq2_xxs") => 10,
        Some("iq2_xs") => 10,
        Some("iq3_xxs") => 9,
        Some("iq3_xs") => 9,
        Some("iq4_xs") => 8,
        Some("iq4_nl") => 8,
        Some("q2_k") => 9,
        Some("q3_k_s") => 8,
        Some("q3_k_m") => 8,
        Some("q3_k_l") => 7,
        Some("q4_0") => 7,
        Some("q4_1") => 7,
        Some("q4_k_s") => 8,
        Some("q4_k_m") => 9,
        Some("q5_0") => 6,
        Some("q5_1") => 6,
        Some("q5_k_s") => 7,
        Some("q5_k_m") => 7,
        Some("q6_k") => 5,
        Some("q8_0") => 3,
        Some("f16") => 1,
        Some("f32") => 0,
        _ => 0,
    }
}

/// Context length used when the UI does not specify one (Ollama's default).
const DEFAULT_CONTEXT: u64 = 4096;

/// Extra metadata read from Ollama's `/api/show`.
#[derive(Debug, Clone, Default)]
struct ModelMeta {
    parameters_b: Option<f32>,
    quantization: Option<String>,
    /// f16 KV cache cost per token, in bytes.
    kv_bytes_per_token: Option<f64>,
    /// Largest context the model supports.
    max_context: Option<u64>,
}

fn json_u64(value: &serde_json::Value) -> Option<u64> {
    match value {
        serde_json::Value::Array(items) => items.iter().filter_map(|v| v.as_u64()).max(),
        other => other.as_u64(),
    }
}

static META_CACHE: OnceLock<Mutex<HashMap<String, ModelMeta>>> = OnceLock::new();

/// Cached wrapper: model metadata never changes, so ask Ollama once per model.
async fn fetch_model_meta(name: &str) -> Option<ModelMeta> {
    let cache = META_CACHE.get_or_init(|| Mutex::new(HashMap::new()));

    if let Some(meta) = cache.lock().ok()?.get(name) {
        return Some(meta.clone());
    }

    let meta = fetch_model_meta_uncached(name).await?;

    if let Ok(mut guard) = cache.lock() {
        guard.insert(name.to_string(), meta.clone());
    }

    Some(meta)
}

async fn fetch_model_meta_uncached(name: &str) -> Option<ModelMeta> {
    let response = reqwest::Client::new()
        .post("http://localhost:11434/api/show")
        .json(&serde_json::json!({ "model": name, "name": name }))
        .send()
        .await
        .ok()?;

    let data: serde_json::Value = response.json().await.ok()?;

    let parameters_b = data["details"]["parameter_size"]
        .as_str()
        .and_then(|p| p.trim().trim_end_matches(['B', 'b']).parse::<f32>().ok());

    let quantization = data["details"]["quantization_level"]
        .as_str()
        .map(|q| q.to_lowercase());

    let info = &data["model_info"];
    let arch = info["general.architecture"].as_str()?;

    let layers = json_u64(&info[format!("{arch}.block_count")]);
    let heads = json_u64(&info[format!("{arch}.attention.head_count")]);
    let kv_heads = json_u64(&info[format!("{arch}.attention.head_count_kv")]).or(heads);
    let embedding = json_u64(&info[format!("{arch}.embedding_length")]);

    let kv_bytes_per_token = match (layers, heads, kv_heads, embedding) {
        (Some(l), Some(h), Some(kv), Some(e)) if h > 0 => {
            // 2 (K and V) * layers * kv_heads * head_dim * 2 bytes (f16)
            Some(2.0 * l as f64 * kv as f64 * (e as f64 / h as f64) * 2.0)
        }
        _ => None,
    };

    let max_context = json_u64(&info[format!("{arch}.context_length")]);

    Some(ModelMeta {
        parameters_b,
        quantization,
        kv_bytes_per_token,
        max_context,
    })
}

/// Returns (estimated VRAM GB, estimated RAM GB) for running the model at
/// `context` tokens: weights + KV cache + runtime buffers.
fn estimate_memory(
    params: Option<f32>,
    size_gb: f32,
    kv_bytes_per_token: Option<f64>,
    context: u64,
) -> (f32, f32) {
    // The file Ollama downloaded *is* the weights, so use its real size.
    let weights_gb = size_gb;

    let kv_gb = match kv_bytes_per_token {
        Some(bytes) => (bytes * context as f64 / 1024.0 / 1024.0 / 1024.0) as f32,
        None => {
            // Rough fallback: ~0.5 GB of KV cache per 4k context for an 8B model.
            let p = params.unwrap_or(size_gb / 0.6);
            0.5 * (p / 8.0).max(0.1) * (context as f32 / 4096.0)
        }
    };

    // GPU: compute buffers + CUDA context. CPU: allocator overhead is larger.
    let vram = weights_gb + kv_gb + 0.5;
    let ram = weights_gb + kv_gb + 1.0;

    (vram, ram)
}

fn parse_model(model: &OllamaModel, meta: Option<ModelMeta>, context: u64) -> ParsedModel {
    let lower = model.name.to_lowercase();

    let family = detect_family(&model.name);

    let meta = meta.unwrap_or_default();
    let context = match meta.max_context {
        Some(max) => context.min(max),
        None => context,
    };

    // Prefer Ollama's own metadata; fall back to parsing the tag name.
    let parameters = meta.parameters_b.or_else(|| detect_parameters(&model.name));

    let quantization = meta
        .quantization
        .clone()
        .or_else(|| detect_quantization(&model.name));

    let size_gb = model.size as f32 / 1024.0 / 1024.0 / 1024.0;

    let (estimated_vram_gb, estimated_ram_gb) =
        estimate_memory(parameters, size_gb, meta.kv_bytes_per_token, context);

    let purpose = if lower.contains("coder") || lower.contains("code") {
        "Coding"
    } else if lower.contains("vision") || lower.contains("vl") {
        "Vision"
    } else if lower.contains("embed") {
        "Embedding"
    } else if lower.contains("reason") {
        "Reasoning"
    } else {
        "Chat"
    };

    ParsedModel {
        name: model.name.clone(),
        family,
        purpose: purpose.to_string(),
        parameters,
        quantization,
        size_gb: model.size as f32 / 1024.0 / 1024.0 / 1024.0,
        estimated_vram_gb,
        estimated_ram_gb,
    }
}

fn calculate_task_score(model: &str, task: &TaskType) -> i32 {
    let model_name = model.to_lowercase();

    match task {
        TaskType::Coding => {
            if model_name.contains("coder")
                || model_name.contains("code")
                || model_name.contains("qwen")
            {
                30
            } else {
                5
            }
        }

        TaskType::Chat => {
            if model_name.contains("llama")
                || model_name.contains("hermes")
                || model_name.contains("mistral")
            {
                25
            } else {
                10
            }
        }

        TaskType::Reasoning => {
            if model_name.contains("qwen") || model_name.contains("deepseek") {
                30
            } else {
                10
            }
        }

        TaskType::Fast => {
            if model_name.contains("mini")
                || model_name.contains("small")
                || model_name.contains("phi")
            {
                25
            } else {
                5
            }
        }

        TaskType::General => 10,
    }
}

#[tauri::command]
async fn get_model_rankings(
    ram_total: u64,
    gpu_memory: u64,
    vendor: String,
    task: String,
    context: Option<u64>,
) -> Vec<ModelRanking> {
    let ram_gb = ram_total as f32 / 1024.0 / 1024.0 / 1024.0;

    let vram_gb = gpu_memory as f32 / 1024.0 / 1024.0 / 1024.0;

    let task_type = match task.to_lowercase().as_str() {
        "coding" => TaskType::Coding,
        "chat" => TaskType::Chat,
        "reasoning" => TaskType::Reasoning,
        "fast" => TaskType::Fast,
        _ => TaskType::General,
    };

    let installed = match get_installed_models().await {
        Ok(models) => models,
        Err(_) => return Vec::new(),
    };

    let mut scored = score_installed(&installed, ram_gb, vram_gb, &vendor, &task_type, context.unwrap_or(DEFAULT_CONTEXT)).await;

    scored.sort_by(|a, b| b.score.cmp(&a.score));

    scored
        .into_iter()
        .map(|m| ModelRanking {
            name: m.name,
            family: m.family,
            purpose: m.purpose,
            size_gb: m.size_gb,
            score: m.score,
            reasons: m.breakdown,
        })
        .collect()
}

fn score_model(
    model: &ParsedModel,
    ram_gb: f32,
    vram_gb: f32,
    vendor: &str,
    task: &TaskType,
) -> ScoredModel {
    let mut score: u32 = 0;
    let mut breakdown: Vec<String> = Vec::new();
    let task_bonus = calculate_task_score(&model.name, task) as u32;

    score += task_bonus;

    if task_bonus > 0 {
        breakdown.push(format!("Task preference bonus +{}", task_bonus));
    }

    // VRAM compatibility
    if model.estimated_vram_gb <= vram_gb * 0.9 {
        score += 40;

        breakdown.push(format!(
            "GPU memory fit ({:.1}GB required) +40",
            model.estimated_vram_gb
        ));

        if model.estimated_vram_gb <= vram_gb * 0.7 {
            score += 10;

            breakdown.push("Good GPU headroom +10".to_string());
        }
    } else if model.estimated_vram_gb <= vram_gb {
        score += 25;

        breakdown.push(format!(
            "Tight GPU fit ({:.1}GB required) +25",
            model.estimated_vram_gb
        ));
    } else if vram_gb > 0.0 && model.estimated_ram_gb <= ram_gb {
        score += 15;

        breakdown.push(format!(
            "Partial GPU offload: ~{:.0}% of layers on GPU, rest in RAM ({:.1}GB needed) +15",
            (vram_gb * 0.9 / model.estimated_vram_gb * 100.0).min(99.0),
            model.estimated_ram_gb
        ));
    } else if model.estimated_ram_gb <= ram_gb {
        score += 10;

        breakdown.push(format!(
            "Runs in system RAM ({:.1}GB required) +10",
            model.estimated_ram_gb
        ));
    } else {
        breakdown.push("Memory requirement too high +0".to_string());
    }
    if ram_gb >= model.estimated_ram_gb {
        score += 10;

        breakdown.push("System RAM available +10".to_string());
    }

    // Vendor
    if vendor.to_lowercase().contains("nvidia") {
        score += 10;
    }

    let family_score = family_bonus(&model.family);
    score += family_score;

    breakdown.push(format!("Model family ({}) +{}", model.family, family_score));

    // Parameter count
    match model.parameters {
        Some(p) if p <= 3.0 => {
            score += 10;
            breakdown.push("Small model size +10".to_string());
        }

        Some(p) if p <= 7.0 => {
            score += 8;
            breakdown.push("Medium model size +8".to_string());
        }

        Some(p) if p <= 13.0 => {
            score += 6;
            breakdown.push("Large model size +6".to_string());
        }

        Some(_) => {
            score += 3;
            breakdown.push("Very large model size +3".to_string());
        }

        None => {}
    }

    let quant_score = quantization_bonus(model.quantization.as_deref());
    score += quant_score;

    if quant_score > 0 {
        breakdown.push(format!(
            "Quantization ({}) +{}",
            model.quantization.as_deref().unwrap(),
            quant_score
        ));
    }

    // VRAM Headroom
    let usage = if vram_gb > 0.0 {
        model.estimated_vram_gb / vram_gb
    } else {
        f32::MAX
    };

    if usage <= 0.5 {
        score += 15;

        breakdown.push("Large VRAM headroom +15".to_string());
    } else if usage <= 0.75 {
        score += 10;

        breakdown.push("Good VRAM headroom +10".to_string());
    } else if usage <= 1.0 {
        score += 5;

        breakdown.push("Tight VRAM usage +5".to_string());
    }

    ScoredModel {
        name: model.name.clone(),
        family: model.family.clone(),
        purpose: model.purpose.clone(),
        parameters: model.parameters,
        quantization: model.quantization.clone(),
        size_gb: model.size_gb,
        estimated_vram_gb: model.estimated_vram_gb,
        estimated_ram_gb: model.estimated_ram_gb,
        score,
        breakdown,
    }
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
    context_length: Option<u32>,
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
            num_ctx: context_length.unwrap_or(DEFAULT_CONTEXT as u32),
        },
    };

    let client = reqwest::Client::new();

    let response = match client
        .post("http://localhost:11434/api/generate")
        .json(&request)
        .send()
        .await
    {
        Ok(response) => response,
        Err(e) => {
            return GenerateResponse {
                text: format!("Ollama Error: could not connect to Ollama ({})", e),
                tokens: 0,
                generation_time: 0,
            };
        }
    };

    let body = match response.text().await {
        Ok(body) => body,
        Err(e) => {
            return GenerateResponse {
                text: format!("Ollama Error: failed reading response ({})", e),
                tokens: 0,
                generation_time: 0,
            };
        }
    };

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
            generate_text,
            get_models,
            get_system_stats,
            get_gpu_stats,
            check_ollama_status,
            get_gpu_info,
            get_all_gpus,
            recommend_gpu,
            recommend_model,
            get_model_rankings,
            get_model_context_limit
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
