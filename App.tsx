import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import Header from './components/Header';
import FAQSection from './components/FAQSection';
import AIAssistantSection from './components/AIAssistantSection';
import ManageFAQsSection from './components/ManageFAQsSection';
// import DashboardSection from './components/DashboardSection'; // REMOVIDO: Importação do DashboardSection
import { FAQ as FAQType, FAQAttachment } from './types'; // Importe FAQAttachment
import { faqService } from './services/faqService';
import { SuggestedFAQProposal } from './components/AIAssistantSection';

const extractImageUrlsFromMarkdown = (markdownText: string): string[] => {
  const imageUrls: string[] = [];
  // Regex para capturar URLs de imagens Markdown
  const regex = /!\[.*?\]\((.*?)\)/g;
  let match;
  while ((match = regex.exec(markdownText)) !== null) {
    if (match[1]) {
      imageUrls.push(match[1]);
    }
  }
  return imageUrls;
};

// Nova função para extrair URLs de documentos de um FAQ (seja de documentUrl ou de attachments)
const extractDocumentUrlsFromFAQ = (faq: FAQType): string[] => {
  const documentUrls: string[] = [];
  if (faq.documentUrl) { // Se houver um documentUrl direto (legado ou de sugestão da IA)
    documentUrls.push(faq.documentUrl);
  }
  if (faq.attachments && Array.isArray(faq.attachments)) {
    faq.attachments.forEach(att => {
      if (att.type === 'document' && att.url) {
        documentUrls.push(att.url);
      }
    });
  }
  return documentUrls;
};


const getFilenameFromUrl = (url: string): string | null => {
  const parts = url.split('/');
  const filename = parts[parts.length - 1];
  // Basic check to ensure it looks like a file (has an extension)
  if (filename && filename.includes('.')) {
    return filename;
  }
  return null;
};

// Função auxiliar para deletar um arquivo no servidor
const deleteFileFromServer = async (url: string) => {
  const filename = getFilenameFromUrl(url);
  if (filename) {
    try {
      const response = await fetch(`/api/uploads/${filename}`, { method: 'DELETE' });
      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`Aviso: Falha ao remover arquivo ${filename} do servidor (Status: ${response.status}). Detalhes: ${errorText}`);
      } else {
        console.log(`Arquivo ${filename} removido do servidor.`);
      }
    } catch (fileDeleteError) {
      console.warn(`Aviso: Erro inesperado ao tentar remover arquivo ${filename}:`, fileDeleteError);
    }
  }
};


const FAQManagePage: React.FC<{
  faqs: FAQType[];
  onAddFAQ: (formData: FormData) => Promise<FAQType>;
  onSaveEditedFAQ: (formData: FormData, faqId: string) => Promise<void>;
  onCancel: () => void;
}> = ({ faqs, onAddFAQ, onSaveEditedFAQ, onCancel }) => {
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

  const handleCancel = () => {
    navigate('/faqs');
  };

  return (
    <ManageFAQsSection
      faqToEdit={faqToEdit}
      onAddFAQ={handleSave as any}
      onSaveEditedFAQ={handleSave as any}
      onCancel={handleCancel}
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
        if (oldFaq) {
          // --- Lógica para remover imagens do corpo do texto (Markdown) ---
          if (oldFaq.answer && proposal.answer !== undefined) {
            const oldImageUrls = extractImageUrlsFromMarkdown(oldFaq.answer);
            const newImageUrls = extractImageUrlsFromMarkdown(proposal.answer);
            const imagesToRemove = oldImageUrls.filter(oldUrl => !newImageUrls.includes(oldUrl));
            for (const imageUrl of imagesToRemove) {
              await deleteFileFromServer(imageUrl);
            }
          }

          // --- Lógica para remover anexos de documento/imagem da lista 'attachments' ---
          const oldAttachments = oldFaq.attachments || [];
          const newAttachments = proposal.attachments || [];

          const oldAttachmentUrls = oldAttachments.map(att => att.url);
          const newAttachmentUrls = newAttachments.map(att => att.url);

          const attachmentsToRemove = oldAttachmentUrls.filter(oldUrl => !newAttachmentUrls.includes(oldUrl));

          for (const attachmentUrl of attachmentsToRemove) {
            await deleteFileFromServer(attachmentUrl);
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
        const faqToDeleteCompletely = faqs.find(f => f.id === proposal.id);

        if (faqToDeleteCompletely) {
          // --- Lógica para remover imagens do corpo do texto (Markdown) ---
          const imageUrlsInAnswer = extractImageUrlsFromMarkdown(faqToDeleteCompletely.answer);
          for (const imageUrl of imageUrlsInAnswer) {
            await deleteFileFromServer(imageUrl);
          }

          // --- Lógica para remover anexos de documento/imagem da lista 'attachments' ---
          const attachmentUrls = (faqToDeleteCompletely.attachments || []).map(att => att.url);
          for (const attachmentUrl of attachmentUrls) {
            await deleteFileFromServer(attachmentUrl);
          }
        } else {
          console.warn(`Aviso: FAQ (${proposal.id}) não encontrado no estado para exclusão completa de arquivos.`);
        }

        await faqService.deleteFAQ(proposal.id);
        await fetchFaqs();
        return "FAQ excluído com sucesso!";
      } else if (action === 'deleteCategory') {
        if (!proposal.categoryName) throw new Error("Nome da categoria é obrigatório para exclusão por categoria.");
        
        // --- Lógica para remover todos os arquivos associados aos FAQs da categoria ---
        const faqsInCategory = faqs.filter(faq => faq.category.toLowerCase() === proposal.categoryName?.toLowerCase());
        for (const faq of faqsInCategory) {
            // Remover imagens do corpo do texto
            const imageUrls = extractImageUrlsFromMarkdown(faq.answer);
            for (const url of imageUrls) {
                await deleteFileFromServer(url);
            }
            // Remover anexos da lista de attachments
            const attachmentUrls = (faq.attachments || []).map(att => att.url);
            for (const url of attachmentUrls) {
                await deleteFileFromServer(url);
            }
        }

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
            {/* Rota para o Dashboard (comentada, se ainda não criada) */}
            {/* <Route path="/dashboard" element={<DashboardSection />} /> */}
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