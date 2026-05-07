import { useEffect, useMemo, useState } from "react";
import type { AgentHarness, MemberRole, RequirementStatus } from "@team4one/shared";
import { apiGet } from "./api/client";
import { CommandBrainPanel } from "./components/CommandBrainPanel";
import type { CommandMetric } from "./components/CommandBrainPanel";
import type { ConversationMessage } from "./components/ConversationStream";
import { ConversationStream } from "./components/ConversationStream";
import type { Member } from "./components/MemberRoster";
import { MemberRoster } from "./components/MemberRoster";
import type { GateState } from "./components/ReleaseGatePanel";
import { ReleaseGatePanel } from "./components/ReleaseGatePanel";
import type { RequirementItem } from "./components/RequirementBoard";
import { RequirementBoard } from "./components/RequirementBoard";
import { ShippingTrackerPanel } from "./components/ShippingTrackerPanel";
import { WorkspaceLayout } from "./components/WorkspaceLayout";
import "./styles.css";

const defaultSpaceId = "seed-space-vessel-tracking";
const spaceId = import.meta.env.VITE_SPACE_ID ?? defaultSpaceId;

type SpaceMembership = {
  id: string;
  role: MemberRole;
  user: {
    displayName: string;
  };
  agent: {
    harness: AgentHarness;
    displayName: string;
  } | null;
};

type SpaceRequirement = {
  id: string;
  title: string;
  description: string;
  status: RequirementStatus;
  acceptanceCriteria: string;
  assignedMember: SpaceMembership | null;
  gate: GateState | null;
};

type SpaceMessage = {
  id: string;
  body: string;
  createdAt: string;
  senderMember: SpaceMembership | null;
  senderAgent: {
    displayName: string;
  } | null;
};

type SpaceDetail = {
  memberships: SpaceMembership[];
  requirements: SpaceRequirement[];
  conversations: Array<{
    id: string;
    messages: SpaceMessage[];
  }>;
};

type LoadState = "loading" | "ready" | "failed";

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export function App() {
  const [space, setSpace] = useState<SpaceDetail | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");

  useEffect(() => {
    let active = true;

    apiGet<SpaceDetail>(`/spaces/${spaceId}`)
      .then((loadedSpace) => {
        if (!active) return;
        setSpace(loadedSpace);
        setLoadState("ready");
      })
      .catch(() => {
        if (!active) return;
        setSpace(null);
        setLoadState("failed");
      });

    return () => {
      active = false;
    };
  }, []);

  const members = useMemo<Member[] | undefined>(
    () =>
      space?.memberships.map((membership) => ({
        id: membership.id,
        name: membership.user.displayName,
        role: membership.role,
        harness: membership.agent?.harness ?? "OTHER",
        lane: membership.agent?.displayName ?? "Project coordination",
        status: membership.role === "COMMAND_BRAIN" ? "online" : "handoff",
      })),
    [space],
  );

  const requirements = useMemo<RequirementItem[] | undefined>(
    () =>
      space?.requirements.map((requirement) => ({
        id: requirement.id,
        title: requirement.title,
        owner: requirement.assignedMember?.user.displayName ?? "Unassigned",
        status: requirement.status,
        evidence: requirement.acceptanceCriteria,
      })),
    [space],
  );

  const messages = useMemo<ConversationMessage[] | undefined>(
    () =>
      space?.conversations.flatMap((conversation) =>
        conversation.messages.map((message) => ({
          id: message.id,
          author:
            message.senderMember?.user.displayName ??
            message.senderAgent?.displayName ??
            "System",
          time: formatMessageTime(message.createdAt),
          body: message.body,
        })),
      ),
    [space],
  );

  const commandMetrics = useMemo<CommandMetric[] | undefined>(() => {
    if (!space) return undefined;

    const activeRequirement =
      space.requirements.find((requirement) => requirement.status !== "RELEASED") ??
      space.requirements[0];

    if (!activeRequirement) {
      return [
        { label: "Next owner", value: "Unassigned" },
        { label: "Current lane", value: "No active requirement" },
        { label: "Risk level", value: "Low" },
      ];
    }

    return [
      {
        label: "Next owner",
        value: activeRequirement.assignedMember?.user.displayName ?? "Unassigned",
      },
      { label: "Current lane", value: activeRequirement.title },
      {
        label: "Risk level",
        value: activeRequirement.gate?.releaseStatus === "BLOCKED" ? "Gate blocked" : "Low",
      },
    ];
  }, [space]);

  const releaseGate = space?.requirements.find((requirement) => requirement.gate)?.gate;
  const isLoading = loadState === "loading";

  return (
    <WorkspaceLayout
      roster={<MemberRoster members={isLoading ? undefined : (members ?? [])} />}
      command={
        <>
          <ShippingTrackerPanel />
          <CommandBrainPanel metrics={isLoading ? undefined : (commandMetrics ?? [])} />
        </>
      }
      board={<RequirementBoard requirements={isLoading ? undefined : (requirements ?? [])} />}
      conversation={<ConversationStream messages={isLoading ? undefined : (messages ?? [])} />}
      releaseGate={<ReleaseGatePanel gate={isLoading ? undefined : (releaseGate ?? null)} />}
    />
  );
}
