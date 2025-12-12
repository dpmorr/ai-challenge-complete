import prisma from './db';
import { ExtractedInfo } from './types';

export interface EmployeeProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  department: string;
  location: string;
  role: string;
  tags?: string[];
  calendarAvailability?: any;
}

/**
 * Get employee profile by email
 */
export const getEmployeeProfile = async (email: string): Promise<EmployeeProfile | null> => {
  const employee = await prisma.employee.findUnique({
    where: { email }
  });

  return employee;
};

/**
 * Auto-populate extracted information with employee context
 * This enriches the user's request with their profile data
 */
export const enrichWithEmployeeContext = async (
  extractedInfo: ExtractedInfo,
  employeeEmail?: string
): Promise<ExtractedInfo> => {
  if (!employeeEmail) {
    return extractedInfo;
  }

  const employee = await getEmployeeProfile(employeeEmail);

  if (!employee) {
    return extractedInfo;
  }

  // Auto-fill missing fields from employee profile
  const enriched: ExtractedInfo = { ...extractedInfo };

  // Only auto-fill if not already provided by user
  if (!enriched.department) {
    enriched.department = employee.department;
    console.log(`📋 Auto-filled department from employee profile: ${employee.department}`);
  }

  if (!enriched.location) {
    enriched.location = employee.location;
    console.log(`🌍 Auto-filled location from employee profile: ${employee.location}`);
  }

  // Add employee context metadata
  enriched._employeeId = employee.id;
  enriched._employeeName = `${employee.firstName} ${employee.lastName}`;
  enriched._employeeRole = employee.role;

  return enriched;
};

/**
 * Get conversation history for an employee
 * Useful for context and learning
 */
export const getEmployeeConversationHistory = async (
  employeeEmail: string,
  limit: number = 10
) => {
  const employee = await getEmployeeProfile(employeeEmail);

  if (!employee) {
    return [];
  }

  return await prisma.conversation.findMany({
    where: {
      employeeId: employee.id
    },
    include: {
      messages: {
        orderBy: {
          timestamp: 'asc'
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: limit
  });
};

/**
 * Find the most common request patterns for an employee
 * Used for predictive routing and suggestions
 */
export const getEmployeeRequestPatterns = async (employeeEmail: string) => {
  const employee = await getEmployeeProfile(employeeEmail);

  if (!employee) {
    return {
      commonRequestTypes: [],
      commonAssignees: [],
      totalRequests: 0
    };
  }

  const conversations = await prisma.conversation.findMany({
    where: {
      employeeId: employee.id,
      extractedInfo: {
        not: null
      }
    },
    select: {
      extractedInfo: true,
      assignedTo: true
    }
  });

  // Analyze patterns
  const requestTypes: Record<string, number> = {};
  const assignees: Record<string, number> = {};

  for (const conv of conversations) {
    const info = conv.extractedInfo as any;

    if (info?.requestType) {
      requestTypes[info.requestType] = (requestTypes[info.requestType] || 0) + 1;
    }

    if (conv.assignedTo) {
      assignees[conv.assignedTo] = (assignees[conv.assignedTo] || 0) + 1;
    }
  }

  // Sort by frequency
  const commonRequestTypes = Object.entries(requestTypes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([type, count]) => ({ type, count }));

  const commonAssignees = Object.entries(assignees)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([email, count]) => ({ email, count }));

  return {
    commonRequestTypes,
    commonAssignees,
    totalRequests: conversations.length
  };
};

/**
 * Create or update employee profile
 */
export const upsertEmployeeProfile = async (
  email: string,
  profile: Omit<EmployeeProfile, 'id' | 'email'>
): Promise<EmployeeProfile> => {
  const employee = await prisma.employee.upsert({
    where: { email },
    update: {
      firstName: profile.firstName,
      lastName: profile.lastName,
      department: profile.department,
      location: profile.location,
      role: profile.role,
      ...(profile.tags !== undefined && { tags: profile.tags }),
      ...(profile.calendarAvailability !== undefined && { calendarAvailability: profile.calendarAvailability })
    },
    create: {
      email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      department: profile.department,
      location: profile.location,
      role: profile.role,
      tags: profile.tags || [],
      calendarAvailability: profile.calendarAvailability || null
    }
  });

  return employee;
};

/**
 * Suggest next question based on employee history
 * Uses past patterns to predict what information is needed
 */
export const suggestNextQuestion = async (
  employeeEmail: string,
  currentExtractedInfo: ExtractedInfo
): Promise<string | null> => {
  const patterns = await getEmployeeRequestPatterns(employeeEmail);

  // If employee has history, suggest based on their common patterns
  if (patterns.totalRequests > 0 && patterns.commonRequestTypes.length > 0) {
    const mostCommonType = patterns.commonRequestTypes[0].type;

    // If request type is not provided, suggest the most common one
    if (!currentExtractedInfo.requestType) {
      return `Based on your history, do you need help with ${mostCommonType}?`;
    }
  }

  return null;
};

/**
 * Get all employees (for admin purposes)
 */
export const getAllEmployees = async () => {
  return await prisma.employee.findMany({
    orderBy: {
      lastName: 'asc'
    }
  });
};

/**
 * Get employees by department
 */
export const getEmployeesByDepartment = async (department: string) => {
  return await prisma.employee.findMany({
    where: {
      department: {
        equals: department,
        mode: 'insensitive'
      }
    },
    orderBy: {
      lastName: 'asc'
    }
  });
};

/**
 * Get employees by location
 */
export const getEmployeesByLocation = async (location: string) => {
  return await prisma.employee.findMany({
    where: {
      location: {
        equals: location,
        mode: 'insensitive'
      }
    },
    orderBy: {
      lastName: 'asc'
    }
  });
};

/**
 * Bulk import employees from CSV or JSON
 */
export const bulkImportEmployees = async (
  employees: Array<Omit<EmployeeProfile, 'id'>>
): Promise<number> => {
  let imported = 0;

  for (const emp of employees) {
    try {
      await upsertEmployeeProfile(emp.email, {
        firstName: emp.firstName,
        lastName: emp.lastName,
        department: emp.department,
        location: emp.location,
        role: emp.role
      });
      imported++;
    } catch (error) {
      console.error(`Failed to import employee ${emp.email}:`, error);
    }
  }

  console.log(`✅ Imported ${imported} employees`);
  return imported;
};

/**
 * Attach a document to an employee
 */
export const attachDocumentToEmployee = async (
  employeeId: string,
  documentId: string,
  notes?: string
): Promise<void> => {
  await prisma.employeeDocument.create({
    data: {
      employeeId,
      documentId,
      notes
    }
  });

  console.log(`✅ Attached document ${documentId} to employee ${employeeId}`);
};

/**
 * Detach a document from an employee
 */
export const detachDocumentFromEmployee = async (
  employeeId: string,
  documentId: string
): Promise<void> => {
  await prisma.employeeDocument.deleteMany({
    where: {
      employeeId,
      documentId
    }
  });

  console.log(`✅ Detached document ${documentId} from employee ${employeeId}`);
};

/**
 * Get all documents attached to an employee
 */
export const getEmployeeDocuments = async (employeeId: string) => {
  const attachments = await prisma.employeeDocument.findMany({
    where: { employeeId },
    include: {
      document: true
    },
    orderBy: {
      attachedAt: 'desc'
    }
  });

  return attachments.map(att => ({
    ...att.document,
    attachedAt: att.attachedAt,
    notes: att.notes
  }));
};
