import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import Header from './components/Header';
import FAQSection from './components/FAQSection';
import AIAssistantSection from './components/AIAssistantSection';
import ManageFAQsSection from './components/ManageFAQsSection';
import { FAQ as FAQType } from './types';
import { faqService } from './services/faqService';
import { SuggestedFAQProposal } from './components/AIAssistantSection';

const extractImageUrlsFromMarkdown = (markdownText: string): string[] => {
  const imageUrls: string[] = [];
  const regex = /!\[.*?\]\((.*?)\)/g;
  let match;
  while ((match = regex.exec(markdownText)) !== null) {
    if (match[1]) {
      imageUrls.push(match[1]);
    }
  }
  return imageUrls;
};

const getFilenameFromImageUrl = (imageUrl: string): string | null => {
  const parts = imageUrl.split('/');
  const filename = parts[parts.length - 1];
  if (filename && filename.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i)) {
    return filename;
  }
  return null;
};

const FAQManagePage: React.FC<{
  faqs: FAQType[];
  onAddFAQ: (formData: FormData) => Promise<FAQType>;
  onSaveEditedFAQ: (formData: FormData, faqId: string) => Promise<void>;
  onCancel: () => void; // A prop onCancel é requerida aqui
}> = ({ faqs, onAddFAQ, onSaveEditedFAQ, onCancel }) => { // onCancel é desestruturado aqui
  const { id } = useParams<{ id: string }>();
  const faqToEdit = id ? faqs.find(faq => faq.id === id) : null;
  const navigate = useNavigate();

  const handleSave = async (formData: FormData, currentFaqId?: string) => {
    if (currentFaqId) {
      await onSaveEditedFAQ(formData, currentFaqId);
      navigate('/faqs');
    } else {
      await onAddFAQ(formData);
      navigate('/faqs');
    }
  };

  const handleCancel = () => { // Definição de handleCancel dentro de FAQManagePage
    navigate('/faqs');
  };

  return (
    <ManageFAQsSection
      faqToEdit={faqToEdit}
      onAddFAQ={handleSave as any}
      onSaveEditedFAQ={handleSave as any}
      onCancel={handleCancel} // Uso de handleCancel, que é visível aqui
    />
  );
};

