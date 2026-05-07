import { GitBranch, Play, Send } from "lucide-react";

export type CommandMetric = {
  label: string;
  value: string;
};

const fallbackMetrics: CommandMetric[] = [
  { label: "Next owner", value: "Frontend Pair" },
  { label: "Current lane", value: "Workspace shell" },
  { label: "Risk level", value: "Low" },
];

type CommandBrainPanelProps = {
  metrics?: CommandMetric[];
};

export function CommandBrainPanel({ metrics = fallbackMetrics }: CommandBrainPanelProps) {
  return (
    <section className="panel commandPanel" aria-labelledby="command-heading">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Coordinator</p>
          <h2 id="command-heading">Command Brain</h2>
        </div>
        <GitBranch aria-hidden="true" />
      </div>
      <div className="metricGrid">
        {metrics.map((item) => (
          <div className="metric" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
      <div className="controlStrip" aria-label="Command brain controls">
        <button type="button">
          <Send size={16} aria-hidden="true" />
          Assign
        </button>
        <button type="button" className="secondaryButton">
          <Play size={16} aria-hidden="true" />
          Run brief
        </button>
      </div>
    </section>
  );
}
