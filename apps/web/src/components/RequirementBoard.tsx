import type { RequirementStatus } from "@team4one/shared";
import { ClipboardList } from "lucide-react";

export type RequirementItem = {
  id: string;
  title: string;
  owner: string;
  status: RequirementStatus;
  evidence?: string;
};

const defaultRequirements: RequirementItem[] = [
  {
    id: "REQ-009",
    title: "Web workspace shell",
    owner: "Frontend Pair",
    status: "IN_PROGRESS",
    evidence: "Render test and static shell",
  },
  {
    id: "REQ-007",
    title: "Authorized realtime joins",
    owner: "Backend Pair",
    status: "CI_PASSED",
    evidence: "Socket room auth verified",
  },
  {
    id: "REQ-006",
    title: "Release gate evidence",
    owner: "QA Sentinel",
    status: "AWAITING_APPROVAL",
    evidence: "Approval audit pending",
  },
];

type RequirementBoardProps = {
  requirements?: RequirementItem[];
};

export function RequirementBoard({ requirements = defaultRequirements }: RequirementBoardProps) {
  return (
    <section className="panel boardPanel" aria-labelledby="requirements-heading">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Delivery board</p>
          <h2 id="requirements-heading">Requirements</h2>
        </div>
        <ClipboardList aria-hidden="true" />
      </div>
      <div className="requirementList">
        {requirements.map((requirement) => (
          <article className="requirementCard" key={requirement.id}>
            <div className="rowSplit">
              <span className="ticket">{requirement.id}</span>
              <span className="state">{requirement.status.replaceAll("_", " ")}</span>
            </div>
            <h3>{requirement.title}</h3>
            {requirement.evidence ? <p>{requirement.evidence}</p> : null}
            <footer>Owner: {requirement.owner}</footer>
          </article>
        ))}
      </div>
    </section>
  );
}
