import type { AgentHarness, MemberRole } from "@team4one/shared";
import { Bot, CircleCheck, RadioTower } from "lucide-react";

export type Member = {
  id: string;
  name: string;
  role: MemberRole;
  harness: AgentHarness;
  lane: string;
  status: "online" | "handoff" | "watching";
};

const members: Member[] = [
  {
    id: "brain",
    name: "Ada Control",
    role: "COMMAND_BRAIN",
    harness: "CODEX",
    lane: "Assignment routing",
    status: "online",
  },
  {
    id: "api",
    name: "Backend Pair",
    role: "BACKEND",
    harness: "CLAUDE_CODE",
    lane: "API contracts",
    status: "handoff",
  },
  {
    id: "ui",
    name: "Frontend Pair",
    role: "FRONTEND",
    harness: "CODEX",
    lane: "Workspace shell",
    status: "online",
  },
  {
    id: "qa",
    name: "QA Sentinel",
    role: "QA",
    harness: "OPENCODE",
    lane: "Gate evidence",
    status: "watching",
  },
];

const statusLabel = {
  online: "Online",
  handoff: "Handoff",
  watching: "Watching",
};

const roleLabel: Record<MemberRole, string> = {
  COMMAND_BRAIN: "Command Lead",
  BACKEND: "Backend",
  FRONTEND: "Frontend",
  ALGORITHM: "Algorithm",
  QA: "QA",
};

type MemberRosterProps = {
  members?: Member[];
};

export function MemberRoster({ members: rosterMembers = members }: MemberRosterProps) {
  return (
    <aside className="panel roster" aria-label="Member roster">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Active space</p>
          <h2>Team Roster</h2>
        </div>
        <RadioTower aria-hidden="true" />
      </div>
      <div className="memberList">
        {rosterMembers.map((member) => (
          <article className="memberRow" key={member.id}>
            <div className="memberAvatar" aria-hidden="true">
              <Bot size={18} />
            </div>
            <div className="memberCopy">
              <div className="rowSplit">
                <strong>{member.name}</strong>
                <span className={`statusPill ${member.status}`}>
                  <CircleCheck size={12} aria-hidden="true" />
                  {statusLabel[member.status]}
                </span>
              </div>
              <p>{roleLabel[member.role]} · {member.harness.replace("_", " ")}</p>
              <span>{member.lane}</span>
            </div>
          </article>
        ))}
      </div>
    </aside>
  );
}
