import { TriageRule, TriageCondition, ExtractedInfo } from './types';
import { getAllRules } from './storageDb';

const evaluateCondition = (condition: TriageCondition, info: ExtractedInfo): boolean => {
  const value = info[condition.field];

  if (!value) return false;

  const normalizedValue = value.toLowerCase().trim();
  const normalizedTarget = condition.value.toLowerCase().trim();

  switch (condition.operator) {
    case 'equals':
      return normalizedValue === normalizedTarget;
    case 'contains':
      return normalizedValue.includes(normalizedTarget);
    default:
      return false;
  }
};

const evaluateRule = (rule: TriageRule, info: ExtractedInfo): boolean => {
  if (!rule.enabled) return false;
  return rule.conditions.every(condition => evaluateCondition(condition, info));
};

export const findMatchingRule = async (info: ExtractedInfo): Promise<TriageRule | null> => {
  const rules = await getAllRules();

  for (const rule of rules) {
    if (evaluateRule(rule, info)) {
      return rule;
    }
  }

  return null;
};

export const getRequiredFields = async (): Promise<string[]> => {
  const rules = await getAllRules();
  const fields = new Set<string>();

  for (const rule of rules) {
    for (const condition of rule.conditions) {
      fields.add(condition.field);
    }
  }

  return Array.from(fields);
};

export const getMissingFields = async (info: ExtractedInfo): Promise<string[]> => {
  const requiredFields = await getRequiredFields();
  const providedFields = Object.keys(info).filter(key => info[key]);

  // Try to match with what we have
  const matchingRule = await findMatchingRule(info);
  if (matchingRule) {
    return []; // We have enough info to make an assignment
  }

  // Find what fields we still need
  const missing: string[] = [];
  const rules = await getAllRules();

  for (const rule of rules) {
    const ruleFields = rule.conditions.map(c => c.field);
    const missingForRule = ruleFields.filter(field => !info[field]);

    // If this rule is close to matching (only missing a few fields), suggest those
    if (missingForRule.length > 0 && missingForRule.length < ruleFields.length) {
      missing.push(...missingForRule);
    }
  }

  // If no close matches, return the most common fields
  if (missing.length === 0) {
    return requiredFields.filter(field => !info[field]).slice(0, 1);
  }

  return Array.from(new Set(missing)).slice(0, 1); // Return one field at a time
};
