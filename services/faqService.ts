// assistente-de-ti/services/faqService.ts
import { FAQ } from '../types';

// ** IMPORTANTE: DEVE SER UM CAMINHO RELATIVO para que o proxy do Vite atue **
const API_BASE_URL = '/api/faqs';

const faqService = {
  loadFAQs: async (): Promise<FAQ[]> => {
    try {
      const response = await fetch(API_BASE_URL); // <-- Certifique-se que usa API_BASE_URL
      if (!response.ok) {
        throw new Error(`Erro HTTP ao carregar FAQs: ${response.status}`);
      }
      const faqs: FAQ[] = await response.json();
      return faqs;
    } catch (error) {
      console.error("Erro ao carregar FAQs do servidor:", error);
      return [];
    }
  },

  saveFAQs: async (newFaqData: Omit<FAQ, 'id'>): Promise<FAQ> => {
    try {
      const response = await fetch(API_BASE_URL, { // <-- Certifique-se que usa API_BASE_URL
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newFaqData),
      });
      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(`Erro HTTP ao salvar FAQ: ${response.status} - ${errorBody.message || response.statusText}`);
      }
      const addedFaq: FAQ = await response.json();
      console.log("FAQ salvo no servidor com sucesso!", addedFaq);
      return addedFaq;
    } catch (error) {
      console.error("Erro ao salvar FAQ no servidor:", error);
      throw error;
    }
  },

  // updateFAQ: async (updatedFaq: FAQ): Promise<FAQ> => {
  //   try {
  //     const response = await fetch(`<span class="math-inline">\{API\_BASE\_URL\}/</span>{updatedFaq.id}`, { // Inclui o ID na URL
  //       method: 'PUT',
  //       headers: {
  //         'Content-Type': 'application/json',
  //       },
  //       body: JSON.stringify(updatedFaq),
  //     });
  //     if (!response.ok) {
  //       const errorBody = await response.json();
  //       throw new Error(`Erro HTTP ao atualizar FAQ: ${response.status} - ${errorBody.message || response.statusText}`);
  //     }
  //     const faq: FAQ = await response.json();
  //     console.log("FAQ atualizado no servidor com sucesso!", faq);
  //     return faq;
  //   } catch (error) {
  //     console.error("Erro ao atualizar FAQ no servidor:", error);
  //     throw error;
  //   }
  // },
  updateFAQ: async (updatedFaq: FAQ): Promise<FAQ> => {
    try {
      // Corrigido: Use backticks (crases) e a sintaxe correta para interpolação ${}.
      const response = await fetch(`${API_BASE_URL}/${updatedFaq.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedFaq),
      });
      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(`Erro HTTP ao atualizar FAQ: ${response.status} - ${errorBody.message || response.statusText}`);
      }
      const faq: FAQ = await response.json();
      console.log("FAQ atualizado no servidor com sucesso!", faq);
      return faq;
    } catch (error) {
      console.error("Erro ao atualizar FAQ no servidor:", error);
      throw error;
    }
  },

  // NOVO: Função para excluir FAQs por categoria
  deleteFAQsByCategory: async (categoryName: string): Promise<string> => {
    try {
      const response = await fetch(`${API_BASE_URL}/category/${encodeURIComponent(categoryName)}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(`Erro HTTP ao excluir FAQs da categoria '${categoryName}': ${response.status} - ${errorBody.message || response.statusText}`);
      }
      const successMessage = await response.json(); // O backend retorna um JSON com a mensagem de sucesso
      console.log("FAQs da categoria excluídos com sucesso!", successMessage.message);
      return successMessage.message;
    } catch (error) {
      console.error(`Erro ao excluir FAQs da categoria '${categoryName}':`, error);
      throw error;
    }
  },

  // NOVO: Função para excluir um FAQ por ID - COLOQUE AQUI
  deleteFAQ: async (id: string): Promise<void> => {
    try {
      const response = await fetch(`${API_BASE_URL}/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorBody = await response.text();
        let errorMessage = `Erro HTTP ao excluir FAQ: ${response.status}`;
        try {
          const jsonError = JSON.parse(errorBody);
          errorMessage += ` - ${jsonError.message || response.statusText}`;
        } catch {
          errorMessage += ` - ${errorBody || response.statusText}`;
        }
        throw new Error(errorMessage);
      }
      console.log(`FAQ com ID ${id} excluído no servidor com sucesso!`);
    } catch (error) {
      console.error(`Erro ao excluir FAQ com ID ${id} do servidor:`, error);
      throw error;
    }
  },

  renameCategory: async (oldCategoryName: string, newCategoryName: string): Promise<string> => {
    try {
      const response = await fetch(`${API_BASE_URL}/category/rename`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ oldCategoryName, newCategoryName }),
      });
      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(`Erro HTTP ao renomear categoria: ${response.status} - ${errorBody.message || response.statusText}`);
      }
      const successMessage = await response.json();
      console.log("Categoria renomeada com sucesso!", successMessage.message);
      return successMessage.message;
    } catch (error) {
      console.error(`Erro ao renomear categoria de '${oldCategoryName}' para '${newCategoryName}':`, error);
      throw error;
    }
  },
};

export { faqService };