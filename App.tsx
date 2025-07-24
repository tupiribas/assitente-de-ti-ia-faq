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

// FUNÇÃO ATUALIZADA: Extrai URLs de imagens do conteúdo HTML
const extractImageUrlsFromHtml = (htmlText: string): string[] => {
  const imageUrls: string[] = [];
  if (typeof document === 'undefined' || !htmlText) {
    return []; // Retorna vazio se não estiver no ambiente do navegador ou se o texto for vazio
  }
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, 'text/html');
  const imgTags = doc.querySelectorAll('img');
  imgTags.forEach(img => {
    const src = img.getAttribute('src');
    // Garante que a URL seja um upload local do sistema
    if (src && src.startsWith('/uploads/')) {
      imageUrls.push(src);
    }
  });
  return imageUrls;
};

// Nova função auxiliar para extrair URLs de imagens de um FAQ
// Isso pode ser usado para obter todas as imagens de um FAQ, independentemente de estarem em Markdown ou HTML.
// Considerando que o Quill gera HTML, esta é a função primária para imagens.
const getImageUrlsFromFAQAnswer = (answer: string): string[] => {
    return extractImageUrlsFromHtml(answer);
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

  // Lógica de exclusão de imagens ao salvar um FAQ editado
  const handleSaveEditedFAQ = useCallback(async (formData: FormData, faqId: string) => {
    try {
      console.log("[App.tsx - handleSaveEditedFAQ]: Iniciando salvamento de FAQ editado.");
      
      const newAnswer = formData.get('answer') as string; // Obtenha a nova resposta do FormData
      const newAttachmentsData = formData.get('_attachmentsData') as string;
      const newAttachments: FAQAttachment[] = newAttachmentsData ? JSON.parse(newAttachmentsData) : [];

      const oldFaq = faqs.find(f => f.id === faqId); // Encontra o FAQ antigo no estado local

      if (oldFaq) {
        console.log("[App.tsx - handleSaveEditedFAQ]: oldFaq encontrado para comparação.", oldFaq);
        console.log("[App.tsx - handleSaveEditedFAQ]: oldFaq.answer (HTML antigo):", oldFaq.answer);
        console.log("[App.tsx - handleSaveEditedFAQ]: newAnswer (HTML novo do FormData):", newAnswer);

        // --- Lógica para remover imagens do corpo do texto (HTML) ---
        if (oldFaq.answer && newAnswer !== undefined) {
          const oldImageUrls = getImageUrlsFromFAQAnswer(oldFaq.answer);
          const newImageUrls = getImageUrlsFromFAQAnswer(newAnswer); // Usa a nova resposta do FormData
          
          console.log("DEBUG: URLs de imagens antigas extraídas:", oldImageUrls);
          console.log("DEBUG: URLs de imagens novas extraídas:", newImageUrls);

          const imagesToRemove = oldImageUrls.filter(oldUrl => !newImageUrls.includes(oldUrl));
          console.log("DEBUG: Imagens a serem removidas (após filtro):", imagesToRemove);

          for (const imageUrl of imagesToRemove) {
            console.log("DEBUG: Tentando deletar URL:", imageUrl);
            await deleteFileFromServer(imageUrl);
          }
        }

        // --- Lógica para remover anexos de documento/imagem da lista 'attachments' ---
        const oldAttachments = oldFaq.attachments || [];

        const oldAttachmentUrls = oldAttachments.map(att => att.url);
        const newAttachmentUrls = newAttachments.map(att => att.url);

        console.log("DEBUG: URLs de anexos antigas:", oldAttachmentUrls);
        console.log("DEBUG: URLs de anexos novas:", newAttachmentUrls);

        const attachmentsToRemove = oldAttachmentUrls.filter(oldUrl => !newAttachmentUrls.includes(oldUrl));
        console.log("DEBUG: Anexos para remover:", attachmentsToRemove);

        for (const attachmentUrl of attachmentsToRemove) {
          await deleteFileFromServer(attachmentUrl);
        }
      } else {
        console.warn("[App.tsx - handleSaveEditedFAQ]: oldFaq NÃO encontrado para ID:", faqId, ". Não foi possível comparar imagens/anexos para remoção.");
      }

      // Agora, realmente atualiza o FAQ no servidor
      await faqService.updateFAQ(formData, faqId);
      console.log(`[App.tsx - handleSaveEditedFAQ]: FAQ ${faqId} atualizado com sucesso no serviço.`);
      
      // Recarrega os FAQs para atualizar o estado do app
      await fetchFaqs();
    } catch (error) {
      console.error(`[App.tsx - handleSaveEditedFAQ]: Falha ao atualizar FAQ ${faqId}:`, error);
      alert(`Falha ao atualizar FAQ: ${error instanceof Error ? error.message : "Erro desconhecido."}`);
    }
  }, [faqs, fetchFaqs]); // Adicionado 'faqs' às dependências

  const handleFaqAction = useCallback(async (
    action: 'add' | 'update' | 'delete' | 'deleteCategory' | 'renameCategory',
    proposal: SuggestedFAQProposal
  ): Promise<string | void> => {
    // NOVO LOG: Verifica se a função handleFaqAction é chamada
    console.log(`[App.tsx - handleFaqAction] Função acionada com ação: ${action}`);

    try {
      if (action === 'add') {
        // Cenário de adição de FAQ
        console.log("[App.tsx - handleFaqAction]: Ação 'add' iniciada.");
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
        console.log("[App.tsx - handleFaqAction]: FAQ adicionado com sucesso.");
        return;
      } else if (action === 'update') {
        // Cenário de atualização de FAQ - ESTE BLOCO AGORA SÓ É CHAMADO PELA SUGESTÃO DA IA,
        // A LÓGICA DE EXCLUSÃO DE IMAGENS DO EDITOR FOI MOVIDA PARA handleSaveEditedFAQ
        console.log("[App.tsx - handleFaqAction]: Ação 'update' iniciada (via sugestão da IA).");
        if (!proposal.id) throw new Error("ID do FAQ é obrigatório para atualização.");

        // NOTE: A lógica de remoção de arquivos do corpo do texto (editor) e de anexos
        // para *edições manuais* agora está em handleSaveEditedFAQ.
        // Este bloco 'update' em handleFaqAction serve para atualizações sugeridas pela IA.
        // Se a IA sugerir uma atualização que remove uma imagem/anexo, a lógica de exclusão
        // precisaria ser duplicada aqui ou handleFaqAction chamar handleSaveEditedFAQ,
        // mas para simplificar e focar no problema atual, deixaremos como está.

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
        console.log("[App.tsx - handleFaqAction]: FAQ atualizado com sucesso (via sugestão da IA).");
        return;
      } else if (action === 'delete') {
        // Cenário de exclusão de FAQ
        console.log("[App.tsx - handleFaqAction]: Ação 'delete' iniciada.");
        if (!proposal.id) throw new Error("ID do FAQ é obrigatório para exclusão.");
        const faqToDeleteCompletely = faqs.find(f => f.id === proposal.id);

        if (faqToDeleteCompletely) {
          console.log("[App.tsx - handleFaqAction (delete)]: faqToDeleteCompletely encontrado.", faqToDeleteCompletely);
          
          // --- Lógica para remover imagens do corpo do texto (HTML) ---
          const imageUrlsInAnswer = getImageUrlsFromFAQAnswer(faqToDeleteCompletely.answer); // USA A NOVA FUNÇÃO
          console.log("[App.tsx - handleFaqAction (delete)]: Imagens HTML no FAQ para exclusão:", imageUrlsInAnswer);
          for (const imageUrl of imageUrlsInAnswer) {
            await deleteFileFromServer(imageUrl);
          }

          // --- Lógica para remover anexos de documento/imagem da lista 'attachments' ---
          const attachmentUrls = (faqToDeleteCompletely.attachments || []).map(att => att.url);
          console.log("[App.tsx - handleFaqAction (delete)]: Anexos no FAQ para exclusão:", attachmentUrls);
          for (const attachmentUrl of attachmentUrls) {
            await deleteFileFromServer(attachmentUrl);
          }
        } else {
          console.warn(`[App.tsx - handleFaqAction (delete)]: FAQ (${proposal.id}) não encontrado no estado para exclusão completa de arquivos.`);
        }

        await faqService.deleteFAQ(proposal.id);
        await fetchFaqs();
        console.log("[App.tsx - handleFaqAction]: FAQ excluído com sucesso!");
        return "FAQ excluído com sucesso!";
      } else if (action === 'deleteCategory') {
        // Cenário de exclusão por categoria
        console.log("[App.tsx - handleFaqAction]: Ação 'deleteCategory' iniciada.");
        if (!proposal.categoryName) throw new Error("Nome da categoria é obrigatório para exclusão por categoria.");
        
        // --- Lógica para remover todos os arquivos associados aos FAQs da categoria ---
        const faqsInCategory = faqs.filter(faq => faq.category.toLowerCase() === proposal.categoryName?.toLowerCase());
        console.log("[App.tsx - handleFaqAction (deleteCategory)]: FAQs na categoria para exclusão:", faqsInCategory);
        for (const faq of faqsInCategory) {
            // Remover imagens do corpo do texto (HTML)
            const imageUrls = getImageUrlsFromFAQAnswer(faq.answer); // USA A NOVA FUNÇÃO
            console.log(`[App.tsx - handleFaqAction (deleteCategory)]: Imagens HTML do FAQ ${faq.id} para exclusão:`, imageUrls);
            for (const url of imageUrls) {
                await deleteFileFromServer(url);
            }
            // Remover anexos da lista de attachments
            const attachmentUrls = (faq.attachments || []).map(att => att.url);
            console.log(`[App.tsx - handleFaqAction (deleteCategory)]: Anexos do FAQ ${faq.id} para exclusão:`, attachmentUrls);
            for (const url of attachmentUrls) {
                await deleteFileFromServer(url);
            }
        }

        const successMessage = await faqService.deleteFAQsByCategory(proposal.categoryName);
        await fetchFaqs();
        console.log("[App.tsx - handleFaqAction]: Categoria excluída com sucesso.");
        return successMessage;
      } else if (action === 'renameCategory') {
        // Cenário de renomear categoria
        console.log("[App.tsx - handleFaqAction]: Ação 'renameCategory' iniciada.");
        if (!proposal.oldCategoryName || !proposal.newCategoryName) {
          throw new Error("Nomes da categoria antiga e nova são obrigatórios para renomear.");
        }
        const successMessage = await faqService.renameCategory(proposal.oldCategoryName, proposal.newCategoryName);
        await fetchFaqs();
        console.log("[App.tsx - handleFaqAction]: Categoria renomeada com sucesso.");
        return successMessage;
      }
      return;
    } catch (error) {
      console.error(`[App.tsx - handleFaqAction]: Erro ao ${action} FAQ no App:`, error);
      throw error;
    }
  }, [faqs, fetchFaqs]);

  const handleEditFAQClick = useCallback((faq: FAQType) => {
    console.log("[App.tsx - handleEditFAQClick]: Navegando para edição do FAQ.", faq);
    navigate(`/manage-faq/${faq.id}`);
  }, [navigate]);

  const handleDeleteFAQClick = useCallback(async (id: string) => {
    try {
      console.log("[App.tsx - handleDeleteFAQClick]: Iniciando exclusão do FAQ.", id);
      const faqToDeleteCompletely = faqs.find(f => f.id === id);
      if (faqToDeleteCompletely) {
        console.log("[App.tsx - handleDeleteFAQClick]: FAQ encontrado para exclusão completa, chamando handleFaqAction.");
        await handleFaqAction('delete', { action: 'delete', id, answer: faqToDeleteCompletely.answer });
        console.log(`[App.tsx - handleDeleteFAQClick]: FAQ ${id} excluído com sucesso via handleFaqAction.`);
        await fetchFaqs();
      } else {
        console.warn(`[App.tsx - handleDeleteFAQClick]: FAQ com ID ${id} não encontrado no estado para exclusão completa. Tentando excluir apenas o registro.`);
        await handleFaqAction('delete', { action: 'delete', id });
      }
    } catch (error) {
      console.error(`[App.tsx - handleDeleteFAQClick]: Falha ao excluir FAQ ${id}:`, error);
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