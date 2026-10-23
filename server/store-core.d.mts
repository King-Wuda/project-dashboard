// Types for the browser-side use of the shared data rules (the implementation is plain JavaScript).
/* eslint-disable @typescript-eslint/no-explicit-any */
export class ValidationError extends Error {}
export function decodeEditor(header: unknown): string;
export function validateDoc(raw: unknown): any;
export class StoreCore {
  constructor(doc: any, persist?: (doc: any) => void);
  doc: any;
  state(): any;
  history(entity: string, id: string): any[];
  patchProject(id: string, body: unknown, by: string): any;
  createProject(body: unknown, by: string): any;
  patchIssue(id: string, body: unknown, by: string): any;
  createIssue(body: unknown, by: string): any;
  deleteIssue(id: string, by: string): boolean;
  setDataAsOf(date: unknown, by: string): any;
}
