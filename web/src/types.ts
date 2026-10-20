export type Status = 'Created' | 'Posted' | 'Administrative closed' | 'Eliminated';
export type GateState = '' | 'done' | 'wip' | 'risk' | 'deviation' | 'na';
export type Health = 'green' | 'amber' | 'red';
export type IssueStatus = 'WIP' | 'Completed' | 'Overdue';

export const STATUSES: Status[] = ['Created', 'Posted', 'Administrative closed', 'Eliminated'];
export const ACTIVE_STATUSES: Status[] = ['Created', 'Posted'];

export interface HealthOverride {
  health: Health;
  note: string;
  by: string;
  at: string;
}

export interface Project {
  id: string;
  customer: string;
  location: string;
  description: string;
  level: string;
  pm: string;
  startDate: string | null;
  status: Status;
  value: number;
  rbp: number | null;
  poc: number | null;
  invoiced: number | null;
  gates: GateState[];
  handoverSigned: boolean;
  comment: string;
  healthOverride?: HealthOverride | null;
  updatedAt?: string;
}

export interface ResourceRow {
  projectId: string;
  customer: string;
  location: string;
  description: string;
  level: string;
  pm: string;
  status: string;
  phase: string;
  pipingContractor: string;
  electrician: string;
  panelBuilder: string;
  internal: string[];
  claddingContractor: string;
  comment: string;
  handover: string;
}

export interface Issue {
  id: string;
  projectId: string;
  customer: string;
  location: string;
  description: string;
  pm: string;
  issue: string;
  nextSteps: string;
  responsible: string;
  status: IssueStatus;
}

export interface Meta {
  title: string;
  dataAsOf: string | null;
  importedFrom?: string;
  gateNames: string[];
}

export interface AppState {
  meta: Meta;
  projects: Project[];
  resources: ResourceRow[];
  issues: Issue[];
}

export interface HistoryEntry {
  at: string;
  by: string;
  action: string;
  changes: Record<string, [unknown, unknown]>;
}
