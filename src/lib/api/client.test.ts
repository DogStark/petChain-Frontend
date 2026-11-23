import { describe, expect, it, vi } from "vitest";
import { ApiClient, ApiError } from "./client";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("ApiClient", () => {
  it("attaches the bearer token from auth hooks", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { ok: true }));
    const client = new ApiClient({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      auth: { getAccessToken: () => "token-1", refresh: async () => null },
    });

    await client.get("/pets");

    const init = fetchImpl.mock.calls[0][1] as RequestInit;
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer token-1");
  });

  it("performs a single refresh for concurrent 401 responses and retries all callers", async () => {
    let token = "expired";
    const refresh = vi.fn(async () => {
      token = "fresh";
      return token;
    });

    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      const auth = new Headers(init.headers).get("Authorization");
      if (auth === "Bearer expired") return jsonResponse(401, { message: "expired" });
      return jsonResponse(200, { ok: true });
    });

    const client = new ApiClient({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      auth: { getAccessToken: () => token, refresh },
    });

    const results = await Promise.all([
      client.get("/a"),
      client.get("/b"),
      client.get("/c"),
    ]);

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
  });

  it("normalizes HTTP failures into ApiError", async () => {
    const client = new ApiClient({
      fetchImpl: (async () => jsonResponse(500, { message: "boom" })) as unknown as typeof fetch,
    });

    await expect(client.get("/x")).rejects.toMatchObject({
      name: "ApiError",
      kind: "http",
      status: 500,
      message: "boom",
    });
  });

  it("raises auth error when refresh fails", async () => {
    const onAuthFailure = vi.fn();
    const client = new ApiClient({
      fetchImpl: (async () => jsonResponse(401, {})) as unknown as typeof fetch,
      auth: { getAccessToken: () => "expired", refresh: async () => null, onAuthFailure },
    });

    await expect(client.get("/x")).rejects.toBeInstanceOf(ApiError);
    expect(onAuthFailure).toHaveBeenCalledTimes(1);
  });

  it("supports AbortSignal cancellation", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );
    const client = new ApiClient({ fetchImpl: fetchImpl as unknown as typeof fetch });

    const promise = client.get("/slow", { signal: controller.signal });
    controller.abort();

    await expect(promise).rejects.toMatchObject({ kind: "abort" });
  });
});
