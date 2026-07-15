// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VulyoProvider, type VulyoUser } from "../provider.js";
import { Protect } from "./protect.js";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const user: VulyoUser = {
  id: "user_test",
  appId: "app_test",
  appInstanceId: "ins_test",
  displayName: null,
  email: "person@example.com",
  emailVerified: true,
};

describe("Protect", () => {
  it("uses the authoritative first-party session entitlements without a browser API request", () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);

    render(
      <VulyoProvider
        publishableKey="pk_test"
        initialState={{ appConfig: null, entitlements: { features: ["advanced_reports"], plan: "pro" }, user }}
      >
        <Protect feature="advanced_reports" fallback={<p>Upgrade</p>}>
          <p>Reports</p>
        </Protect>
      </VulyoProvider>,
    );

    expect(screen.getByText("Reports")).toBeTruthy();
    expect(screen.queryByText("Upgrade")).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("fails closed when the session does not include the requested feature", () => {
    render(
      <VulyoProvider
        publishableKey="pk_test"
        initialState={{ appConfig: null, entitlements: { features: [], plan: null }, user }}
      >
        <Protect feature="advanced_reports" fallback={<p>Upgrade</p>}>
          <p>Reports</p>
        </Protect>
      </VulyoProvider>,
    );

    expect(screen.getByText("Upgrade")).toBeTruthy();
    expect(screen.queryByText("Reports")).toBeNull();
  });
});
