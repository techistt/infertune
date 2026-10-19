/**
 * Turns raw server errors into a short, actionable hint.
 * Returns null when the error is not one we recognise.
 */
export function explainError(message: string): string | null {
  const m = message.toLowerCase();

  if (
    m.includes("cuda") ||
    m.includes("0xc0000409") ||
    m.includes("out of memory") ||
    m.includes("cudamalloc") ||
    m.includes("failed to allocate") ||
    m.includes("llama-server process has terminated") ||
    m.includes("model runner has unexpectedly stopped")
  ) {
    return (
      "The model server crashed, most often because the GPU ran out of memory. " +
      "Close other GPU-heavy apps (browsers, wallpaper or video apps), unload loaded models " +
      "(run `ollama stop <model>`), lower the context length, or pick a smaller model."
    );
  }

  if (m.includes("not found") && m.includes("model")) {
    return "That model is not installed on this server. Open Models to see what is available.";
  }

  if (
    m.includes("connection refused") ||
    m.includes("error sending request") ||
    m.includes("tcp connect error") ||
    m.includes("couldn't connect")
  ) {
    return "Could not reach the server. Make sure it is running and the address in Settings is correct.";
  }

  if (m.includes("timed out") || m.includes("timeout")) {
    return "The server took too long to answer. Large models can need a minute to load; try again or use a smaller model.";
  }

  if (m.includes("401") || m.includes("403") || m.includes("unauthorized")) {
    return "The server rejected the request. Check the API key in Settings.";
  }

  return null;
}

/** "message" plus a hint on a new line when one applies. */
export function withHint(message: string): string {
  const hint = explainError(message);

  return hint ? `${message}\n\nTip: ${hint}` : message;
}
