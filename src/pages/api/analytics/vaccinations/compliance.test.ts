import type { NextApiRequest, NextApiResponse } from "next";
import handler from "./compliance";

jest.mock("@/lib/api/apiBaseUrl", () => ({
  getApiBaseUrl: () => "http://localhost:3000/api/v1",
}));

function createMockRes() {
  const res: Partial<NextApiResponse> & {
    statusCode?: number;
    body?: unknown;
  } = {};
  res.status = jest.fn((code: number) => {
    res.statusCode = code;
    return res as NextApiResponse;
  });
  res.json = jest.fn((data: unknown) => {
    res.body = data;
    return res as NextApiResponse;
  });
  return res as NextApiResponse & { statusCode?: number; body?: unknown };
}

describe("vaccinations compliance API route", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("proxies backend vaccination compliance data", async () => {
    const compliance = {
      summary: { complianceRate: 87.3, overdue: 67, upcomingDue: 203 },
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => compliance,
    });

    const req = {
      method: "GET",
      headers: { authorization: "Bearer test-token" },
      query: { startDate: "2024-01-01", endDate: "2024-01-31" },
    } as unknown as NextApiRequest;

    const res = createMockRes();
    await handler(req, res);

    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/v1/analytics/vaccinations/compliance?startDate=2024-01-01&endDate=2024-01-31",
      expect.objectContaining({
        method: "GET",
        headers: { Authorization: "Bearer test-token" },
      }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(compliance);
  });

  it("returns typed error response on backend failure", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({ message: "Backend unavailable" }),
    });

    const req = {
      method: "GET",
      headers: {},
      query: {},
    } as unknown as NextApiRequest;

    const res = createMockRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith({ error: "Backend unavailable" });
  });

  it("rejects non-GET methods", async () => {
    const req = { method: "POST", headers: {}, query: {} } as unknown as NextApiRequest;
    const res = createMockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: "Method not allowed" });
  });
});
