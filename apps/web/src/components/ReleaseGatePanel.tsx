import { BadgeCheck, CircleDashed, Rocket, ShieldCheck } from "lucide-react";

export type GateState = {
  ciStatus: "PASSED" | "PENDING" | "FAILED";
  testStatus: "PASSED" | "PENDING" | "FAILED";
  commandApprovalStatus: "APPROVED" | "PENDING" | "REJECTED";
  releaseStatus: "READY" | "BLOCKED" | "RELEASED";
};

const defaultGate: GateState = {
  ciStatus: "PASSED",
  testStatus: "PENDING",
  commandApprovalStatus: "PENDING",
  releaseStatus: "BLOCKED",
};

type ReleaseGatePanelProps = {
  gate?: GateState | null;
};

export function ReleaseGatePanel({ gate }: ReleaseGatePanelProps) {
  const visibleGate = gate === undefined ? defaultGate : gate;
  const canRelease =
    visibleGate !== null &&
    visibleGate.ciStatus === "PASSED" &&
    visibleGate.testStatus === "PASSED" &&
    visibleGate.commandApprovalStatus === "APPROVED";

  const gates =
    visibleGate === null
      ? []
      : [
          { label: "CI", state: visibleGate.ciStatus, icon: CircleDashed },
          { label: "QA", state: visibleGate.testStatus, icon: ShieldCheck },
          {
            label: "Command approval",
            state: visibleGate.commandApprovalStatus,
            icon: BadgeCheck,
          },
          { label: "Release", state: visibleGate.releaseStatus, icon: Rocket },
        ];

  return (
    <section className="panel releasePanel" aria-labelledby="release-heading">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Ship controls</p>
          <h2 id="release-heading">Release Gate</h2>
        </div>
        <ShieldCheck aria-hidden="true" />
      </div>
      <div className="gateList">
        {gates.map((gate) => {
          const Icon = gate.icon;
          return (
            <div className="gateRow" key={gate.label}>
              <Icon size={17} aria-hidden="true" />
              <span>{gate.label}</span>
              <strong>{gate.state}</strong>
            </div>
          );
        })}
      </div>
      <button type="button" disabled={!canRelease}>
        Release
      </button>
    </section>
  );
}
