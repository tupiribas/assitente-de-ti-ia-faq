import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import FAQSection from './components/FAQSection';
import AIAssistantSection from './components/AIAssistantSection';
import ManageFAQsSection from './components/ManageFAQsSection';
import Footer from './components/Footer';
import { AppView, FAQ as FAQType } from './types';
import { faqService } from './services/faqService';

// NOVO: Função auxiliar para extrair URLs de imagem de texto Markdown
const extractImageUrlsFromMarkdown = (markdownText: string): string[] => {
  const imageUrls: string[] = [];
  // Regex para encontrar sintaxe de imagem Markdown: ![alt text](url)
  const regex = /!\[.*?\]\((.*?)\)/g;
  let match;
  while ((match = regex.exec(markdownText)) !== null) {
    if (match[1]) {
      imageUrls.push(match[1]);
    }
  }
  return imageUrls;
};

// NOVO: Função para obter o filename a partir da URL (ex: /uploads/image-123.png -> image-123.png)
const getFilenameFromImageUrl = (imageUrl: string): string | null => {
  // Assume que a URL é algo como /uploads/nome-do-arquivo.extensao
  const parts = imageUrl.split('/');
  const filename = parts[parts.length - 1]; // Pega a última parte
  // Opcional: Validação básica da extensão para garantir que é um arquivo de imagem
  if (filename && filename.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i)) {
    return filename;
  }
  return null;
};

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.FAQ);
  const [faqs, setFaqs] = useState<FAQType[]>([]);
  const [loadingFaqs, setLoadingFaqs] = useState(true);

  // Carregar FAQs ao montar o componente
  useEffect(() => {
    const fetchFaqs = async () => {
      setLoadingFaqs(true);
      try {
        const fetchedFaqs = await faqService.loadFAQs();
        setFaqs(fetchedFaqs);
      } catch (error) {
        console.error("Falha ao carregar FAQs:", error);
      } finally {
        setLoadingFaqs(false);
      }
    };
    fetchFaqs();
  }, []);

  // Função para adicionar FAQ (usada apenas por ManageFAQsSection na view MANAGE_FAQS)
  const addFAQ = useCallback(async (newFaqData: Omit<FAQType, 'id'>) => {
    try {
      const addedFaq = await faqService.saveFAQs(newFaqData);
      setFaqs((prevFaqs) => [addedFaq, ...prevFaqs]);
      return addedFaq;
    } catch (error) {
      console.error("Erro ao adicionar FAQ no App:", error);
      throw error;
    }
  }, []);

  // ÚNICA DECLARAÇÃO: Lida com todas as ações de FAQ (usada por AIAssistantSection e FAQSection)
  const handleFaqAction = useCallback(async (
    action: 'add' | 'update' | 'delete' | 'deleteCategory' | 'renameCategory',
    // ATUALIZADO: faqData agora PODE INCLUIR 'answer' para a ação de 'delete'.
    faqData: Omit<FAQType, 'id'> & { id?: string; categoryName?: string; oldCategoryName?: string; newCategoryName?: string; reason?: string; answer?: string }
  ) => {
    try {
      let result: FAQType | string | null = null;

      if (action === 'add') {
        result = await faqService.saveFAQs(faqData);
        setFaqs((prevFaqs) => [result as FAQType, ...prevFaqs]);
      } else if (action === 'update') {
        if (!faqData.id) throw new Error("ID do FAQ é obrigatório para atualização.");

        // NOVO (Opcional, mas recomendado para updates): Lógica para remover imagens antigas se um FAQ for atualizado e as imagens forem removidas do texto
        // Isso seria mais complexo: exigiria buscar o FAQ antigo, extrair URLs, comparar com as novas URLs.
        // Por simplicidade, este exemplo foca a remoção de imagens APENAS na exclusão completa do FAQ.

        result = await faqService.updateFAQ(faqData as FAQType);
        setFaqs((prevFaqs) => prevFaqs.map(f => (f.id === (result as FAQType).id ? (result as FAQType) : f)));
      } else if (action === 'delete') {
        if (!faqData.id) throw new Error("ID do FAQ é obrigatório para exclusão.");

        // ATUALIZADO: Acessar a resposta da FAQ diretamente de faqData.answer se foi passada.
        // Caso contrário (fallback), tenta encontrar no estado 'faqs'.
        const faqAnswerForImageDeletion = faqData.answer || faqs.find(f => f.id === faqData.id)?.answer;

        if (faqAnswerForImageDeletion) { // Verifica se há conteúdo de resposta para extrair imagens
          const imageUrls = extractImageUrlsFromMarkdown(faqAnswerForImageDeletion);
          for (const imageUrl of imageUrls) {
            const filename = getFilenameFromImageUrl(imageUrl);
            if (filename) {
              try {
                // Chama o novo endpoint DELETE /api/uploads/:filename
                const response = await fetch(`/api/uploads/${filename}`, {
                  method: 'DELETE',
                });
                if (!response.ok) {
                  const errorText = await response.text();
                  console.warn(`Aviso: Falha ao remover imagem ${filename} do servidor (Status: ${response.status}). Detalhes: ${errorText}`);
                } else {
                  console.log(`Imagem ${filename} associada ao FAQ ${faqData.id} removida do servidor.`);
                }
              } catch (imageDeleteError) {
                console.warn(`Aviso: Erro inesperado ao tentar remover imagem ${filename}:`, imageDeleteError);
              }
            }
          }
        } else {
          console.warn(`Aviso: Resposta da FAQ (${faqData.id}) não disponível para extração de imagem. Imagens não serão removidas.`);
        }

        await faqService.deleteFAQ(faqData.id); // Exclui o registro do FAQ
        setFaqs((prevFaqs) => prevFaqs.filter(f => f.id !== faqData.id));
        result = "FAQ excluído com sucesso!";
      } else if (action === 'deleteCategory') {
        if (!faqData.categoryName) throw new Error("Nome da categoria é obrigatório para exclusão por categoria.");
        // Lógica mais complexa para deletar imagens aqui (iterar FAQs da categoria)
        result = await faqService.deleteFAQsByCategory(faqData.categoryName);
        setFaqs((prevFaqs) => prevFaqs.filter(f => f.category.toLowerCase() !== faqData.categoryName!.toLowerCase()));
      } else if (action === 'renameCategory') {
        if (!faqData.oldCategoryName || !faqData.newCategoryName) {
          throw new Error("Nomes da categoria antiga e nova são obrigatórios para renomear.");
        }
        result = await faqService.renameCategory(faqData.oldCategoryName, faqData.newCategoryName);
        setFaqs((prevFaqs) => prevFaqs.map(f =>
          f.category.toLowerCase() === faqData.oldCategoryName!.toLowerCase()
            ? { ...f, category: faqData.newCategoryName! }
            : f
        ));
      }
      return result;
    } catch (error) {
      console.error(`Erro ao ${action} FAQ no App:`, error);
      throw error;
    }
  }, [faqs]); // Dependência em 'faqs' para o 'find' fallback

  // Funções específicas para passar ao FAQSection
  const handleEditFAQClick = useCallback(async (updatedFaq: FAQType) => {
    try {
      await handleFaqAction('update', updatedFaq);
      console.log(`FAQ ${updatedFaq.id} atualizado com sucesso.`);
    } catch (error) {
      console.error(`Falha ao atualizar FAQ ${updatedFaq.id}:`, error);
      alert(`Falha ao atualizar FAQ: ${error instanceof Error ? error.message : "Erro desconhecido."}`);
    }
  }, [handleFaqAction]);

  // ATUALIZADO: handleDeleteFAQClick para passar a resposta diretamente para handleFaqAction
  const handleDeleteFAQClick = useCallback(async (id: string) => {
    try {
      // Encontra a FAQ completa NO MOMENTO DA CLICADA para garantir que a `answer` não esteja stale
      const faqToDeleteCompletely = faqs.find(f => f.id === id);
      if (faqToDeleteCompletely) {
        // Passa o ID E a resposta completa para handleFaqAction
        await handleFaqAction('delete', { id, answer: faqToDeleteCompletely.answer });
        console.log(`FAQ ${id} excluído com sucesso.`);
      } else {
        // Fallback: Se a FAQ não for encontrada no estado (o que não deveria acontecer se ela foi exibida na UI)
        console.warn(`FAQ com ID ${id} não encontrado no estado para exclusão completa. Tentando excluir apenas o registro.`);
        await handleFaqAction('delete', { id }); // Ainda tenta excluir o registro do FAQ
      }
    } catch (error) {
      console.error(`Falha ao excluir FAQ ${id}:`, error);
      alert(`Falha ao excluir FAQ: ${error instanceof Error ? error.message : "Erro desconhecido."}`);
    }
  }, [faqs, handleFaqAction]); // Dependências: 'faqs' para o find, 'handleFaqAction' para a chamada

  return (
    <div className="min-h-screen flex flex-col">
      <Header currentView={currentView} setCurrentView={setCurrentView} />
      <main className="flex-grow container mx-auto px-4 py-8">
        {loadingFaqs ? (
          <div className="text-center text-slate-600">Carregando FAQs...</div>
        ) : (
          <>
            {currentView === AppView.FAQ && (
              <FAQSection
                faqs={faqs}
                onEditFAQ={handleEditFAQClick}
                onDeleteFAQ={handleDeleteFAQClick}
              // onAddFAQ={addFAQ} // Removido anteriormente, está correto
              />
            )}
            {currentView === AppView.AI_ASSISTANT && (
              <AIAssistantSection
                faqs={faqs}
                onFaqAction={handleFaqAction}
              />
            )}
            {currentView === AppView.MANAGE_FAQS && <ManageFAQsSection onAddFAQ={addFAQ} />}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default App;