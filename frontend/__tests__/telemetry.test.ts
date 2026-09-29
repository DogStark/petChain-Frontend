/**
 * Tests for the data-classification-aware telemetry wrapper.
 *
 * Covers issue #948 acceptance criteria:
 * - No analytics event is emitted before consent where consent is required.
 * - Inputs, text, URLs, wallet addresses, pet identifiers, health values,
 *   and maps are excluded or masked by default.
 * - Emergency and authentication pages opt out of session replay entirely.
 * - Consent withdrawal stops future collection and clears queued events.
 */
import {
  Telemetry,
  classifyField,
  redactPayload,
  isReplayOptOutPath,
  SENSITIVE_CLASSIFICATIONS,
} from "../src/telemetry";

describe("classifyField", () => {
  it("classifies sensitive field names by data classification", () => {
    expect(classifyField("walletAddress")).toBe("wallet");
    expect(classifyField("petId")).toBe("pet");
    expect(classifyField("heartRate")).toBe("health");
    expect(classifyField("latitude")).toBe("location");
    expect(classifyField("mapCenter")).toBe("map");
    expect(classifyField("email")).toBe("input");
    expect(classifyField("notes")).toBe("text");
    expect(classifyField("callbackUrl")).toBe("url");
  });

  it("treats unknown fields as non-sensitive", () => {
    expect(classifyField("screenName")).toBeNull();
  });
});

describe("redactPayload", () => {
  it("masks sensitive fields by default", () => {
    const redacted = redactPayload({
      event: "checkout",
      walletAddress: "0xabc123",
      petId: "pet-42",
      heartRate: 88,
      latitude: 51.5,
      mapCenter: { lat: 1, lng: 2 },
      email: "a@b.com",
      notes: "private note",
      callbackUrl: "https://example.com/cb",
    });

    expect(redacted.event).toBe("checkout");
    for (const key of [
      "walletAddress",
      "petId",
      "heartRate",
      "latitude",
      "mapCenter",
      "email",
      "notes",
      "callbackUrl",
    ]) {
      expect(redacted[key]).toBe("[redacted]");
    }
  });

  it("redacts nested sensitive fields", () => {
    const redacted = redactPayload({
      context: { walletAddress: "0xdeadbeef", screen: "home" },
    });
    expect(redacted.context.walletAddress).toBe("[redacted]");
    expect(redacted.context.screen).toBe("home");
  });

  it("exposes the sensitive classification set", () => {
    expect(SENSITIVE_CLASSIFICATIONS).toContain("wallet");
    expect(SENSITIVE_CLASSIFICATIONS).toContain("health");
    expect(SENSITIVE_CLASSIFICATIONS).toContain("map");
  });
});

describe("isReplayOptOutPath", () => {
  it("opts emergency and authentication pages out of session replay", () => {
    expect(isReplayOptOutPath("/emergency")).toBe(true);
    expect(isReplayOptOutPath("/emergency/triage")).toBe(true);
    expect(isReplayOptOutPath("/auth/login")).toBe(true);
    expect(isReplayOptOutPath("/login")).toBe(true);
    expect(isReplayOptOutPath("/signin")).toBe(true);
  });

  it("allows replay on ordinary pages", () => {
    expect(isReplayOptOutPath("/dashboard")).toBe(false);
  });
});

describe("Telemetry consent gating", () => {
  const makeTelemetry = () => {
    const sink = jest.fn();
    const telemetry = new Telemetry({ sink });
    return { telemetry, sink };
  };

  it("does not emit analytics before consent is granted", () => {
    const { telemetry, sink } = makeTelemetry();
    telemetry.track("page_view", { screen: "home" });
    expect(sink).not.toHaveBeenCalled();
  });

  it("emits redacted events after consent is granted", () => {
    const { telemetry, sink } = makeTelemetry();
    telemetry.setConsent(true);
    telemetry.track("page_view", { screen: "home", walletAddress: "0xabc" });
    expect(sink).toHaveBeenCalledTimes(1);
    expect(sink.mock.calls[0][1].walletAddress).toBe("[redacted]");
  });

  it("stops future collection and clears queued events on withdrawal", () => {
    const { telemetry, sink } = makeTelemetry();
    telemetry.setConsent(true);
    telemetry.track("queued", { screen: "home" });
    telemetry.setConsent(false);
    telemetry.track("after_withdrawal", { screen: "home" });
    expect(sink).toHaveBeenCalledTimes(1);
    expect(telemetry.queuedEventCount()).toBe(0);
  });

  it("disables session replay on opt-out paths", () => {
    const { telemetry } = makeTelemetry();
    telemetry.setConsent(true);
    telemetry.setPath("/emergency");
    expect(telemetry.isReplayEnabled()).toBe(false);
    telemetry.setPath("/dashboard");
    expect(telemetry.isReplayEnabled()).toBe(true);
  });
});
