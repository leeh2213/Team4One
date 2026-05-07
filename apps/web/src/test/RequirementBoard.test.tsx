import * as matchers from "@testing-library/jest-dom/matchers";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RequirementBoard } from "../components/RequirementBoard";

expect.extend(matchers);

describe("RequirementBoard", () => {
  it("renders provided requirement title and status", () => {
    render(
      <RequirementBoard
        requirements={[
          {
            id: "r1",
            title: "Backend API",
            owner: "Backend",
            status: "IN_PROGRESS",
          },
        ]}
      />,
    );

    expect(screen.getByText("Backend API")).toBeInTheDocument();
    expect(screen.getByText("IN PROGRESS")).toBeInTheDocument();
  });
});
