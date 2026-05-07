import * as matchers from "@testing-library/jest-dom/matchers";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReleaseGatePanel } from "../components/ReleaseGatePanel";

expect.extend(matchers);

describe("ReleaseGatePanel", () => {
  it("enables release when all required gates have passed", () => {
    render(
      <ReleaseGatePanel
        gate={{
          ciStatus: "PASSED",
          testStatus: "PASSED",
          commandApprovalStatus: "APPROVED",
          releaseStatus: "READY",
        }}
      />,
    );

    expect(screen.getByRole("button", { name: "Release" })).toBeEnabled();
  });
});
