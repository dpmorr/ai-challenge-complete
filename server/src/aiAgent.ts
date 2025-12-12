import OpenAI from 'openai';
import { ExtractedInfo, TriageState } from './types';
import { findMatchingRule, getMissingFields } from './triageEngine';
import { fuzzyMatchExtractedInfo } from './fuzzyMatcher';
import { logFuzzyMatches, logRuleMatching, logTraceError } from './observability';
import { findBestLawyer } from './dynamicRouter';
import { searchDocuments, generateRAGResponse } from './documentRAG';

const getOpenAIClient = () => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL
  });
};

// Determine which model to use based on the base URL
const getModel = () => {
  const baseUrl = process.env.OPENAI_BASE_URL || '';
  if (baseUrl.includes('groq.com')) {
    return 'openai/gpt-oss-120b';
  }
  // Using OpenAI's API - use gpt-4o-mini for cost efficiency
  return 'gpt-4o-mini';
};

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const SYSTEM_PROMPT = `You are a helpful legal triage assistant for Acme Corp. Your job is to:
1. Extract information from the user's request to properly route them to the right legal team member
2. Ask clarifying questions when needed to gather: request type, location, department, or other relevant details
3. Answer questions about legal documents, policies, and procedures from the knowledge base
4. Be conversational and friendly, not robotic

CONVERSATION STYLE:
- Sound like a real person having a conversation, not a chatbot
- Reference what the user said naturally (e.g., "I can help you with that marketing review request")
- Keep responses warm and personable
- Acknowledge the full context of the conversation, not just the last message
- Use phrases like "Sure!", "Happy to help", "Got it", not formal corporate language

Key information to extract:
- requestType: The type of legal request (e.g., "Sales Contract", "Employment Contract", "NDA", "Marketing Review", "General Question", "Document Question")
- location: The user's location (e.g., "Australia", "United States", "United Kingdom")
- department: The user's department (e.g., "Engineering", "Sales", "Marketing", "Finance")

When you have enough information, you'll be told which legal team member to direct them to.
For document questions, you'll receive relevant information from the knowledge base to answer the question.

IMPORTANT: Always extract information in a normalized format. For example:
- "sales contract" or "sales agreement" → "Sales Contract"
- "employment contract" or "job offer" → "Employment Contract"
- "US" or "USA" or "United States" → "United States"
- "AU" or "Aus" → "Australia"`;

/**
 * Detects if the user is asking a question about documents/policies
 */
export const isDocumentQuestion = async (messages: Message[]): Promise<boolean> => {
  const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
  if (!lastUserMessage) return false;

  const content = lastUserMessage.content.toLowerCase().trim();

  // Greetings and short messages are NOT document questions
  const greetings = ['hi', 'hello', 'hey', 'greetings', 'good morning', 'good afternoon', 'good evening'];
  if (greetings.includes(content) || content.length < 5) {
    return false;
  }

  // Quick keyword check first (fast path)
  // These are QUESTION patterns about policies/documents, not just keywords
  const questionPatterns = [
    'what is', 'what are', 'what\'s', 'explain', 'tell me about', 'how does', 'how do',
    'what do i need to know', 'what should i know', 'wondering what', 'want to know about',
    'define', 'definition of', 'can you explain',
    'regarding the', 'about the', 'regarding our', 'about our'
  ];

  // Policy/document-related terms (only match if combined with question pattern)
  const policyTerms = ['policy', 'policies', 'procedure', 'guideline', 'compliance', 'regulation', 'requirement'];

  // Check for question patterns
  const hasQuestionPattern = questionPatterns.some(pattern => content.includes(pattern));
  const hasPolicyTerm = policyTerms.some(term => content.includes(term));

  // It's a document question if:
  // 1. Has a question pattern (e.g., "what is", "explain")
  // OR
  // 2. Has both a question word and a policy term (e.g., "NDA policy?")
  const hasQuestionWord = /\b(what|how|why|when|where|which|who)\b/.test(content);

  if (hasQuestionPattern || (hasQuestionWord && hasPolicyTerm)) {
    return true;
  }

  // Otherwise, use LLM to determine intent (slower but more accurate)
  try {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: getModel(),
      messages: [
        {
          role: 'system',
          content: `You are a classifier. Determine if the user is asking a QUESTION ABOUT a policy/document/procedure
          OR if they are REQUESTING legal help/service.

          DOCUMENT QUESTIONS (asking to learn/understand):
          - "What is the NDA policy?"
          - "Tell me about data retention"
          - "What do I need to know about NDAs?"
          - "How does the patent process work?"
          - "Explain the IP policy"

          LEGAL REQUESTS (asking for help/action):
          - "I need an NDA for a vendor"
          - "Help me with a contract"
          - "I need legal review"
          - "Can you draft an agreement?"
          - "I need to send a document to marketing"
          - "Can someone help me with X?"

          GREETINGS/SMALL TALK (also NOT document questions):
          - "Hello"
          - "Hi there"
          - "Thanks"

          Return ONLY "document" or "request", nothing else.`
        },
        {
          role: 'user',
          content: lastUserMessage.content
        }
      ],
      temperature: 0,
      max_tokens: 10
    });

    const classification = response.choices[0]?.message?.content?.trim().toLowerCase();
    return classification === 'document';
  } catch (error) {
    console.error('Error classifying question:', error);
    // Fallback to keyword check on error
    return hasKeyword;
  }
};

