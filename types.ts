export interface FAQAttachment {
  url: string;
  name: string;
  extension: string;
  type: 'image' | 'document';
  id?: number | string; // Opcional: ID do anexo vindo do banco
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
  attachments: FAQAttachment[]; // Lista de anexos
  documentText?: string | null; // Texto extraído para IA (pode ser nulo)
  createdAt?: string; // <-- ADICIONADO AQUI (String da data ISO vinda do DB)
  updatedAt?: string; // <-- ADICIONADO AQUI (String da data ISO vinda do DB)
  // Campos legados ou internos do frontend podem ser removidos se não usados
  // documentUrl?: string;
  // _attachmentsData?: string;
}

export interface ChatMessage {
  imagePreviewUrl: string | undefined;
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

// O Enum AppView não é mais necessário com React Router
// export enum AppView { ... }

// Tipos relacionados a Grounding (se ainda forem usados pela IA)
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

// Interface User (já deve existir da etapa anterior)
export interface User {
  id: string;
  username: string;
  role: 'admin' | 'editor';
  createdAt?: string; // Opcional: Adicionado se vier da API /admin/users
}

// Interface para Sugestão da IA (já deve existir)
export interface SuggestedFAQProposal {
  action: 'add' | 'update' | 'delete' | 'deleteCategory' | 'renameCategory';
  id?: string;
  question?: string;
  answer?: string;
  category?: string;
  reason?: string;
  categoryName?: string;
  oldCategoryName?: string;
  newCategoryName?: string;
  // imageUrl e documentUrl podem ser removidos se attachments for usado exclusivamente
  // imageUrl?: string;
  // documentUrl?: string;
  documentText?: string;
  attachments?: FAQAttachment[];
}