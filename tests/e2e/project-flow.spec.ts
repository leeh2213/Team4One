import { expect, test } from "@playwright/test";

test("loads the seeded project command space", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Team4One", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Project Command Space" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Ship Transportation Control Tower" }),
  ).toBeVisible();
  await expect(page.getByText("MV Team4One Star / Voyage T4O-2605")).toBeVisible();
  await expect(page.getByText("Container TCLU-202605")).toBeVisible();
  await expect(page.getByText("Shanghai, CNSHA")).toBeVisible();
  await expect(page.getByText("Destination: Los Angeles, USLAX")).toBeVisible();
  await expect(page.getByText("Port departure")).toBeVisible();
  await expect(page.getByText("Ocean transit")).toBeVisible();
  await expect(page.getByText("Customs clearance")).toBeVisible();
  await expect(page.getByText("Final delivery")).toBeVisible();
  await expect(page.getByText("Typhoon reroute risk")).toBeVisible();
  await expect(page.getByText("Port congestion watch")).toBeVisible();

  await expect(page.getByLabel("Member roster").getByText("HM Command")).toBeVisible();
  await expect(page.getByLabel("Member roster").getByText("Fiona Frontend")).toBeVisible();
  await expect(
    page.getByLabel("Member roster").getByText("Frontend Control Tower Agent"),
  ).toBeVisible();
  await expect(page.getByLabel("Member roster").getByText("Dylan Data")).toBeVisible();
  await expect(page.getByLabel("Member roster").getByText("Backend Data Agent")).toBeVisible();
  await expect(page.getByLabel("Member roster").getByText("Ari Algorithm")).toBeVisible();
  await expect(
    page.getByLabel("Member roster").getByText("ETA Risk Algorithm Agent"),
  ).toBeVisible();
  await expect(page.getByLabel("Member roster").getByText("Quinn QA")).toBeVisible();
  await expect(page.getByLabel("Member roster").getByText("QA Acceptance Agent")).toBeVisible();

  await expect(
    page.getByRole("region", { name: "Command Brain" }).getByText("Fiona Frontend"),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Command Brain" }).getByText("Build vessel tracking dashboard"),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Build vessel tracking dashboard" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Seed shipment event data" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Calculate ETA and risk score" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Verify full-flow shipping journey" })).toBeVisible();

  await expect(
    page.getByText(/HM assigned: Team4One is now the collaboration hub/),
  ).toBeVisible();
  await expect(page.getByText(/Frontend Control Tower Agent: dashboard shell/)).toBeVisible();
  await expect(page.getByText(/Backend Data Agent: shipment data now covers/)).toBeVisible();
  await expect(page.getByText(/ETA Risk Algorithm Agent: ETA drift and risk score/)).toBeVisible();
  await expect(page.getByText(/QA Acceptance Agent: E2E gate plan/)).toBeVisible();

  const releaseGate = page.getByRole("region", { name: "Release Gate" });
  await expect(releaseGate).toBeVisible();
  await expect(releaseGate.getByText("CI")).toBeVisible();
  await expect(releaseGate.getByText("QA")).toBeVisible();
  await expect(releaseGate.getByText("Command approval")).toBeVisible();
  await expect(releaseGate.getByText("Release").first()).toBeVisible();
  await expect(releaseGate.getByText("PASSED").first()).toBeVisible();
  await expect(releaseGate.getByText("BLOCKED").first()).toBeVisible();
});