const AppContent: React.FC = () => {
  const [faqs, setFaqs] = useState<FAQType[]>([]);
  const [loadingFaqs, setLoadingFaqs] = useState(true);
  const navigate = useNavigate();

  const fetchFaqs = useCallback(async () => {
    setLoadingFaqs(true);
    try {
      const fetchedFaqs = await faqService.loadFAQs();
      setFaqs(fetchedFaqs);
    } catch (error) {
      console.error("Falha ao carregar FAQs:", error);
    } finally {
      setLoadingFaqs(false);
    }
  }, []);

  useEffect(() => {
    fetchFaqs();
  }, [fetchFaqs]);

  useEffect(() => {
    let anonymousUserId = localStorage.getItem('anonymousUserId');
    if (!anonymousUserId) {
      anonymousUserId = uuidv4();
      localStorage.setItem('anonymousUserId', anonymousUserId);
    }
    console.log("Anonymous User ID:", anonymousUserId);
  }, []);

  const addFAQ = useCallback(async (formData: FormData) => {
    try {
      const addedFaq = await faqService.saveFAQs(formData);
      setFaqs((prevFaqs) => [addedFaq, ...prevFaqs]);
      return addedFaq;
    } catch (error) {
      console.error("Erro ao adicionar FAQ no App:", error);
      throw error;
    }
  }, []);

  const handleFaqAction = useCallback(async (
    action: 'add' | 'update' | 'delete' | 'deleteCategory' | 'renameCategory',
    proposal: SuggestedFAQProposal
  ): Promise<string | void> => {
    try {
      if (action === 'add') {
        const formData = new FormData();
        formData.append('question', proposal.question || '');
        formData.append('answer', proposal.answer || '');
        formData.append('category', proposal.category || '');
        if (proposal.attachments) {
          formData.append('_attachmentsData', JSON.stringify(proposal.attachments));
        }
        formData.append('documentText', proposal.documentText || '');

        await faqService.saveFAQs(formData);
        await fetchFaqs();
        return;
      } else if (action === 'update') {
        if (!proposal.id) throw new Error("ID do FAQ é obrigatório para atualização.");

        const oldFaq = faqs.find(f => f.id === proposal.id);
        if (oldFaq && oldFaq.answer && proposal.answer !== undefined) {
          const oldImageUrls = extractImageUrlsFromMarkdown(oldFaq.answer);
          const newImageUrls = extractImageUrlsFromMarkdown(proposal.answer);
          const imagesToRemove = oldImageUrls.filter(oldUrl => !newImageUrls.includes(oldUrl));

          for (const imageUrl of imagesToRemove) {
            const filename = getFilenameFromImageUrl(imageUrl);
            if (filename) {
              try {
                const response = await fetch(`/api/uploads/${filename}`, { method: 'DELETE' });
                if (!response.ok) {
                  const errorText = await response.text();
                  console.warn(`Aviso: Falha ao remover imagem ${filename} do servidor (Status: ${response.status}). Detalhes: ${errorText}`);
                } else {
                  console.log(`Imagem ${filename} associada ao FAQ ${proposal.id} removida do servidor.`);
                }
              } catch (imageDeleteError) {
                console.warn(`Aviso: Erro inesperado ao tentar remover imagem ${filename}:`, imageDeleteError);
              }
            }
          }
        }

        const formData = new FormData();
        formData.append('id', proposal.id);
        formData.append('question', proposal.question || '');
        formData.append('answer', proposal.answer || '');
        formData.append('category', proposal.category || '');
        if (proposal.attachments) {
          formData.append('_attachmentsData', JSON.stringify(proposal.attachments));
        }
        formData.append('documentText', proposal.documentText || '');

        await faqService.updateFAQ(formData, proposal.id);
        await fetchFaqs();
        return;
      } else if (action === 'delete') {
        if (!proposal.id) throw new Error("ID do FAQ é obrigatório para exclusão.");
        const faqAnswerForImageDeletion = proposal.answer || faqs.find(f => f.id === proposal.id)?.answer;

        if (faqAnswerForImageDeletion) {
          const imageUrls = extractImageUrlsFromMarkdown(faqAnswerForImageDeletion);
          for (const imageUrl of imageUrls) {
            const filename = getFilenameFromImageUrl(imageUrl);
            if (filename) {
              try {
                const response = await fetch(`/api/uploads/${filename}`, { method: 'DELETE' });
                if (!response.ok) {
                  const errorText = await response.text();
                  console.warn(`Aviso: Falha ao remover imagem ${filename} do servidor (Status: ${response.status}). Detalhes: ${errorText}`);
                } else {
                  console.log(`Imagem ${filename} associada ao FAQ ${proposal.id} removida do servidor.`);
                }
              } catch (imageDeleteError) {
                console.warn(`Aviso: Erro inesperado ao tentar remover imagem ${filename}:`, imageDeleteError);
              }
            }
          }
        } else {
          console.warn(`Aviso: Resposta da FAQ (${proposal.id}) não disponível para extração de imagem. Imagens não serão removidas.`);
        }

        await faqService.deleteFAQ(proposal.id);
        await fetchFaqs();
        return "FAQ excluído com sucesso!";
      } else if (action === 'deleteCategory') {
        if (!proposal.categoryName) throw new Error("Nome da categoria é obrigatório para exclusão por categoria.");
        const successMessage = await faqService.deleteFAQsByCategory(proposal.categoryName);
        await fetchFaqs();
        return successMessage;
      } else if (action === 'renameCategory') {
        if (!proposal.oldCategoryName || !proposal.newCategoryName) {
          throw new Error("Nomes da categoria antiga e nova são obrigatórios para renomear.");
        }
        const successMessage = await faqService.renameCategory(proposal.oldCategoryName, proposal.newCategoryName);
        await fetchFaqs();
        return successMessage;
      }
      return;
    } catch (error) {
      console.error(`Erro ao ${action} FAQ no App:`, error);
      throw error;
    }
  }, [faqs, fetchFaqs]);

  const handleSaveEditedFAQ = useCallback(async (formData: FormData, faqId: string) => {
    try {
      await faqService.updateFAQ(formData, faqId);
      console.log(`FAQ ${faqId} atualizado com sucesso.`);
      await fetchFaqs();
    } catch (error) {
      console.error(`Falha ao atualizar FAQ ${faqId}:`, error);
      alert(`Falha ao atualizar FAQ: ${error instanceof Error ? error.message : "Erro desconhecido."}`);
    }
  }, [fetchFaqs]);

  const handleEditFAQClick = useCallback((faq: FAQType) => {
    navigate(`/manage-faq/${faq.id}`);
  }, [navigate]);

  const handleDeleteFAQClick = useCallback(async (id: string) => {
    try {
      const faqToDeleteCompletely = faqs.find(f => f.id === id);
      if (faqToDeleteCompletely) {
        await handleFaqAction('delete', { action: 'delete', id, answer: faqToDeleteCompletely.answer });
        console.log(`FAQ ${id} excluído com sucesso.`);
        await fetchFaqs();
      } else {
        console.warn(`FAQ com ID ${id} não encontrado no estado para exclusão completa. Tentando excluir apenas o registro.`);
        await handleFaqAction('delete', { action: 'delete', id });
      }
    } catch (error) {
      console.error(`Falha ao excluir FAQ ${id}:`, error);
      alert(`Falha ao excluir FAQ: ${error instanceof Error ? error.message : "Erro desconhecido."}`);
    }
  }, [faqs, handleFaqAction]);


  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <Header />
      {/* A classe 'container' e 'mx-auto' foram movidas para o elemento <main> */}
      <main className="flex-grow container mx-auto px-4 py-8 flex flex-col">
        {loadingFaqs ? (
          <div className="text-center text-slate-600">Carregando FAQs...</div>
        ) : (
          <Routes>
            <Route path="/" element={<FAQSection
              faqs={faqs}
              onEditFAQ={handleEditFAQClick}
              onDeleteFAQ={handleDeleteFAQClick}
            />} />
            <Route path="/faqs" element={<FAQSection
              faqs={faqs}
              onEditFAQ={handleEditFAQClick}
              onDeleteFAQ={handleDeleteFAQClick}
            />} />
            <Route path="/ai-assistant" element={<AIAssistantSection
              faqs={faqs}
              onFaqAction={async (action, proposal) => {
                const result = await handleFaqAction(action, proposal);
                await fetchFaqs();
                return result;
              }}
            />
            } />
            <Route path="/manage-faq/new" element={<FAQManagePage
              faqs={faqs}
              onAddFAQ={addFAQ}
              onSaveEditedFAQ={handleSaveEditedFAQ}
              onCancel={() => navigate('/faqs')}
            />} />
            <Route path="/manage-faq/:id" element={<FAQManagePage
              faqs={faqs}
              onAddFAQ={addFAQ}
              onSaveEditedFAQ={handleSaveEditedFAQ}
              onCancel={() => navigate('/faqs')}
            />} />
          </Routes>
        )}
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <AppContent />
    </Router>
  );
};

export default App;