import { distance } from 'fastest-levenshtein';
import prisma from './db';

interface FuzzyMatchResult {
  normalizedValue: string;
  confidence: number;
  matchedTerm?: string;
}

/**
 * Calculates similarity score between two strings using Levenshtein distance
 * Returns a score between 0 and 1, where 1 is an exact match
 */
const calculateSimilarity = (str1: string, str2: string): number => {
  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 1;

  const levenshteinDistance = distance(str1, str2);
  return 1 - levenshteinDistance / maxLength;
};

/**
 * Normalizes a value using fuzzy matching against the legal terminology library
 *
 * This function:
 * 1. Looks up the category in the legal terms database
 * 2. Checks the input against all terms and their synonyms
 * 3. Returns the normalized term if similarity > threshold
 *
 * @param input - The raw user input (e.g., "sales agreement")
 * @param category - The category to search (e.g., "request_type", "location", "department")
 * @param threshold - Minimum similarity score to consider a match (0-1, default 0.7)
 * @returns FuzzyMatchResult with normalized value and confidence score
 */
export const fuzzyMatch = async (
  input: string,
  category: string,
  threshold: number = 0.7
): Promise<FuzzyMatchResult> => {
  // Normalize input for comparison
  const normalizedInput = input.toLowerCase().trim();

  try {
    // Fetch all legal terms for this category
    const legalTerms = await prisma.legalTerm.findMany({
      where: { category }
    });

    let bestMatch: FuzzyMatchResult = {
      normalizedValue: input, // Default: return input as-is
      confidence: 0
    };

    // Check against each term and its synonyms
    for (const term of legalTerms) {
      // Check exact match first
      if (normalizedInput === term.term.toLowerCase()) {
        return {
          normalizedValue: term.term,
          confidence: 1.0,
          matchedTerm: term.term
        };
      }

      // Check term similarity
      const termSimilarity = calculateSimilarity(normalizedInput, term.term.toLowerCase());
      if (termSimilarity > bestMatch.confidence) {
        bestMatch = {
          normalizedValue: term.term,
          confidence: termSimilarity,
          matchedTerm: term.term
        };
      }

      // Check synonym matches
      for (const synonym of term.synonyms) {
        const synonymLower = synonym.toLowerCase();

        // Exact synonym match
        if (normalizedInput === synonymLower) {
          return {
            normalizedValue: term.term,
            confidence: 1.0,
            matchedTerm: term.term
          };
        }

        // Fuzzy synonym match
        const synonymSimilarity = calculateSimilarity(normalizedInput, synonymLower);
        if (synonymSimilarity > bestMatch.confidence) {
          bestMatch = {
            normalizedValue: term.term,
            confidence: synonymSimilarity,
            matchedTerm: term.term
          };
        }
      }
    }

    // Only return normalized value if confidence exceeds threshold
    if (bestMatch.confidence >= threshold) {
      return bestMatch;
    }

    // No good match found, return input as-is with low confidence
    return {
      normalizedValue: input,
      confidence: 0
    };

  } catch (error) {
    console.error('Error in fuzzy matching:', error);
    // On error, return input as-is
    return {
      normalizedValue: input,
      confidence: 0
    };
  }
};

/**
 * Batch fuzzy matching for extracted information
 * Normalizes all fields in the extracted info object
 */
export const fuzzyMatchExtractedInfo = async (
  extractedInfo: Record<string, string>
): Promise<{
  extractedInfo: Record<string, string>;
  fuzzyMatches?: {
    requestType?: { original: string; matched: string; confidence: number };
    location?: { original: string; matched: string; confidence: number };
    department?: { original: string; matched: string; confidence: number };
  };
}> => {
  interface FuzzyMatchResult {
    original: string;
    matched: string;
    confidence: number;
  }

  const normalized: Record<string, string> = {};
  const fuzzyMatches: Record<string, FuzzyMatchResult> = {};

  // Map fields to categories
  const fieldCategoryMap: Record<string, string> = {
    requestType: 'request_type',
    location: 'location',
    department: 'department'
  };

  for (const [field, value] of Object.entries(extractedInfo)) {
    const category = fieldCategoryMap[field];

    if (category && value) {
      const result = await fuzzyMatch(value, category);

      // Only use normalized value if we have good confidence (>= 0.7)
      if (result.confidence >= 0.7) {
        normalized[field] = result.normalizedValue;
        fuzzyMatches[field] = {
          original: value,
          matched: result.normalizedValue,
          confidence: result.confidence
        };
        console.log(`✨ Fuzzy matched "${value}" → "${result.normalizedValue}" (confidence: ${result.confidence.toFixed(2)})`);
      } else {
        // Keep original value if no good match
        normalized[field] = value;
      }
    } else {
      // Pass through fields without fuzzy matching
      normalized[field] = value;
    }
  }

  return {
    extractedInfo: normalized,
    fuzzyMatches: Object.keys(fuzzyMatches).length > 0 ? fuzzyMatches : undefined
  };
};

/**
 * Add a new legal term to the library
 */
export const addLegalTerm = async (
  term: string,
  category: string,
  synonyms: string[]
) => {
  return await prisma.legalTerm.create({
    data: {
      term,
      category,
      synonyms
    }
  });
};

/**
 * Get all legal terms for a category
 */
export const getLegalTermsByCategory = async (category: string) => {
  return await prisma.legalTerm.findMany({
    where: { category }
  });
};

/**
 * Update synonyms for a legal term
 */
export const updateLegalTermSynonyms = async (
  termId: string,
  synonyms: string[]
) => {
  return await prisma.legalTerm.update({
    where: { id: termId },
    data: { synonyms }
  });
};
