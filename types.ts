export interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
}

export interface ChatMessage {
  imagePreviewUrl: any;
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

export enum AppView {
  FAQ = 'faq',
  AI_ASSISTANT = 'ai_assistant',
  MANAGE_FAQS = 'manage_faqs'
}

// Gemini API related types that might be used, though direct usage in components is often through service responses.
// This is more for reference or if we decide to type specific parts of the Gemini response if not fully handled by the SDK types.
// For example, if we were to parse grounding metadata.
export interface GroundingChunkWeb {
  uri: string;
  title: string;
}

export interface GroundingChunk {
  web: GroundingChunkWeb;
}

export interface GroundingMetadata {
  groundingChunks?: GroundingChunk[];
}