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
  // ÚNICA DECLARAÇÃO: Lida com todas as ações de FAQ (usada por AIAssistantSection e FAQSection)
  const handleFaqAction = useCallback(async (
    action: 'add' | 'update' | 'delete' | 'deleteCategory' | 'renameCategory',
    faqData: Omit<FAQType, 'id'> & { id?: string; categoryName?: string; oldCategoryName?: string; newCategoryName?: string; reason?: string }
  ) => {
    try {
      let result: FAQType | string | null = null;

      if (action === 'add') {
        result = await faqService.saveFAQs(faqData);
        setFaqs((prevFaqs) => [result as FAQType, ...prevFaqs]);
      } else if (action === 'update') {
        if (!faqData.id) throw new Error("ID do FAQ é obrigatório para atualização.");
        result = await faqService.updateFAQ(faqData as FAQType);
        setFaqs((prevFaqs) => prevFaqs.map(f => (f.id === (result as FAQType).id ? (result as FAQType) : f)));
      } else if (action === 'delete') {
        if (!faqData.id) throw new Error("ID do FAQ é obrigatório para exclusão.");
        // NOVO: Lógica para remover imagens associadas antes de excluir o FAQ
        const faqToDelete = faqs.find(f => f.id === faqData.id); // Encontra a FAQ no estado atual
        if (faqToDelete && faqToDelete.answer) {
          const imageUrls = extractImageUrlsFromMarkdown(faqToDelete.answer);
          for (const imageUrl of imageUrls) {
            const filename = getFilenameFromImageUrl(imageUrl);
            if (filename) {
              try {
                // Chama o novo endpoint DELETE /api/uploads/:filename
                const response = await fetch(`/api/uploads/${filename}`, {
                  method: 'DELETE',
                });
                if (!response.ok) {
                  // Se a resposta não for OK, logar um aviso mas não parar o processo
                  const errorText = await response.text();
                  console.warn(`Aviso: Falha ao remover imagem ${filename} do servidor (Status: ${response.status}). Detalhes: ${errorText}`);
                } else {
                  console.log(`Imagem ${filename} associada ao FAQ ${faqData.id} removida do servidor.`);
                }
              } catch (imageDeleteError) {
                // Captura erros de rede ou outros erros na chamada fetch
                console.warn(`Aviso: Erro inesperado ao tentar remover imagem ${filename}:`, imageDeleteError);
              }
            }
          }
        }
        await faqService.deleteFAQ(faqData.id); // Exclui o FAQ em si
        setFaqs((prevFaqs) => prevFaqs.filter(f => f.id !== faqData.id));
        result = "FAQ excluído com sucesso!";
      } else if (action === 'deleteCategory') {
        if (!faqData.categoryName) throw new Error("Nome da categoria é obrigatório para exclusão por categoria.");
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
  }, []);


  // Funções específicas para passar ao FAQSection
  const handleEditFAQClick = useCallback(async (updatedFaq: FAQType) => {
    try {
      // Chama a função centralizada handleFaqAction com a ação 'update'
      // e os dados completos da FAQ atualizada.
      await handleFaqAction('update', updatedFaq);
      console.log(`FAQ ${updatedFaq.id} atualizado com sucesso.`);
    } catch (error) {
      console.error(`Falha ao atualizar FAQ ${updatedFaq.id}:`, error);
      // Opcional: Mostrar um alerta de erro para o usuário
      alert(`Falha ao atualizar FAQ: ${error instanceof Error ? error.message : "Erro desconhecido."}`);
    }
  }, [handleFaqAction]);

  const handleDeleteFAQClick = useCallback(async (id: string) => {
    try {
      await handleFaqAction('delete', { id });
      console.log(`FAQ ${id} excluído com sucesso.`);
    } catch (error) {
      console.error(`Falha ao excluir FAQ ${id}:`, error);
      alert(`Falha ao excluir FAQ: ${error instanceof Error ? error.message : "Erro desconhecido."}`);
    }
  }, [handleFaqAction]);

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
              // onAddFAQ={addFAQ}
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