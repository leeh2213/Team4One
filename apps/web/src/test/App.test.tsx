import * as matchers from "@testing-library/jest-dom/matchers";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";

expect.extend(matchers);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("App", () => {
  it("renders the operational workspace", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Project Command Space" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Ship Transportation Control Tower" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Command Brain" })).toBeInTheDocument();
    expect(screen.getByText("Requirements")).toBeInTheDocument();
    expect(screen.getByText("Conversation")).toBeInTheDocument();
    expect(screen.getByText("Release Gate")).toBeInTheDocument();
  });

  it("does not keep static fallback data after the API load fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    render(<App />);

    expect(screen.getByText("Ada Control")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText("Ada Control")).not.toBeInTheDocument();
    });
  });
});
