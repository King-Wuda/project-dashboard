import type { Health, Project } from '../types';

/** Thresholds for the calculated health. Tune here; nothing else hard-codes them. */
export const HEALTH_RULES = {
  redMargin: 0.1,
  amberMargin: 0.12,
  redInvoiceLag: 0.3,
  amberInvoiceLag: 0.15,
  riskWords: /\b(delay\w*|pending|waiting|await\w*|funds|cash ?flow|overdue|late|issues?|hse|permit|shortage|dispute|claim\w*|penalt\w*|on hold|postpone\w*|stopped)\b/gi,
};

export interface Reason {
  level: 'red' | 'amber';
  text: string;
}

export interface Assessment {
  calculated: Health | null;
  effective: Health | null;
  overridden: boolean;
  reasons: Reason[];
}

export const isArchived = (p: Pick<Project, 'status'>) => p.status === 'Administrative closed' || p.status === 'Eliminated';

/** Progress (POC) minus invoiced share, floored at 0: work done but not yet billed. */
export function invoiceLag(p: Pick<Project, 'poc' | 'invoiced'>): number {
  if (p.poc == null || p.invoiced == null) return 0;
  return Math.max(0, p.poc - p.invoiced);
}

/** Contract value of work completed but not yet invoiced. */
export const unbilled = (p: Pick<Project, 'poc' | 'invoiced' | 'value'>) => invoiceLag(p) * p.value;

/** Fully delivered and fully invoiced but still open in SAP. */
export const readyToClose = (p: Project) =>
  !isArchived(p) && (p.poc ?? 0) >= 0.999 && (p.invoiced ?? 0) >= 0.999;

const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;

export function assess(p: Project, gateNames: string[] = []): Assessment {
  if (isArchived(p)) return { calculated: null, effective: null, overridden: false, reasons: [] };
  const R = HEALTH_RULES;
  const reasons: Reason[] = [];

  if (p.rbp != null) {
    if (p.rbp < R.redMargin) reasons.push({ level: 'red', text: `RBP ${pct(p.rbp)} is below ${pct(R.redMargin)}` });
    else if (p.rbp < R.amberMargin) reasons.push({ level: 'amber', text: `RBP ${pct(p.rbp)} is below ${pct(R.amberMargin)}` });
  }

  const lag = invoiceLag(p);
  if (lag >= R.redInvoiceLag) reasons.push({ level: 'red', text: `Invoicing is ${Math.round(lag * 100)} pts behind progress` });
  else if (lag >= R.amberInvoiceLag) reasons.push({ level: 'amber', text: `Invoicing is ${Math.round(lag * 100)} pts behind progress` });

  p.gates.forEach((g, i) => {
    const name = gateNames[i] ?? `Gate ${i + 1}`;
    if (g === 'deviation') reasons.push({ level: 'red', text: `${name}: deviation` });
    else if (g === 'risk') reasons.push({ level: 'amber', text: `${name}: off track` });
  });

  const words = [...new Set([...(p.comment.match(R.riskWords) ?? [])].map((w) => w.toLowerCase()))];
  if (words.length) reasons.push({ level: 'amber', text: `Comment mentions "${words.slice(0, 3).join('", "')}"` });

  const calculated: Health = reasons.some((r) => r.level === 'red') ? 'red' : reasons.length ? 'amber' : 'green';
  const ov = p.healthOverride;
  return { calculated, effective: ov?.health ?? calculated, overridden: !!ov && ov.health !== calculated, reasons };
}

/** Lifecycle position of an open project: a gate index, or one of the two special stages. */
export type Stage = number | 'untracked' | 'complete';

export function currentStage(p: Project): Stage {
  const tracked = p.gates.some((g) => g !== '' && g !== 'na');
  if (!tracked) return 'untracked';
  let lastActive = -1;
  p.gates.forEach((g, i) => { if (g === 'wip' || g === 'risk' || g === 'deviation') lastActive = i; });
  if (lastActive >= 0) return lastActive;
  const next = p.gates.findIndex((g) => g === '');
  return next === -1 ? 'complete' : next;
}
