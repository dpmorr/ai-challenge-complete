export interface TriageCondition {
  field: string;
  operator: 'equals' | 'contains';
  value: string;
}

export interface TriageRule {
  id: string;
  name: string;
  conditions: TriageCondition[];
  assignee: string;
  priority: number;
  enabled: boolean;
}

export interface ExtractedInfo {
  requestType?: string;
  location?: string;
  department?: string;
  isDocumentQuestion?: boolean;
  [key: string]: string | boolean | undefined;
}

export interface TriageState {
  extractedInfo: ExtractedInfo;
  assignedTo?: string;
  isComplete: boolean;
  needsMoreInfo: boolean;
  missingFields: string[];
  matchReason?: string;
  matchScore?: number;
  documentResponse?: string;
  documentSources?: Array<{ title: string; category: string }>;
}
