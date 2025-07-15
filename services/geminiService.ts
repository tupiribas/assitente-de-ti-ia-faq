const API_BASE_URL_AI = '/api/ai-chat'; // O endpoint do backend para o chat IA

const geminiService = {
  sendMessageToChat: async (
    message: string,
    imageFile: File | null,
    history: any[],
    relevantFAQsContext: string
  ): Promise<{ response: string; userAssetUrl: string | null }> => { // MODIFICADO: Retorna um objeto com response e userAssetUrl
    try {
      const formData = new FormData();
      formData.append('message', message);
      formData.append('history', JSON.stringify(history));
      formData.append('relevantFAQsContext', relevantFAQsContext);

      if (imageFile) {
        formData.append('image', imageFile);
      }

      const response = await fetch(API_BASE_URL_AI, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Erro HTTP: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();
      // MODIFICADO: Retorna um objeto
      return { response: data.response, userAssetUrl: data.userAssetUrl || null };
    } catch (error) {
      console.error("Erro ao enviar mensagem para o backend proxy da IA:", error);
      if (error instanceof Error && error.message.includes('API key not valid')) {
        throw new Error("Erro de autenticação da API Gemini. Por favor, verifique sua API Key do Gemini no servidor.");
      }
      throw new Error(`Erro de comunicação com o assistente IA: ${error instanceof Error ? error.message : "Erro desconhecido."}`);
    }
  },
};

export { geminiService };