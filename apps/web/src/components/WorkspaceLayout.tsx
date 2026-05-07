import type { ReactNode } from "react";
import { Activity, Clock3 } from "lucide-react";

export function WorkspaceLayout(props: {
  roster: ReactNode;
  command: ReactNode;
  board: ReactNode;
  conversation: ReactNode;
  releaseGate: ReactNode;
}) {
  return (
    <div className="workspaceShell">
      <header className="topBar">
        <div>
          <p className="eyebrow">Team4One</p>
          <h1>Project Command Space</h1>
        </div>
        <div className="topBarMeta" aria-label="Workspace status">
          <span>
            <Activity size={16} aria-hidden="true" />
            Live sync
          </span>
          <span>
            <Clock3 size={16} aria-hidden="true" />
            Sprint day 9
          </span>
        </div>
      </header>

      <main className="workspaceGrid">
        {props.roster}
        <div className="primaryColumn">
          {props.command}
          {props.board}
        </div>
        <div className="secondaryColumn">
          {props.conversation}
          {props.releaseGate}
        </div>
      </main>
    </div>
  );
}
