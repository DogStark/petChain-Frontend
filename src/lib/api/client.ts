  private async parseBody<T>(response: Response): Promise<T> {
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    if (text === '') return undefined as T;
    return JSON.parse(text) as T;
  }

  async function request<T = unknown>(path: string, requestOptions: RequestOptions = {}): Promise<T> {
    const token = requestOptions.skipAuth ? null : options.getAccessToken();
    let response = await send(path, r
      );
    }
  }

  private async parseBody<T>(response: Response): Promise<T> {
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    if (text === '') return undefined as T;
    return JSON.parse(text) as T;
  }

  async function request<T = unknown>(path: string, requestOptions: RequestOptions = {}): Promise<T> {
    const token = requestOptions.skipAuth ? null : options.getAccessToken();
    let response = await send(path, requestOptions, token);

    if (response.status === 401 && !requestOptions.skipAuth && !requestOptions.skipRefresh) {
      const refreshed = await refreshOnce();
      if (refreshed) {
        response = await send(path, requestOptions, refreshed);
      }
    }

    if (!response.ok) {
      const body = await parseBody(response);
      const kind: ApiErrorKind = response.status === 401 || response.status === 403 ? "auth" : "http";
      const message =
        (typeof body === "object" && body !== null && "message" in body && typeof (body as { message?: unknown }).message === "string"
          ? (body as { message: string }).message
          : undefined) ?? `Request failed with status ${response.status}`;
      throw new ApiError(kind, message, response.status, body);
    }

    return (await parseBody(response)) as T;
  }

  function withBody(method: string) {
    return <T = unknown>(path: string, body?: unknown, requestOptions: RequestOptions = {}) =>
      request<T>(path, {
        ...requestOptions,
        method,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
  }

  return {
    request,
    get: <T = unknown>(path: string, requestOptions?: RequestOptions) =>
      request<T>(path, { ...requestOptions, method: "GET" }),
    post: withBody("POST"),
    put: withBody("PUT"),
    patch: withBody("PATCH"),
    delete: <T = unknown>(path: string, requestOptions?: RequestOptions) =>
      request<T>(path, { ...requestOptions, method: "DELETE" }),
  };
}

export async function request(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init);
  if (!response.ok) {
    throw await parseApiError(response);
  }
  return response;
}
}
