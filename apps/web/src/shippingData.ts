export type ShippingKpi = {
  label: string;
  value: string;
  trend: string;
};

export type ShippingMilestoneStatus = "complete" | "active" | "at-risk" | "pending";

export type ShippingMilestone = {
  id: string;
  title: string;
  location: string;
  plannedTime: string;
  actualTime?: string;
  status: ShippingMilestoneStatus;
  owner: string;
};

export type ShippingRisk = {
  id: string;
  title: string;
  severity: "high" | "medium" | "low";
  impact: string;
  mitigation: string;
};

export type ShippingAction = {
  id: string;
  label: string;
  owner: string;
};

export type MainVoyage = {
  vesselName: string;
  voyageNumber: string;
  carrier: string;
  bookingNumber: string;
  containerNumber: string;
  originPort: string;
  destinationPort: string;
  eta: string;
  status: string;
};

export const shippingKpis: ShippingKpi[] = [
  { label: "On-time confidence", value: "86%", trend: "+4 pts since gate-in" },
  { label: "Containers tracked", value: "42", trend: "40 dry / 2 reefer" },
  { label: "Critical holds", value: "2", trend: "Customs and drayage" },
];

export const mainVoyage: MainVoyage = {
  vesselName: "MV Team4One Star",
  voyageNumber: "Voyage T4O-2605",
  carrier: "Pacific Bridge Line",
  bookingNumber: "BKG-SHA-LAX-2605",
  containerNumber: "Container TCLU-202605",
  originPort: "Shanghai, CNSHA",
  destinationPort: "Los Angeles, USLAX",
  eta: "May 18, 2026 06:00 PDT",
  status: "Sea passage in progress",
};

export const shippingMilestones: ShippingMilestone[] = [
  {
    id: "booking",
    title: "Booking confirmed",
    location: "Shanghai export desk",
    plannedTime: "May 02, 2026 09:30 CST",
    actualTime: "May 02, 2026 09:12 CST",
    status: "complete",
    owner: "Forwarder",
  },
  {
    id: "empty-pickup",
    title: "Empty pickup",
    location: "Waigaoqiao depot",
    plannedTime: "May 03, 2026 14:00 CST",
    actualTime: "May 03, 2026 13:46 CST",
    status: "complete",
    owner: "Truck dispatcher",
  },
  {
    id: "gate-in",
    title: "Gate-in at origin",
    location: "Shanghai Yangshan terminal",
    plannedTime: "May 05, 2026 18:00 CST",
    actualTime: "May 05, 2026 17:38 CST",
    status: "complete",
    owner: "Terminal ops",
  },
  {
    id: "loaded",
    title: "Loaded on vessel",
    location: "MV Ocean Pioneer",
    plannedTime: "May 06, 2026 04:30 CST",
    actualTime: "May 06, 2026 04:44 CST",
    status: "complete",
    owner: "Carrier stowage",
  },
  {
    id: "departure",
    title: "Port departure",
    location: "Shanghai pilot station",
    plannedTime: "May 06, 2026 12:00 CST",
    actualTime: "May 06, 2026 12:27 CST",
    status: "complete",
    owner: "Carrier marine ops",
  },
  {
    id: "sea-passage",
    title: "Ocean transit",
    location: "North Pacific corridor",
    plannedTime: "May 07-16, 2026",
    status: "active",
    owner: "Control tower",
  },
  {
    id: "arrival",
    title: "Arrival at destination",
    location: "Los Angeles, USLAX",
    plannedTime: "May 18, 2026 06:00 PDT",
    status: "pending",
    owner: "Carrier port ops",
  },
  {
    id: "customs",
    title: "Customs clearance",
    location: "US CBP / broker queue",
    plannedTime: "May 18, 2026 14:00 PDT",
    status: "at-risk",
    owner: "Customs broker",
  },
  {
    id: "delivery",
    title: "Final delivery",
    location: "Ontario DC receiving dock",
    plannedTime: "May 19, 2026 10:00 PDT",
    status: "pending",
    owner: "Dray carrier",
  },
];

export const shippingRisks: ShippingRisk[] = [
  {
    id: "typhoon-reroute",
    title: "Typhoon reroute risk",
    severity: "medium",
    impact: "Weather routing may add 6 hours before the North Pacific handoff.",
    mitigation: "Carrier marine ops is holding a safer routing plan for HM review.",
  },
  {
    id: "port-congestion",
    title: "Port congestion watch",
    severity: "medium",
    impact: "LA/LB berth queue may push discharge by 8-12 hours.",
    mitigation: "Keep alternate appointment windows open with the dray carrier.",
  },
  {
    id: "document-gap",
    title: "Customs document gap",
    severity: "high",
    impact: "Commercial invoice HS code mismatch can delay customs release.",
    mitigation: "Broker requested corrected invoice from shipper before arrival.",
  },
];

export const shippingActions: ShippingAction[] = [
  { id: "broker-followup", label: "Confirm corrected customs packet", owner: "Broker" },
  { id: "dray-window", label: "Hold backup delivery appointment", owner: "Dray carrier" },
  { id: "customer-brief", label: "Send ETA exception brief", owner: "Customer success" },
];
