// tupiribas/assitente-de-ti-ia-faq/assitente-de-ti-ia-faq-main/services/geminiService.ts

// Removidas as importações do SDK Gemini, pois agora este serviço se comunica com o backend proxy
// import { GoogleGenAI, Chat, GenerateContentResponse, GenerativeContentPart } from "@google/genai";
// import { GEMINI_MODEL_NAME, AI_SYSTEM_INSTRUCTION } from '../constants'; // Não necessário aqui

const API_BASE_URL_AI = '/api/ai-chat'; // O endpoint do backend para o chat IA

const geminiService = {
  // startChat não é mais necessário, a sessão é stateless via backend
  // generateContent não é mais necessário
  // Removidas as chamadas diretas ao SDK GoogleGenAI aqui

  // MODIFICADO: sendMessageToChat agora faz uma requisição fetch para o backend proxy
  // Ele recebe o texto, opcionalmente um File de imagem, e o histórico do chat.
  sendMessageToChat: async (
    message: string,
    imageFile: File | null,
    history: any[], // O histórico é passado do frontend
    relevantFAQsContext: string // NOVO: Adicionado o contexto dos FAQs
  ): Promise<string> => {
    try {
      const formData = new FormData();
      formData.append('message', message);
      // Passa o histórico como uma string JSON para que o backend possa parsear
      formData.append('history', JSON.stringify(history));
      formData.append('relevantFAQsContext', relevantFAQsContext); // NOVO: Adiciona o contexto

      if (imageFile) {
        formData.append('image', imageFile); // 'image' deve corresponder ao campo esperado no Multer do backend
      }

      const response = await fetch(API_BASE_URL_AI, {
        method: 'POST',
        body: formData,
        // Content-Type não é definido; o navegador o faz automaticamente com FormData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Erro HTTP: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();
      return data.response; // Espera-se que o backend retorne { response: "texto da IA" }
    } catch (error) {
      console.error("Erro ao enviar mensagem para o backend proxy da IA:", error);
      if (error instanceof Error && error.message.includes('API key not valid')) {
        // Esta mensagem de erro de API Key agora viria do SEU backend, não diretamente da Gemini
        throw new Error("Erro de autenticação da API Gemini. Por favor, verifique sua API Key do Gemini no servidor.");
      }
      throw new Error(`Erro de comunicação com o assistente IA: ${error instanceof Error ? error.message : "Erro desconhecido."}`);
    }
  },
};

export { geminiService };