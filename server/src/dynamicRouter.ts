import prisma from './db';
import { ExtractedInfo } from './types';

interface EmployeeWithContext {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  department: string;
  location: string;
  role?: string;
  tags?: string[];
}

interface LawyerWithSpecialties {
  id: string;
  email: string;
  name: string;
  specialties: string[];
  locations: string[];
  departments: string[];
  tags?: string[];
  calendarAvailability?: any;
}

/**
 * Check if lawyer has calendar availability in the next few days
 */
const hasUpcomingAvailability = (lawyer: LawyerWithSpecialties): boolean => {
  if (!lawyer.calendarAvailability) return false;

  try {
    const availability = lawyer.calendarAvailability;

    // Check if they have upcomingAvailability field
    if (availability.upcomingAvailability && Array.isArray(availability.upcomingAvailability)) {
      // Check if they have any slots in the next 7 days
      const now = new Date();
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      return availability.upcomingAvailability.some((day: any) => {
        const dayDate = new Date(day.date);
        return dayDate >= now && dayDate <= sevenDaysFromNow && day.slots && day.slots.length > 0;
      });
    }

    return false;
  } catch (error) {
    return false;
  }
};

/**
 * Get the number of available slots in the next 7 days
 */
const getAvailableSlotCount = (lawyer: LawyerWithSpecialties): number => {
  if (!lawyer.calendarAvailability) return 0;

  try {
    const availability = lawyer.calendarAvailability;

    if (availability.upcomingAvailability && Array.isArray(availability.upcomingAvailability)) {
      const now = new Date();
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      let totalSlots = 0;
      availability.upcomingAvailability.forEach((day: any) => {
        const dayDate = new Date(day.date);
        if (dayDate >= now && dayDate <= sevenDaysFromNow && day.slots) {
          totalSlots += day.slots.length;
        }
      });

      return totalSlots;
    }

    return 0;
  } catch (error) {
    return 0;
  }
};

/**
 * Score a lawyer based on how well they match the request and employee context
 */
const scoreLawyerMatch = (
  lawyer: LawyerWithSpecialties,
  extractedInfo: ExtractedInfo,
  employee?: EmployeeWithContext
): number => {
  let score = 0;

  // AVAILABILITY BONUS (check this first - important for responsiveness)
  const hasAvailability = hasUpcomingAvailability(lawyer);
  const availableSlots = getAvailableSlotCount(lawyer);

  if (hasAvailability) {
    score += 25; // Base bonus for having availability
    // Additional points based on how many slots (more slots = more available)
    score += Math.min(availableSlots * 2, 15); // Up to 15 extra points for many slots
  } else {
    // Penalty for no availability (they might be too busy)
    score -= 10;
  }

  // Match request type to lawyer specialties (highest priority)
  if (extractedInfo.requestType && lawyer.specialties) {
    const requestTypeLower = extractedInfo.requestType.toLowerCase();
    const hasSpecialtyMatch = lawyer.specialties.some(
      specialty => specialty.toLowerCase().includes(requestTypeLower) ||
                   requestTypeLower.includes(specialty.toLowerCase())
    );
    if (hasSpecialtyMatch) {
      score += 50; // Strong match
    }
  }

  // Match location
  if (extractedInfo.location && lawyer.locations) {
    const locationLower = extractedInfo.location.toLowerCase();
    const hasLocationMatch = lawyer.locations.some(
      loc => loc.toLowerCase() === locationLower
    );
    if (hasLocationMatch) {
      score += 30;
    }
  }

  // Match department
  if (extractedInfo.department && lawyer.departments) {
    const deptLower = extractedInfo.department.toLowerCase();
    const hasDeptMatch = lawyer.departments.some(
      dept => dept.toLowerCase() === deptLower
    );
    if (hasDeptMatch) {
      score += 20;
    }
  }

  // Match employee tags with lawyer tags (VIP handling, special cases, etc.)
  if (employee?.tags && lawyer.tags) {
    const employeeTags = employee.tags.map(t => t.toLowerCase());
    const lawyerTags = lawyer.tags.map(t => t.toLowerCase());

    // Check for VIP tag match
    if (employeeTags.includes('vip') && lawyerTags.includes('vip')) {
      score += 40; // High priority for VIP matching
    }

    // Check for other tag matches
    const commonTags = employeeTags.filter(tag => lawyerTags.includes(tag));
    score += commonTags.length * 10;
  }

  // Fallback: if lawyer handles employee's location
  if (employee?.location && lawyer.locations) {
    const empLocationLower = employee.location.toLowerCase();
    const hasEmpLocationMatch = lawyer.locations.some(
      loc => loc.toLowerCase() === empLocationLower
    );
    if (hasEmpLocationMatch) {
      score += 15;
    }
  }

  // Fallback: if lawyer handles employee's department
  if (employee?.department && lawyer.departments) {
    const empDeptLower = employee.department.toLowerCase();
    const hasEmpDeptMatch = lawyer.departments.some(
      dept => dept.toLowerCase() === empDeptLower
    );
    if (hasEmpDeptMatch) {
      score += 10;
    }
  }

  return score;
};

