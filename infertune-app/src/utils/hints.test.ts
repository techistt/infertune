import { describe, expect, it } from "vitest";
import { explainError, withHint } from "./hints";

describe("explainError", () => {
  it("recognises the Ollama CUDA crash from a real report", () => {
    const message =
      "Ollama error (HTTP 500 Internal Server Error: llama-server process has terminated: exit status 0xc0000409: CUDA error: shared object initialization failed)";

    expect(explainError(message)).toMatch(/GPU ran out of memory/);
  });

  it("recognises out-of-memory messages", () => {
    expect(explainError("CUDA out of memory")).not.toBeNull();
    expect(explainError("failed to allocate buffer")).not.toBeNull();
  });

  it("recognises a missing model", () => {
    expect(explainError("model 'foo' not found")).toMatch(/not installed/);
  });

  it("recognises an unreachable server", () => {
    expect(explainError("error sending request for url")).toMatch(/Could not reach/);
    expect(explainError("Connection refused")).toMatch(/Could not reach/);
  });

  it("recognises timeouts and auth failures", () => {
    expect(explainError("request timed out")).toMatch(/too long/);
    expect(explainError("HTTP 401 Unauthorized")).toMatch(/API key/);
  });

  it("returns null for unknown errors", () => {
    expect(explainError("something odd")).toBeNull();
  });
});

describe("withHint", () => {
  it("appends a tip when one applies", () => {
    const out = withHint("CUDA error");
    expect(out.startsWith("CUDA error")).toBe(true);
    expect(out).toContain("Tip:");
  });

  it("leaves unknown errors unchanged", () => {
    expect(withHint("something odd")).toBe("something odd");
  });
});
