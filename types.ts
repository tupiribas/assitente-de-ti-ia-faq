export interface FAQAttachment {
  url: string;
  name: string;
  extension: string;
  type: 'image' | 'document';
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
  attachments: FAQAttachment[]; // <--- ALTERADO: Removido o '?' para torná-lo obrigatório
  documentUrl?: string;
  documentText?: string;
  _attachmentsData?: string;
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