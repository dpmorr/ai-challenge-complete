import prisma from './db';
import { TriageRule } from './types';

/**
 * Database-backed storage layer using Prisma
 * This replaces the in-memory storage from storage.ts
 */

export const getAllRules = async (): Promise<TriageRule[]> => {
  const rules = await prisma.triageRule.findMany({
    include: {
      conditions: true
    },
    orderBy: {
      priority: 'asc'
    }
  });

  // Transform Prisma models to match our TriageRule interface
  return rules.map(rule => ({
    id: rule.id,
    name: rule.name,
    conditions: rule.conditions.map(c => ({
      field: c.field,
      operator: c.operator as 'equals' | 'contains',
      value: c.value
    })),
    assignee: rule.assignee,
    priority: rule.priority,
    enabled: rule.enabled
  }));
};

export const getRule = async (id: string): Promise<TriageRule | null> => {
  const rule = await prisma.triageRule.findUnique({
    where: { id },
    include: {
      conditions: true
    }
  });

  if (!rule) return null;

  return {
    id: rule.id,
    name: rule.name,
    conditions: rule.conditions.map(c => ({
      field: c.field,
      operator: c.operator as 'equals' | 'contains',
      value: c.value
    })),
    assignee: rule.assignee,
    priority: rule.priority,
    enabled: rule.enabled
  };
};

export const createRule = async (rule: Omit<TriageRule, 'id'>): Promise<TriageRule> => {
  const created = await prisma.triageRule.create({
    data: {
      name: rule.name,
      assignee: rule.assignee,
      priority: rule.priority,
      enabled: rule.enabled,
      conditions: {
        create: rule.conditions.map(c => ({
          field: c.field,
          operator: c.operator,
          value: c.value
        }))
      }
    },
    include: {
      conditions: true
    }
  });

  return {
    id: created.id,
    name: created.name,
    conditions: created.conditions.map(c => ({
      field: c.field,
      operator: c.operator as 'equals' | 'contains',
      value: c.value
    })),
    assignee: created.assignee,
    priority: created.priority,
    enabled: created.enabled
  };
};

export const updateRule = async (id: string, updates: Partial<TriageRule>): Promise<TriageRule | null> => {
  try {
    // If conditions are being updated, delete old ones and create new ones
    if (updates.conditions) {
      await prisma.condition.deleteMany({
        where: { triageRuleId: id }
      });
    }

    const updated = await prisma.triageRule.update({
      where: { id },
      data: {
        ...(updates.name && { name: updates.name }),
        ...(updates.assignee && { assignee: updates.assignee }),
        ...(updates.priority !== undefined && { priority: updates.priority }),
        ...(updates.enabled !== undefined && { enabled: updates.enabled }),
        ...(updates.conditions && {
          conditions: {
            create: updates.conditions.map(c => ({
              field: c.field,
              operator: c.operator,
              value: c.value
            }))
          }
        })
      },
      include: {
        conditions: true
      }
    });

    return {
      id: updated.id,
      name: updated.name,
      conditions: updated.conditions.map(c => ({
        field: c.field,
        operator: c.operator as 'equals' | 'contains',
        value: c.value
      })),
      assignee: updated.assignee,
      priority: updated.priority,
      enabled: updated.enabled
    };
  } catch (error) {
    console.error('Error updating rule:', error);
    return null;
  }
};

export const deleteRule = async (id: string): Promise<boolean> => {
  try {
    // Prisma will cascade delete conditions automatically
    await prisma.triageRule.delete({
      where: { id }
    });
    return true;
  } catch (error) {
    console.error('Error deleting rule:', error);
    return false;
  }
};

/**
 * Employee-related storage functions
 */

export const getEmployeeByEmail = async (email: string) => {
  return await prisma.employee.findUnique({
    where: { email }
  });
};

export const getAllEmployees = async () => {
  return await prisma.employee.findMany();
};

/**
 * Lawyer-related storage functions
 */

export const getLawyerByEmail = async (email: string) => {
  return await prisma.lawyer.findUnique({
    where: { email },
    include: {
      specialties: true
    }
  });
};

export const getAllLawyers = async () => {
  return await prisma.lawyer.findMany();
};

export const getAvailableLawyers = async () => {
  return await prisma.lawyer.findMany({
    where: {
      available: true,
      currentLoad: {
        lt: prisma.lawyer.fields.maxCaseLoad // currentLoad < maxCaseLoad
      }
    }
  });
};

/**
 * Conversation history storage
 */

export const saveConversation = async (
  employeeId: string | null,
  messages: Array<{ role: string; content: string }>,
  assignedTo: string | null,
  extractedInfo: Record<string, any> | null
) => {
  return await prisma.conversation.create({
    data: {
      employeeId,
      assignedTo,
      extractedInfo,
      messages: {
        create: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        }))
      }
    },
    include: {
      messages: true
    }
  });
};

export const getConversationHistory = async (employeeId: string) => {
  return await prisma.conversation.findMany({
    where: { employeeId },
    include: {
      messages: {
        orderBy: {
          timestamp: 'asc'
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });
};
