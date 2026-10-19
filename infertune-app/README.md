<p align="center">
  <img src="public/logo-light.svg" alt="InferTune" width="360">
</p>

<p align="center"><b>Hardware-aware tuning studio for local LLMs</b></p>

InferTune is a Windows desktop app that connects to the local AI server you
already use, shows live CPU / RAM / GPU / VRAM usage while a model generates,
estimates which models fit your hardware (weights + KV cache at your chosen
context length), and lets you chat, benchmark and compare them.

## Supported servers

| Server | Type | Default address | Notes |
|---|---|---|---|
| [Ollama](https://ollama.com) | Native API | `http://localhost:11434` | Also supports downloading and removing models, and exact model details |
| [LM Studio](https://lmstudio.ai) | OpenAI-compatible | `http://localhost:1234` | Start the server in the Developer tab |
| [llama.cpp](https://github.com/ggml-org/llama.cpp) | OpenAI-compatible | `http://localhost:8080` | `llama-server -m model.gguf` |
| [vLLM](https://docs.vllm.ai) | OpenAI-compatible | `http://localhost:8000` | `vllm serve <model>` |
| [Jan](https://jan.ai) | OpenAI-compatible | `http://localhost:1337` | Enable the local API server |
| [KoboldCpp](https://github.com/LostRuins/koboldcpp) | OpenAI-compatible | `http://localhost:5001` | |
| [LocalAI](https://localai.io) | OpenAI-compatible | `http://localhost:8081` | Adjust the port if needed |
| [text-generation-webui](https://github.com/oobabooga/text-generation-webui) | OpenAI-compatible | `http://localhost:5000` | Start with `--api` |
| Custom | OpenAI-compatible | any | Anything exposing `/v1/chat/completions`; optional API key |

Add servers in **Settings**, or press **Scan for running servers** to detect
the ones running on their default ports. You can keep several configured and
switch between them at any time.

## Features

- **Dashboard:** live CPU, RAM, GPU and VRAM (NVIDIA via NVML, AMD via `rocm-smi`, Intel via Windows GPU counters), multi-GPU selection, GPU and model recommendations with a score breakdown.
- **Playground:** chat with temperature, top-p, top-k, max tokens, seed and context length (capped to the model's real limit). Shows token count and tokens/second. Ctrl+Enter to send.
- **Models:** every installed model with parameters, quantization, size, estimated VRAM and RAM at your context length, and a fit rating (GPU / partial offload / CPU / too large). Ollama users can download and remove models, with live progress.
- **Benchmarks:** run one or more models through a preset or custom prompt for several runs with fixed settings. Records tokens/second, time, and peak CPU / RAM / GPU / VRAM. Results are saved and can be copied as CSV.
- **Sessions:** every Playground generation is saved. Search, review the full settings and response, reopen in the Playground, copy as JSON or delete.
- **Logs:** in-app log of connections, errors, downloads and benchmarks, with level filter, search and copy.
- **Settings:** manage servers, API keys, refresh interval, and stored data.

### Ollama vs other servers

Ollama reports parameter count, quantization and context limit, so memory
estimates are precise. OpenAI-compatible servers do not, so InferTune
estimates from the model name and file size where available; treat those
figures as approximate. Model download and removal are Ollama-only; with other
servers, load models in that server's own app and press Refresh.

## Requirements

- Windows 10/11 (uses DXGI and WebView2; the installer fetches WebView2 if missing)
- At least one supported local server running with a model available
- Optional: an NVIDIA driver (for NVML), or ROCm's `rocm-smi` for AMD

## Development

Prerequisites: Node.js 22+, Rust (stable), and the
[Tauri prerequisites for Windows](https://tauri.app/start/prerequisites/).

```bash
npm install
npm run tauri dev
```

## Build an installer

```bash
npm run tauri build
```

The installer is written to `src-tauri/target/release/bundle/nsis/`. The
portable executable is `src-tauri/target/release/infertune-app.exe`.

## Releasing

1. Bump the version in `package.json`, `src-tauri/Cargo.toml` and `src-tauri/tauri.conf.json`.
2. Commit, then tag and push: `git tag v0.2.0 && git push origin v0.2.0`.
3. The **Build InferTune** workflow builds the Windows installer and attaches it to a draft GitHub release.

Installers are unsigned. Windows SmartScreen will warn on first run until the
installer is code-signed.

## Privacy

Everything runs on your computer. InferTune only contacts the servers you
configure. Sessions, benchmarks and settings (including any API keys) are
stored locally in the app's storage.

## Troubleshooting

- **"Offline" / no models:** start your server, then check the address in Settings with **Test connection**. For Ollama, run `ollama serve` and `ollama pull llama3.2`.
- **Server found but no models:** with LM Studio, Jan or llama.cpp, load a model first.
- **GPU shows 0% or "Not Supported":** update your GPU driver; on AMD install ROCm's `rocm-smi`.