export const extractInformationFromConversation = async (
  messages: Message[]
): Promise<ExtractedInfo> => {
  const extractionPrompt = `Based on the conversation above, extract any information about the user's legal request.
Return ONLY a JSON object with these fields (use null for unknown fields):
{
  "requestType": "type of legal request",
  "location": "user's location",
  "department": "user's department",
  "isDocumentQuestion": boolean (true if asking about policies/documents/procedures, false if requesting legal help)
}

Normalize the values:
- Request types: "Sales Contract", "Employment Contract", "NDA", "Marketing Review", "General Question", "Document Question"
- Locations: Full country names like "United States", "Australia", "United Kingdom"
- Departments: "Engineering", "Sales", "Marketing", "Finance", "HR", "Legal"
- isDocumentQuestion: true if asking "what is", "how to", "explain", etc. about policies/documents

Return ONLY the JSON, no other text.`;

  try {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: getModel(),
      messages: [
        ...messages,
        { role: 'user', content: extractionPrompt }
      ],
      temperature: 0,
      max_tokens: 200
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) return {};

    // Try to parse JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return {};

    const extracted = JSON.parse(jsonMatch[0]);

    // Filter out null values
    const result: ExtractedInfo = {};
    for (const [key, value] of Object.entries(extracted)) {
      if (value && typeof value === 'string' && value.toLowerCase() !== 'null') {
        result[key] = value;
      }
    }

    return result;
  } catch (error) {
    console.error('Error extracting information:', error);
    return {};
  }
};

export const generateAgentResponse = async (
  messages: Message[],
  triageState: TriageState,
  traceId?: string
): Promise<string> => {
  const { extractedInfo, assignedTo, isComplete, missingFields, documentResponse, documentSources } = triageState;

  // If this is a document question with a RAG response, return it directly
  if (documentResponse) {
    let response = documentResponse;
    if (documentSources && documentSources.length > 0) {
      response += `\n\n**Sources:**\n${documentSources.map(s => `- ${s.title} (${s.category})`).join('\n')}`;
    }
    return response;
  }

  let contextPrompt = `Current extracted information: ${JSON.stringify(extractedInfo, null, 2)}`;

  if (isComplete && assignedTo) {
    contextPrompt += `\n\nThe user should be directed to: ${assignedTo}`;
    contextPrompt += `\n\nProvide a warm, conversational response acknowledging their request and directing them to ${assignedTo}. Reference the conversation naturally - acknowledge what they've asked about and show you understood their needs. Be helpful and friendly, not robotic. Keep it brief but personable.`;
  } else if (missingFields.length > 0) {
    contextPrompt += `\n\nYou need to ask about: ${missingFields.join(', ')}`;
    contextPrompt += `\n\nAsk a natural, conversational question to gather this information. Don't ask for all fields at once - ask for one thing at a time. Sound friendly and helpful, not like a form.`;
  } else {
    contextPrompt += `\n\nThere's no matching rule for this request. Politely explain that you need more information to route their request properly. Ask what type of legal request they have in a conversational way.`;
  }

  try {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: getModel(),
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages,
        { role: 'system', content: contextPrompt }
      ],
      temperature: 0.7,
      max_tokens: 300
    });

    return response.choices[0]?.message?.content?.trim() || 'I apologize, but I encountered an error. Could you please rephrase your request?';
  } catch (error) {
    console.error('Error generating response:', error);
    return 'I apologize, but I encountered an error. Could you please try again?';
  }
};

