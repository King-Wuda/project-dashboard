// Generates demo/seed.demo.json: a synthetic, deterministic dataset with the same shape as the real import.
// Nothing here comes from real customers. Run: node scripts/make-demo.mjs
import { writeFileSync } from 'node:fs';

let seed = 20261020;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const between = (lo, hi) => lo + rnd() * (hi - lo);

const customers = ['Northfield Dairy', 'Bluewater Fisheries', 'Karoo Meat Co', 'Summit Beverages', 'Harbour Cold Storage',
  'Evergreen Produce', 'Atlas Poultry', 'Coastal Brewing', 'Meridian Foods', 'Highveld Bakeries', 'Riverbend Pork', 'Sable Logistics'];
const places = ['Cape Town', 'Durban', 'Gqeberha', 'Polokwane', 'Bloemfontein', 'Windhoek', 'Harare', 'Lusaka', 'Johannesburg', ''];
const pms = ['Alex Morgan', 'Sam Ndlovu', 'Priya Naidoo', 'Jordan Pillay', 'Casey van Wyk', 'Robin Mokoena'];
const works = ['Compressor replacement', 'Condenser upgrade', 'Valve station retrofit', 'New plant room', 'Freezer expansion',
  'Glycol system replacement', 'Control panel retrofit', 'Chiller package', 'Evaporator replacement', 'Heat recovery system'];
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const risky = ['Customer delays on site access', 'Waiting for customer deposit', 'Equipment delayed, ETA end of month',
  'Issue with plinth, vibration risk to be assessed', 'Snags pending, commissioning complete'];
const calm = ['Installation WIP', 'Equipment on order', 'Design complete, orders placed', 'Hand over document to be issued',
  'Shutdown planned, commissioning to follow', ''];

const projects = [];
const statuses = [
  ...Array(34).fill('Eliminated'), ...Array(14).fill('Administrative closed'),
  ...Array(26).fill('Posted'), ...Array(6).fill('Created'),
];
statuses.forEach((status, i) => {
  const level = pick(['L1', 'L1', 'L1', 'L2', 'L2', 'L3']);
  const value = Math.round(level === 'L1' ? between(0.2e6, 3e6) : level === 'L2' ? between(3e6, 30e6) : between(30e6, 90e6));
  const closed = status === 'Eliminated' || status === 'Administrative closed';
  const active = !closed;
  let poc = closed ? 1 : status === 'Created' ? 0 : Math.round(between(0.05, 1) * 100) / 100;
  let invoiced = closed ? 1 : Math.max(0, Math.min(1, poc - between(0, 0.4)));
  invoiced = Math.round(invoiced * 100) / 100;
  const filled = closed || rnd() > 0.35;
  const stage = closed ? 7 : Math.min(7, Math.floor(poc * 7) + (status === 'Created' ? 1 : 2));
  const gates = Array.from({ length: 7 }, (_, g) => (!filled ? '' : g < stage - 1 ? 'done' : g === stage - 1 ? (closed ? 'done' : 'wip') : ''));
  const yy = 24 + Math.floor(rnd() * 3);
  projects.push({
    id: `${String(10000 + i * 37).padStart(5, '0')}-${String(1 + (i % 9)).padStart(3, '0')}-1-01`,
    customer: pick(customers), location: pick(places),
    description: `${pick(works)} - ${pick(months)} ${yy}`,
    level, pm: pick(pms), startDate: rnd() > 0.7 ? `20${yy}-0${1 + Math.floor(rnd() * 9)}-01` : null,
    status, value, rbp: Math.round(between(0.06, 0.28) * 10000) / 10000, poc, invoiced, gates,
    handoverSigned: closed && rnd() > 0.4,
    comment: active ? pick(rnd() > 0.7 ? risky : calm) : pick(['Hand over complete, to be eliminated', 'Project to be closed', '']),
  });
});
// A few deliberate edge cases so every dashboard list has something to show.
Object.assign(projects[48], { poc: 1, invoiced: 1, comment: 'Everything delivered and paid' }); // ready to close
Object.assign(projects[49], { poc: 0.95, invoiced: 0.5, value: 12_400_000 });                 // cash risk
Object.assign(projects[50], { rbp: 0.04 });                                                     // margin risk

const resources = [
  { projectId: projects[48 + 5].id, customer: projects[53].customer, location: 'Cape Town', description: projects[53].description, level: 'L2',
    pm: pms[0], status: 'Posted', phase: 'Mechanical installation', pipingContractor: 'Contractor A', electrician: 'Contractor B',
    panelBuilder: '', internal: ['Stevie'], claddingContractor: 'Contractor C', comment: 'WIP', handover: "Q4 '26" },
  { projectId: projects[54].id, customer: projects[54].customer, location: 'Durban', description: projects[54].description, level: 'L2',
    pm: pms[1], status: 'Posted', phase: 'Commissioning', pipingContractor: 'Contractor A', electrician: 'Contractor D',
    panelBuilder: 'Panel Co', internal: [], claddingContractor: '', comment: 'Customer delays', handover: "Q1 '27" },
  { projectId: '', customer: 'Prospect Foods', location: 'Windhoek', description: 'New plant', level: 'L2', pm: pms[2], status: '',
    phase: 'Pre project phase', pipingContractor: 'Contractor E', electrician: '', panelBuilder: 'Panel Co', internal: ['Miguel'],
    claddingContractor: 'Contractor C', comment: 'Awaiting order', handover: "Q3 '27" },
];

const issues = [
  { id: 'I-1', projectId: projects[50].id, customer: projects[50].customer, location: projects[50].location, description: projects[50].description,
    pm: projects[50].pm, issue: 'Settlement to be negotiated with customer', nextSteps: 'Negotiate settlement', responsible: 'Alex / Sam', status: 'WIP', dueDate: '2026-11-20' },
  { id: 'I-2', projectId: projects[49].id, customer: projects[49].customer, location: projects[49].location, description: projects[49].description,
    pm: projects[49].pm, issue: 'Payments outstanding', nextSteps: 'Follow up with finance', responsible: 'Priya', status: 'WIP', dueDate: '2026-10-05' },
  { id: 'I-3', projectId: projects[44].id, customer: projects[44].customer, location: projects[44].location, description: projects[44].description,
    pm: projects[44].pm, issue: 'VO not yet approved', nextSteps: 'Write-down provision and close', responsible: 'Jordan', status: 'Completed', dueDate: '2026-09-30' },
];

writeFileSync(new URL('../demo/seed.demo.json', import.meta.url), JSON.stringify({
  meta: { title: 'Project Dashboard (demo data)', dataAsOf: '2026-10-20', importedFrom: 'synthetic demo',
    gateNames: ['Opportunity qualified', 'Binding quotation', 'Project initiation', 'Kick-off / orders / manufacturing',
      'Project planning / installation', 'Commissioning', 'Snags / handover'] },
  projects, resources, issues,
}, null, 1));
console.log(`demo: ${projects.length} projects`);
