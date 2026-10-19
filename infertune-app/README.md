<p align="center">
  <img src="public/logo-light.svg" alt="InferTune" width="360">
</p>

<p align="center"><b>Hardware-aware tuning studio for local LLMs</b></p>

A hardware-aware tuning studio for local LLMs. InferTune runs models through
[Ollama](https://ollama.com), shows live CPU / RAM / GPU / VRAM usage while they
generate, estimates which installed models fit your hardware (weights + KV cache
at your chosen context length) and explains every recommendation.

## Features

- Live CPU, RAM, GPU and VRAM monitoring (NVIDIA via NVML, AMD via `rocm-smi`, Intel via Windows GPU counters)
- Multi-GPU detection and selection
- Model recommendations and rankings with a transparent score breakdown
- Context-length aware memory estimates, capped to each model's real limit
- Chat playground with temperature / top-p / top-k / max tokens / seed / context length
- Token count and tokens-per-second

## Requirements

- Windows 10/11 (uses DXGI and WebView2; the installer fetches WebView2 if missing)
- [Ollama](https://ollama.com) running locally on `http://localhost:11434` with at least one model pulled
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

The installer is written to `src-tauri/target/release/bundle/nsis/`.

## Releasing

1. Bump the version in `package.json`, `src-tauri/Cargo.toml` and `src-tauri/tauri.conf.json`.
2. Commit, then tag and push: `git tag v0.1.0 && git push origin v0.1.0`.
3. The **Build InferTune** workflow builds the Windows installer and attaches it to a draft GitHub release.

Installers are unsigned. Windows SmartScreen will warn on first run until the
installer is code-signed.

## Troubleshooting

- **"Offline" / no models:** start Ollama (`ollama serve`) and pull a model (`ollama pull llama3.1`).
- **GPU shows 0% or "Not Supported":** update your GPU driver; on AMD install ROCm's `rocm-smi`.