export const processConversation = async (
  messages: Message[],
  traceId?: string,
  employee?: any
): Promise<TriageState> => {
  try {
    // Check if this is a document question FIRST
    const isDocQuery = await isDocumentQuestion(messages);

    if (isDocQuery) {
      // Extract the question from the last user message
      const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
      const question = lastUserMessage?.content || '';

      // Search for relevant documents
      const searchResults = await searchDocuments(question, undefined, 3);

      // Generate RAG response with employee context
      const ragResponse = await generateRAGResponse(question, undefined, messages, employee);

      console.log(`📚 Document question detected, found ${searchResults.length} relevant documents`);

      // Return as a completed triage with RAG response
      return {
        extractedInfo: {
          requestType: 'Document Question',
          isDocumentQuestion: true
        },
        assignedTo: undefined,
        isComplete: true,
        needsMoreInfo: false,
        missingFields: [],
        documentResponse: ragResponse,
        documentSources: searchResults.map(r => ({ title: r.documentTitle, category: r.category }))
      };
    }

    // Extract information from the conversation
    const rawExtractedInfo = await extractInformationFromConversation(messages);

    // Auto-fill employee context fields if not extracted from conversation
    if (employee) {
      if (!rawExtractedInfo.department && employee.department) {
        rawExtractedInfo.department = employee.department;
        console.log(`📋 Auto-filled department from employee profile: ${employee.department}`);
      }
      if (!rawExtractedInfo.location && employee.location) {
        rawExtractedInfo.location = employee.location;
        console.log(`🌍 Auto-filled location from employee profile: ${employee.location}`);
      }
    }

    // Apply fuzzy matching to normalize values
    const { extractedInfo, fuzzyMatches } = await fuzzyMatchExtractedInfo(rawExtractedInfo);

    // Log fuzzy matching results if traceId provided
    if (traceId && fuzzyMatches) {
      logFuzzyMatches(traceId, fuzzyMatches);
    }

    // NEW: Try dynamic routing first (based on employee context and lawyer tags)
    const bestLawyerMatch = await findBestLawyer(extractedInfo, employee);

    if (bestLawyerMatch && bestLawyerMatch.score >= 20) {
      // Log dynamic routing results if traceId provided
      if (traceId) {
        logRuleMatching(traceId, {
          rulesEvaluated: 0, // Not using static rules
          matchedRule: {
            id: 'dynamic',
            name: `Dynamic Match: ${bestLawyerMatch.lawyer.name}`,
            assignee: bestLawyerMatch.lawyer.email,
            matchedConditions: [
              { field: 'score', operator: 'calculated', value: bestLawyerMatch.score.toString() },
              { field: 'reason', operator: 'matched', value: bestLawyerMatch.reason }
            ]
          }
        });
      }

      return {
        extractedInfo,
        assignedTo: bestLawyerMatch.lawyer.email,
        isComplete: true,
        needsMoreInfo: false,
        missingFields: [],
        matchReason: bestLawyerMatch.reason,
        matchScore: bestLawyerMatch.score
      };
    }

    // FALLBACK: Check static rules if dynamic routing didn't find a match
    const matchingRule = await findMatchingRule(extractedInfo);

    // Log rule matching results if traceId provided
    if (traceId) {
      const allRules = await import('./storageDb').then(m => m.getAllRules());
      logRuleMatching(traceId, {
        rulesEvaluated: allRules.length,
        matchedRule: matchingRule ? {
          id: matchingRule.id,
          name: matchingRule.name,
          assignee: matchingRule.assignee,
          matchedConditions: matchingRule.conditions.map(c => ({
            field: c.field,
            operator: c.operator,
            value: c.value
          }))
        } : undefined
      });
    }

    if (matchingRule) {
      return {
        extractedInfo,
        assignedTo: matchingRule.assignee,
        isComplete: true,
        needsMoreInfo: false,
        missingFields: []
      };
    }

    // Find what information is missing
    const missingFields = await getMissingFields(extractedInfo);

    return {
      extractedInfo,
      isComplete: false,
      needsMoreInfo: missingFields.length > 0,
      missingFields
    };
  } catch (error) {
    if (traceId) {
      logTraceError(traceId, 'process_conversation', error as Error);
    }
    throw error;
  }
};
