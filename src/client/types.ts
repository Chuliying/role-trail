export type Decision = 'review' | 'shortlisted' | 'applied' | 'passed';
export type Page = 'jobs' | 'tasks' | 'research' | 'profile';
export type DetailTab = 'jd' | 'fit' | 'preparation';
export interface View {
  page: Page;
  tab: Decision;
  query: string;
  sort: string;
  sortDirection: string;
  minimum: number;
  limit: number;
}
export interface Fact {
  key?: string;
  label?: string;
  status: string;
  source?: string;
  evidence?: string;
  checkedAt?: string;
}
export interface Assessment {
  score: number;
  reason: string;
  evidence: string[];
  gaps: string[];
  stale?: boolean;
  checkedAt?: string;
  binding?: Record<string, string>;
}
export interface Job {
  id: string;
  company: string;
  title: string;
  description: string;
  descriptionKind: string;
  descriptionCheckedAt?: string;
  source: string;
  url: string;
  searchedAt: string;
  firstSeenAt?: string;
  location?: string;
  remoteMode: string;
  posting: { kind: string; date?: string };
  availability: Fact;
  checks: Fact[];
  expiresAt?: string;
  assessment?: Assessment;
}
export interface Profile {
  name: string;
  targetRoles: string[];
  location: string;
  remotePolicy: string;
  timezone: string;
  languages: string[];
  ownershipPolicy: string;
  platforms?: string[];
  portfolio?: string;
  feeds?: unknown[];
  requiredChecks?: { key: string }[];
}
export interface Capability {
  id: string;
  claim: string;
  tags: string[];
  evidence: string[];
  status: string;
}
export interface Task {
  id: string;
  jobId?: string;
  jobIds?: string[];
  text: string;
  done: boolean;
  acceptance?: unknown;
  dependsOn?: string[];
}
export interface Resume {
  jobId: string;
  version: number;
  content: string;
  adjustments: string[];
  capabilityIds: string[];
  reviewStatus: string;
  jdHash: string;
  pdfHash?: string;
  bindingKind?: string;
  profileHash?: string;
  capabilityHash?: string;
}
export interface Preparation {
  jobId: string;
  version: number;
  content: string;
  evidence: { claim: string; evidence: string[] }[];
  jdHash: string;
  resumeVersion: number;
  resumeContentHash: string;
  bindingKind?: string;
  resumePdfHash?: string;
  capabilityHash?: string;
  capabilityIds: string[];
}
export interface ResumeRequest {
  id: string;
  jobId: string;
  status: string;
  note?: string;
}
export interface Coverage {
  source: string;
  status: string;
  screened?: number;
  fullJd?: number;
  metrics?: { screened?: number; fullJd?: number };
  query?: string;
  note?: string;
  depthKnown?: boolean;
  legacyInspected?: number;
  inspected?: number;
}
export interface Run {
  id: string;
  finishedAt?: string;
  startedAt?: string;
  note?: string;
  coverage: Coverage[];
  archiveHash?: string;
  observations?: unknown[];
}
export interface Workspace {
  schemaVersion: number;
  revision: number;
  profile: Profile | null;
  jobs: Job[];
  reviews: Record<string, { status?: Decision; archived?: boolean }>;
  capabilities: Capability[];
  tasks: Task[];
  resumes: Resume[];
  preparations: Preparation[];
  resumeRequests: ResumeRequest[];
  runs: Run[];
  submissions: { jobId: string }[];
  schedule?: { status: string; time: string; timezone: string; lastResult?: string };
}
export type Action = { type: string; [key: string]: unknown };
export type JsonSave = (value: Record<string, unknown>) => Promise<boolean>;
export interface EditorRequest {
  kind: 'json' | 'jd';
  title: string;
  initial: string;
  save: JsonSave;
}
export interface ResearchBundle {
  run: Run;
  jobs: Partial<Job>[];
}
