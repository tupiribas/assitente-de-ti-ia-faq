// assistente-de-ti/App.tsx

import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import FAQSection from './components/FAQSection';
import AIAssistantSection from './components/AIAssistantSection';
import ManageFAQsSection from './components/ManageFAQsSection';
import Footer from './components/Footer';
import { AppView, FAQ as FAQType } from './types';
import { faqService } from './services/faqService';

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
    action: 'add' | 'update' | 'delete' | 'deleteCategory' | 'renameCategory', // Adiciona 'renameCategory'
    faqData: Omit<FAQType, 'id'> & { id?: string; categoryName?: string; oldCategoryName?: string; newCategoryName?: string; reason?: string } // Adiciona oldCategoryName, newCategoryName
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
        await faqService.deleteFAQ(faqData.id);
        setFaqs((prevFaqs) => prevFaqs.filter(f => f.id !== faqData.id));
        result = "FAQ excluído com sucesso!";
      } else if (action === 'deleteCategory') {
        if (!faqData.categoryName) throw new Error("Nome da categoria é obrigatório para exclusão por categoria.");
        result = await faqService.deleteFAQsByCategory(faqData.categoryName);
        setFaqs((prevFaqs) => prevFaqs.filter(f => f.category.toLowerCase() !== faqData.categoryName!.toLowerCase()));
      } else if (action === 'renameCategory') { // NOVO: Lógica para renomear categoria
        if (!faqData.oldCategoryName || !faqData.newCategoryName) {
          throw new Error("Nomes da categoria antiga e nova são obrigatórios para renomear.");
        }
        result = await faqService.renameCategory(faqData.oldCategoryName, faqData.newCategoryName);
        // Atualiza o estado dos FAQs localmente após a renomeação da categoria
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
  const handleEditFAQClick = useCallback((faq: FAQType) => {
    // Isso vai ser tratado dentro do FAQSection, que abre o modal de edição
    console.log("Iniciando edição de FAQ:", faq.id);
  }, []);

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
                onAddFAQ={addFAQ}
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