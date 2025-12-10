export interface PropertySet {
  [key: string]: string | number | boolean;
}

export interface BIMElement {
  id: string;
  name: string;
  type: string;
  pset: {
    [psetName: string]: PropertySet;
  };
}

export interface BCFTopic {
  id: string;
  title: string;
  status: string;
  priority: string;
  assignee: string | null;
  element_id: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditResult {
  id: string;
  element_id: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  message: string;
  rule_name: string | null;
  created_at: string;
}

export type PanelType = 'properties' | 'bcf' | 'ids' | 'tree' | 'settings';

export interface IDSFile {
  name: string;
  ruleCount: number;
}
