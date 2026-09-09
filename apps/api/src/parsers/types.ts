export type ColumnRole =
  | "externalId"
  | "title"
  | "description"
  | "status"
  | "module"
  | "project"
  | "tester"
  | "date"
  | "severity"
  | "priority"
  | "type"
  | "environment"
  | "version"
  | "commit"
  | "steps"
  | "expected"
  | "actual"
  | "ignore";

export type HeaderMapping = {
  index: number;
  header: string;
  role: ColumnRole;
  confidence: number;
};

export type ParsedCase = {
  externalId?: string;
  title: string;
  description?: string;
  status: string;
  module?: string;
  project?: string;
  tester?: string;
  date?: string;
  severity?: string;
  priority?: string;
  type?: string;
  environment?: string;
  version?: string;
  commit?: string;
  expected?: string;
  actual?: string;
  fingerprint: string;
};

export type NarrativeMetrics = {
  totalTests?: number;
  passed?: number;
  failed?: number;
  blocked?: number;
  skipped?: number;
  source: string;
};

export type ParseWarning = {
  code: string;
  message: string;
  field?: string;
};

export type ParseResult = {
  fileType: string;
  detectedProject?: string;
  detectedModule?: string;
  detectedTester?: string;
  detectedEnvironment?: string;
  detectedDate?: string;
  testType?: string;
  headers: HeaderMapping[];
  cases: ParsedCase[];
  metrics?: NarrativeMetrics;
  observations?: string;
  defects: Array<{
    title: string;
    description?: string;
    severity: string;
    relatedCaseTitle?: string;
  }>;
  warnings: ParseWarning[];
  textExcerpt?: string;
};
