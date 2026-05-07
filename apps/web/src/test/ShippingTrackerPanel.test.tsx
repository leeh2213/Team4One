import * as matchers from "@testing-library/jest-dom/matchers";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ShippingTrackerPanel } from "../components/ShippingTrackerPanel";

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

describe("ShippingTrackerPanel", () => {
  it("renders the shipment control tower summary", () => {
    render(<ShippingTrackerPanel />);

    expect(
      screen.getByRole("heading", { name: "Ship Transportation Control Tower" }),
    ).toBeInTheDocument();
    expect(screen.getByText("MV Team4One Star / Voyage T4O-2605")).toBeInTheDocument();
    expect(screen.getByText("Shanghai, CNSHA")).toBeInTheDocument();
    expect(screen.getByText("Los Angeles, USLAX")).toBeInTheDocument();
    expect(screen.getByText("ETA May 18, 2026 06:00 PDT")).toBeInTheDocument();
    expect(screen.getByText("Container TCLU-202605")).toBeInTheDocument();
  });

  it("shows the full transportation milestone chain and risk alerts", () => {
    render(<ShippingTrackerPanel />);

    [
      "Booking confirmed",
      "Empty pickup",
      "Gate-in at origin",
      "Loaded on vessel",
      "Port departure",
      "Ocean transit",
      "Arrival at destination",
      "Customs clearance",
      "Final delivery",
    ].forEach((milestone) => {
      expect(screen.getByText(milestone)).toBeInTheDocument();
    });

    expect(screen.getByText("Risk alerts")).toBeInTheDocument();
    expect(screen.getByText("Typhoon reroute risk")).toBeInTheDocument();
    expect(screen.getByText("Port congestion watch")).toBeInTheDocument();
    expect(screen.getByText("Customs document gap")).toBeInTheDocument();
  });
});