/**
 * Find the best lawyer to route this request to based on dynamic matching
 */
export const findBestLawyer = async (
  extractedInfo: ExtractedInfo,
  employee?: EmployeeWithContext
): Promise<{ lawyer: LawyerWithSpecialties; score: number; reason: string } | null> => {
  try {
    // REQUIREMENT: Must have at least a request type to route
    if (!extractedInfo.requestType) {
      console.log('⏸️  No request type extracted yet - cannot route');
      return null;
    }

    // Get all lawyers from database
    const lawyers = await prisma.lawyer.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        specialties: true,
        locations: true,
        departments: true,
        tags: true,
        calendarAvailability: true
      }
    });

    if (lawyers.length === 0) {
      console.warn('No lawyers found in database');
      return null;
    }

    // Score each lawyer
    const scoredLawyers = lawyers.map(lawyer => ({
      lawyer,
      score: scoreLawyerMatch(lawyer, extractedInfo, employee)
    }));

    // Sort by score descending
    scoredLawyers.sort((a, b) => b.score - a.score);

    const bestMatch = scoredLawyers[0];

    // Only return if we have a reasonable score (at least 20 points)
    if (bestMatch.score < 20) {
      console.log('No good lawyer match found. Best score:', bestMatch.score);
      return null;
    }

    // Build reason string
    let reasons: string[] = [];

    // Check availability first (it's important!)
    const hasAvailability = hasUpcomingAvailability(bestMatch.lawyer);
    const availableSlots = getAvailableSlotCount(bestMatch.lawyer);

    if (hasAvailability) {
      reasons.push(`available soon (${availableSlots} slots in next 7 days)`);
    }

    if (extractedInfo.requestType && bestMatch.lawyer.specialties) {
      const requestTypeLower = extractedInfo.requestType.toLowerCase();
      const matchingSpecialty = bestMatch.lawyer.specialties.find(
        s => s.toLowerCase().includes(requestTypeLower) || requestTypeLower.includes(s.toLowerCase())
      );
      if (matchingSpecialty) {
        reasons.push(`specializes in ${matchingSpecialty}`);
      }
    }

    if (extractedInfo.location && bestMatch.lawyer.locations?.includes(extractedInfo.location)) {
      reasons.push(`handles ${extractedInfo.location} region`);
    }

    if (extractedInfo.department && bestMatch.lawyer.departments?.includes(extractedInfo.department)) {
      reasons.push(`works with ${extractedInfo.department} department`);
    }

    if (employee?.tags?.includes('VIP') && bestMatch.lawyer.tags?.includes('VIP')) {
      reasons.push('handles VIP clients');
    }

    const reason = reasons.length > 0
      ? reasons.join(', ')
      : 'best available match';

    console.log(`✅ Matched to ${bestMatch.lawyer.name} (score: ${bestMatch.score}) - ${reason}`);

    return {
      lawyer: bestMatch.lawyer,
      score: bestMatch.score,
      reason
    };

  } catch (error) {
    console.error('Error finding best lawyer:', error);
    return null;
  }
};

/**
 * Get routing explanation for debugging
 */
export const getRoutingExplanation = (
  extractedInfo: ExtractedInfo,
  employee?: EmployeeWithContext,
  matchedLawyer?: LawyerWithSpecialties,
  score?: number
): string => {
  const parts: string[] = [];

  parts.push('**Request Analysis:**');
  if (extractedInfo.requestType) parts.push(`- Request Type: ${extractedInfo.requestType}`);
  if (extractedInfo.location) parts.push(`- Location: ${extractedInfo.location}`);
  if (extractedInfo.department) parts.push(`- Department: ${extractedInfo.department}`);

  if (employee) {
    parts.push('\n**Employee Context:**');
    parts.push(`- ${employee.firstName} ${employee.lastName} (${employee.email})`);
    parts.push(`- Department: ${employee.department}`);
    parts.push(`- Location: ${employee.location}`);
    if (employee.tags && employee.tags.length > 0) {
      parts.push(`- Tags: ${employee.tags.join(', ')}`);
    }
  }

  if (matchedLawyer) {
    parts.push('\n**Matched Lawyer:**');
    parts.push(`- ${matchedLawyer.name} (${matchedLawyer.email})`);
    if (score) parts.push(`- Match Score: ${score}/100`);
    if (matchedLawyer.specialties?.length) {
      parts.push(`- Specialties: ${matchedLawyer.specialties.join(', ')}`);
    }
    if (matchedLawyer.locations?.length) {
      parts.push(`- Locations: ${matchedLawyer.locations.join(', ')}`);
    }
  }

  return parts.join('\n');
};
