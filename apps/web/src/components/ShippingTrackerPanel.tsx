import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Container,
  FileCheck2,
  MapPin,
  Navigation,
  Ship,
  Truck,
} from "lucide-react";
import {
  mainVoyage,
  shippingActions,
  shippingKpis,
  shippingMilestones,
  shippingRisks,
  type ShippingMilestoneStatus,
} from "../shippingData";

const statusLabels: Record<ShippingMilestoneStatus, string> = {
  complete: "Complete",
  active: "In motion",
  "at-risk": "At risk",
  pending: "Pending",
};

function milestoneIcon(status: ShippingMilestoneStatus) {
  if (status === "complete") return <CheckCircle2 size={18} aria-hidden="true" />;
  if (status === "active") return <Navigation size={18} aria-hidden="true" />;
  if (status === "at-risk") return <AlertTriangle size={18} aria-hidden="true" />;
  return <Clock3 size={18} aria-hidden="true" />;
}

export function ShippingTrackerPanel() {
  return (
    <section className="panel shippingTrackerPanel" aria-labelledby="shipping-tracker-heading">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Shipment operations</p>
          <h2 id="shipping-tracker-heading">Ship Transportation Control Tower</h2>
        </div>
        <Ship aria-hidden="true" />
      </div>

      <div className="metricGrid" aria-label="Shipment KPIs">
        {shippingKpis.map((kpi) => (
          <div className="metric" key={kpi.label}>
            <span>{kpi.label}</span>
            <strong>{kpi.value}</strong>
            <span>{kpi.trend}</span>
          </div>
        ))}
      </div>

      <div className="requirementList" aria-label="Voyage summary">
        <article className="requirementCard">
          <span className="ticket">Vessel / voyage</span>
          <h3>
            {mainVoyage.vesselName} / {mainVoyage.voyageNumber}
          </h3>
          <p>{mainVoyage.carrier}</p>
          <footer>{mainVoyage.status}</footer>
        </article>

        <article className="requirementCard">
          <span className="ticket">Route</span>
          <h3>
            <MapPin size={16} aria-hidden="true" /> {mainVoyage.originPort}
          </h3>
          <p>
            Destination: <span>{mainVoyage.destinationPort}</span>
          </p>
          <footer>ETA {mainVoyage.eta}</footer>
        </article>

        <article className="requirementCard">
          <span className="ticket">Shipment refs</span>
          <h3>{mainVoyage.containerNumber}</h3>
          <p>Booking: {mainVoyage.bookingNumber}</p>
          <footer>Carrier controlled ocean leg</footer>
        </article>
      </div>

      <div className="gateList" aria-label="Milestone timeline">
        {shippingMilestones.map((milestone) => (
          <div className="gateRow" key={milestone.id}>
            {milestoneIcon(milestone.status)}
            <span>{milestone.title}</span>
            <strong>
              {statusLabels[milestone.status]} · {milestone.location} ·{" "}
              {milestone.actualTime ?? milestone.plannedTime}
            </strong>
          </div>
        ))}
      </div>

      <div className="panelHeader" style={{ marginTop: 14 }}>
        <div>
          <p className="eyebrow">Exception desk</p>
          <h2>Risk alerts</h2>
        </div>
        <AlertTriangle aria-hidden="true" />
      </div>

      <div className="requirementList" aria-label="Risk alerts">
        {shippingRisks.map((risk) => (
          <article className="requirementCard" key={risk.id}>
            <span className="state">{risk.severity.toUpperCase()}</span>
            <h3>{risk.title}</h3>
            <p>{risk.impact}</p>
            <footer>{risk.mitigation}</footer>
          </article>
        ))}
      </div>

      <div className="controlStrip" aria-label="Shipment actions">
        {shippingActions.map((action, index) => (
          <button
            className={index === 0 ? undefined : "secondaryButton"}
            key={action.id}
            type="button"
            title={action.owner}
          >
            {index === 0 ? (
              <FileCheck2 size={16} aria-hidden="true" />
            ) : index === 1 ? (
              <Truck size={16} aria-hidden="true" />
            ) : (
              <Container size={16} aria-hidden="true" />
            )}
            {action.label}
          </button>
        ))}
      </div>
    </section>
  );
}
