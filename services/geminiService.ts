// assistente-de-ti/services/geminiService.ts

import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { GEMINI_MODEL_NAME, AI_SYSTEM_INSTRUCTION } from '../constants';

// Ensure API_KEY is available. In a real deployment, this would be set in the environment.
// For local development, you might use a .env file and a library like dotenv,
// or set it directly if your build process handles environment variables.
const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error("API_KEY for Gemini is not set. Please set the process.env.API_KEY environment variable.");
  // Throwing an error here would stop the app from loading if the key is missing.
  // Depending on requirements, you might handle this more gracefully in the UI.
}

const ai = new GoogleGenAI({ apiKey: API_KEY! }); // The "!" asserts API_KEY is non-null after the check or if assumed to be set by environment.

const geminiService = {
  startChat: (): Chat => {
    if (!API_KEY) {
      throw new Error("Gemini API Key não configurada.");
    }
    try {
      const chat = ai.chats.create({
        model: GEMINI_MODEL_NAME,
        config: {
          systemInstruction: AI_SYSTEM_INSTRUCTION,
          // Add other configs like temperature, topK, topP if needed.
          // For a general IT assistant, default values are often fine to start.
          // thinkingConfig: { thinkingBudget: 0 } // Disable thinking for low latency if it were a game AI
        },
      });
      return chat;
    } catch (error) {
      console.error("Erro ao criar sessão de chat com Gemini:", error);
      throw new Error("Não foi possível iniciar o chat com o assistente IA. Verifique as configurações.");
    }
  },

  sendMessageToChat: async (chat: Chat, message: string): Promise<string> => {
    if (!API_KEY) {
      throw new Error("Gemini API Key não configurada.");
    }
    try {
      const result: GenerateContentResponse = await chat.sendMessage({ message: message });
      // Directly access the text property as per documentation.
      const text = result.text;
      if (typeof text !== 'string') {
        console.error("Resposta da IA não é uma string:", text);
        return "Desculpe, não consegui processar essa resposta.";
      }
      return text;
    } catch (error) {
      console.error("Erro ao enviar mensagem para Gemini:", error);
      // More specific error handling can be added here (e.g., for different error codes from API)
      if (error instanceof Error) {
        // Check for specific error messages or types if needed
        if (error.message.includes('API key not valid')) {
          throw new Error("Chave de API inválida. Por favor, verifique sua API Key do Gemini.");
        }
        throw new Error(`Erro de comunicação com o assistente IA: ${error.message}`);
      }
      throw new Error("Ocorreu um erro desconhecido ao contatar o assistente IA.");
    }
  },

  // Example of a simple one-off generation if not using chat history
  generateContent: async (prompt: string): Promise<string> => {
    if (!API_KEY) {
      throw new Error("Gemini API Key não configurada.");
    }
    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: GEMINI_MODEL_NAME,
        contents: prompt,
        config: {
          systemInstruction: AI_SYSTEM_INSTRUCTION,
        }
      });
      const text = response.text;
      if (typeof text !== 'string') {
        console.error("Resposta da IA não é uma string:", text);
        return "Desculpe, não consegui processar essa resposta.";
      }
      return text;
    } catch (error) {
      console.error("Erro ao gerar conteúdo com Gemini:", error);
      if (error instanceof Error) {
        throw new Error(`Erro de comunicação com o Gemini: ${error.message}`);
      }
      throw new Error("Ocorreu um erro desconhecido ao comunicar com Gemini.");
    }
  }
};

export { geminiService };