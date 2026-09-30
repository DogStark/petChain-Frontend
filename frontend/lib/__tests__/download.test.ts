import {
  DEFAULT_ALLOWED_CONTENT_TYPES,
  DownloadValidationError,
  downloadResponse,
  filenameFromContentDisposition,
  isJsonErrorPayload,
  normalizeContentType,
  sanitizeFilename,
} from "../download";

describe("sanitizeFilename", () => {
  it("removes path separators", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe(".._.._etc_passwd");
    expect(sanitizeFilename("C:\\Windows\\file.pdf")).toBe(
      "C__Windows_file.pdf",
    );
  });

  it("removes control characters", () => {
    expect(sanitizeFilename("invoice\r\nSet-Cookie: x=1.pdf")).toBe(
      "invoiceSet-Cookie: x=1.pdf",
    );
  });

  it("falls back when the result is empty", () => {
    expect(sanitizeFilename("   ")).toBe("download");
    expect(sanitizeFilename("", "fallback.pdf")).toBe("fallback.pdf");
  });
});

describe("filenameFromContentDisposition", () => {
  it("parses quoted filenames", () => {
    expect(
      filenameFromContentDisposition('attachment; filename="report.pdf"'),
    ).toBe("report.pdf");
  });

  it("parses RFC 5987 extended filenames", () => {
    expect(
      filenameFromContentDisposition(
        "attachment; filename*=UTF-8''r%C3%A9sum%C3%A9.pdf",
      ),
    ).toBe("résumé.pdf");
  });

  it("normalizes unsafe filenames", () => {
    expect(
      filenameFromContentDisposition('attachment; filename="../evil.pdf"'),
    ).toBe(".._evil.pdf");
  });

  it("falls back when the header is missing", () => {
    expect(filenameFromContentDisposition(null, "fallback.pdf")).toBe(
      "fallback.pdf",
    );
  });
});

describe("normalizeContentType", () => {
  it("drops parameters and lowercases", () => {
    expect(normalizeContentType("Application/PDF; charset=utf-8")).toBe(
      "application/pdf",
    );
    expect(normalizeContentType(null)).toBe("");
  });
});

describe("isJsonErrorPayload", () => {
  it("detects JSON error bodies", () => {
    expect(
      isJsonErrorPayload("application/json", '{"error":"not found"}'),
    ).toBe(true);
    expect(
      isJsonErrorPayload("application/json", '{"message":"nope"}'),
    ).toBe(true);
  });

  it("ignores non-JSON content types and malformed bodies", () => {
    expect(isJsonErrorPayload("application/pdf", '{"error":"x"}')).toBe(
      false,
    );
    expect(isJsonErrorPayload("application/json", "not json")).toBe(false);
    expect(isJsonErrorPayload("application/json", "")).toBe(false);
  });
});

describe("downloadResponse", () => {
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  let createSpy: jest.Mock;
  let revokeSpy: jest.Mock;

  beforeEach(() => {
    createSpy = jest.fn(() => "blob:mock");
    revokeSpy = jest.fn();
    URL.createObjectURL = createSpy as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = revokeSpy as unknown as typeof URL.revokeObjectURL;
  });

  afterEach(() => {
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    jest.restoreAllMocks();
  });

  function makeResponse(
    body: string,
    init: { status?: number; headers?: Record<string, string> } = {},
  ): Response {
    return new Response(body, {
      status: init.status ?? 200,
      headers: init.headers,
    });
  }

  it("downloads a valid document and revokes the object URL", async () => {
    const click = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    const response = makeResponse("pdf-bytes", {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": 'attachment; filename="report.pdf"',
      },
    });

    await downloadResponse(response);

    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(revokeSpy).toHaveBeenCalledWith("blob:mock");
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("rejects disallowed content types", async () => {
    const response = makeResponse("<html></html>", {
      headers: { "content-type": "text/html" },
    });

    await expect(downloadResponse(response)).rejects.toBeInstanceOf(
      DownloadValidationError,
    );
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("surfaces JSON error payloads returned with a 2xx status", async () => {
    const response = makeResponse('{"error":"export not ready"}', {
      headers: { "content-type": "application/json" },
    });

    await expect(downloadResponse(response)).rejects.toThrow(
      "export not ready",
    );
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("rejects non-ok responses", async () => {
    const response = makeResponse("nope", {
      status: 500,
      headers: { "content-type": "application/pdf" },
    });

    await expect(downloadResponse(response)).rejects.toBeInstanceOf(
      DownloadValidationError,
    );
  });

  it("revokes the object URL when the download is cancelled", async () => {
    const controller = new AbortController();
    controller.abort();

    const response = makeResponse("pdf-bytes", {
      headers: { "content-type": "application/pdf" },
    });

    await expect(
      downloadResponse(response, { signal: controller.signal }),
    ).rejects.toBeInstanceOf(DownloadValidationError);
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("exposes a default allowlist of document content types", () => {
    expect(DEFAULT_ALLOWED_CONTENT_TYPES).toContain("application/pdf");
    expect(DEFAULT_ALLOWED_CONTENT_TYPES).not.toContain("text/html");
  });
});
