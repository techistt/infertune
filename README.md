<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="infertune-app/public/logo.svg">
    <img src="infertune-app/public/logo-light.svg" alt="InferTune" width="360">
  </picture>
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
- **Playground:** chat with streaming replies and a Stop button, temperature, top-p, top-k, max tokens, seed and context length (capped to the model's real limit). Optional conversation mode keeps earlier turns. A prompt library holds built-in and saved prompts (import/export as JSON). Ollama users can also set how many layers run on the GPU. Shows token count and tokens/second. Ctrl+Enter to send.
- **GPU memory guard:** before you run a model, InferTune compares its estimated memory need at your chosen context with the VRAM that is actually free. It warns when loading may crash the server, explains when part of the model will run on the CPU, and suggests the largest context length that still fits fully on your GPU.
- **Friendly errors:** common failures (GPU out of memory, server crash, model not found, server unreachable, timeouts, bad API key) come with a plain-language tip next to the raw error.
- **Models:** every installed model with parameters, quantization, size, estimated VRAM and RAM at your context length, and a fit rating (GPU / partial offload / CPU / too large). Ollama users can download and remove models, with live progress.
- **Discover models:** a curated list of popular Ollama models sorted by how well they should fit your GPU and RAM, with one-click download.
- **Compare:** send one prompt to 2–4 models and read the answers side by side, with speed and time for each. Models run one at a time so they do not fight over GPU memory.
- **Benchmarks:** run one or more models through a preset or custom prompt for several runs with fixed settings. Records tokens/second, time, peak CPU / RAM / GPU / VRAM, GPU temperature and (NVIDIA) power draw with tokens per joule. Shows a speed chart and a trend over time per model. Results can be copied as Markdown or CSV, or exported as a standalone HTML report (print it to PDF).
- **Quality check:** asks a model 12 short questions (math, logic, knowledge, instruction following, code) at temperature 0 and grades them automatically, so you can see what a smaller or more compressed model gives up. A quick sanity check, not a full benchmark.
- **Auto-tune:** tries several context sizes (and, on Ollama, GPU layer splits) for one model, measures each, and highlights the fastest and a balanced option you can apply with one click. Settings that run out of memory are marked as failed.
- **Custom quality sets:** write your own questions (contains / exact / number / regex checks), save them, import and export as JSON, and run them from the Quality page.
- **Quantize (Ollama):** make a smaller Q8 / Q6 / Q5 / Q4 / Q3 / Q2 copy of a 16-bit or 32-bit model, then compare it with the original using Quality and Benchmarks.
- **Planner:** enter a model's size and quantization to see how much VRAM and RAM each context length needs, and what fits your computer, before you download it.
- **Fine-tune estimator:** a calculator for the GPU memory needed to fine-tune a model with QLoRA, LoRA or full fine-tuning. It does not train anything.
- **Sessions:** every Playground and Compare generation is saved. Search, review the full settings and response, reopen in the Playground, copy as JSON or delete. Pick two sessions to compare their settings and see a word-level diff of the responses.
- **Logs:** in-app log of connections, errors, downloads and benchmarks, with level filter, search and copy.
- **Settings:** manage servers, API keys, refresh interval, notifications, tray behaviour, the local API server, and stored data.
- **Desktop:** a tray icon (click to bring the window back; optional "keep running in the tray" on close) and a notification when a long job finishes while the window is in the background.

### Local API server

Settings has a **Local API server** switch. When on, InferTune listens on
`http://127.0.0.1:<port>/v1` (default port 11500, this computer only) and
forwards OpenAI-style requests, including streaming, to the server that was
active when you pressed Start. Other tools can then use one stable address,
with an optional access token:

```
curl http://127.0.0.1:11500/v1/chat/completions \
  -H "Authorization: Bearer YOUR_TOKEN" -H "Content-Type: application/json" \
  -d '{"model":"llama3.2:3b","messages":[{"role":"user","content":"Hello"}]}'
```

Stop and start it again after switching servers. `GET /health` answers without a token.

### Ollama vs other servers

Ollama reports parameter count, quantization and context limit, so memory
estimates are precise. OpenAI-compatible servers do not, so InferTune
estimates from the model name and file size where available; treat those
figures as approximate. Model download and removal are Ollama-only; with other
servers, load models in that server's own app and press Refresh.

## Requirements

- Windows 10/11 (uses DXGI and WebView2; the installer fetches WebView2 if missing). Linux and macOS are not supported yet: GPU detection is Windows-specific.
- At least one supported local server running with a model available
- Optional: an NVIDIA driver (for NVML), or ROCm's `rocm-smi` for AMD

## Repository layout

- `infertune-app/`: the desktop app (Tauri v2: React + TypeScript frontend, Rust backend)
- `.github/workflows/`: CI that tests the app and builds the Windows installer

## Development

Prerequisites: Node.js 22+, Rust (stable), and the
[Tauri prerequisites for Windows](https://tauri.app/start/prerequisites/).

```bash
cd infertune-app
npm install
npm run tauri dev
```

## Testing

Run from the `infertune-app` folder:

```bash
npm test                                          # frontend unit tests (Vitest)
cargo test --lib --manifest-path src-tauri/Cargo.toml   # Rust unit tests
npx tsc --noEmit                                  # type-check
```

The tests cover the memory estimator (Rust and TypeScript), context-length
suggestions, GPU-memory advice, error hints, exports, server presets and the
settings, history and log stores. They also run on every push in GitHub Actions.

## Build an installer

Run from the `infertune-app` folder:

```bash
npm run tauri build
```

The installer is written to `src-tauri/target/release/bundle/nsis/`. The
portable executable is `src-tauri/target/release/infertune-app.exe`.

If the build stops at `Downloading ...nsis-3.11.zip` (or fails with
`timeout: global`), your network is blocking the download of the NSIS
installer tool. Build only the executable instead, which skips that step:

```bash
npm run build:exe
```

The installer can still be built by the GitHub Actions workflow (push a `v*` tag).

## Releasing

1. Bump the version in `package.json`, `src-tauri/Cargo.toml` and `src-tauri/tauri.conf.json`.
2. Commit, then tag and push: `git tag v0.5.0 && git push origin v0.5.0`.
3. The **Build InferTune** workflow builds the Windows installer and attaches it to a draft GitHub release.

The release workflow runs the type-check and both test suites first. Installers are unsigned. Windows SmartScreen will warn on first run until the
installer is code-signed.

## Privacy

Everything runs on your computer. InferTune only contacts the servers you
configure. Sessions, benchmarks and settings (including any API keys) are
stored locally in the app's storage.

## Troubleshooting

- **"Offline" / no models:** start your server, then check the address in Settings with **Test connection**. For Ollama, run `ollama serve` and `ollama pull llama3.2`.
- **Server found but no models:** with LM Studio, Jan or llama.cpp, load a model first.
- **GPU shows 0% or "Not Supported":** update your GPU driver; on AMD install ROCm's `rocm-smi`.

## License

Copyright (c) 2026 techistt. All rights reserved. See [LICENSE](LICENSE).
