import { afterEach, describe, expect, it, vi } from "vitest";
import { registerAnalyticsHandler, track } from "@/lib/analytics";

afterEach(() => vi.unstubAllGlobals());

describe("track", () => {
  it("is a no-op on the server", () => {
    const handler = vi.fn();
    const off = registerAnalyticsHandler(handler);
    track("pricing_viewed");
    expect(handler).not.toHaveBeenCalled();
    off();
  });

  it("fans out to handlers and dispatches a DOM event; a failing handler never throws", () => {
    const dispatchEvent = vi.fn();
    vi.stubGlobal("window", { dispatchEvent });
    const good = vi.fn();
    const offBad = registerAnalyticsHandler(() => {
      throw new Error("vendor down");
    });
    const offGood = registerAnalyticsHandler(good);

    expect(() => track("hero_cta_clicked", { cta: "validate_my_idea" })).not.toThrow();
    expect(good).toHaveBeenCalledWith("hero_cta_clicked", { cta: "validate_my_idea" });
    expect(dispatchEvent).toHaveBeenCalledOnce();
    expect((dispatchEvent.mock.calls[0][0] as CustomEvent).type).toBe("validme:analytics");

    offBad();
    offGood();
    track("pricing_viewed");
    expect(good).toHaveBeenCalledTimes(1);
  });
});

describe("trackingAllowed", () => {
  it("honours Global Privacy Control and Do Not Track", async () => {
    const { trackingAllowed } = await import("@/lib/analytics");
    expect(trackingAllowed({ doNotTrack: null })).toBe(true);
    expect(trackingAllowed({ globalPrivacyControl: true })).toBe(false);
    expect(trackingAllowed({ doNotTrack: "1" })).toBe(false);
    expect(trackingAllowed(undefined)).toBe(false);
  });
});
