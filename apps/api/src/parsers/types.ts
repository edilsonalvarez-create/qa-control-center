export type ColumnRole =
  | "externalId"
  | "title"
  | "description"
  | "status"
  | "module"
  | "project"
  | "product"
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
  | "expectedIntegration"
  | "actual"
  | "functionality"
  | "level"
  | "automatable"
  | "tool"
  | "preconditions"
  | "testData"
  | "cycle"
  | "reviewedBy"
  | "observations"
  | "evidenceUrl"
  | "requirementRef"
  | "sprint"
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
  product?: string;
  tester?: string;
  date?: string;
  severity?: string;
  priority?: string;
  type?: string;
  environment?: string;
  version?: string;
  commit?: string;
  expected?: string;
  expectedIntegration?: string;
  actual?: string;
  functionality?: string;
  level?: string;
  automatable?: string;
  tool?: string;
  preconditions?: string;
  testData?: string;
  steps?: string;
  cycle?: string;
  reviewedBy?: string;
  observations?: string;
  evidenceUrl?: string;
  requirementRef?: string;
  sprint?: string;
  fingerprint: string;
};

export type CatalogItemParsed = {
  category: string;
  value: string;
  sortOrder: number;
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
  catalog?: CatalogItemParsed[];
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
