import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useParams, Navigate, Outlet, useLocation } from 'react-router-dom';
import Header from './components/Header';
import FAQSection from './components/FAQSection';
import AIAssistantSection from './components/AIAssistantSection';
import ManageFAQsSection from './components/ManageFAQsSection';
import { FAQ as FAQType, FAQAttachment, User } from './types'; // Importa User e FAQType
import { faqService } from './services/faqService';
import { SuggestedFAQProposal } from './components/AIAssistantSection';
import { AuthProvider, useAuth } from './components/contexts/AuthContext'; // Importa AuthProvider e useAuth
import LoginPage from './components/pages/LoginPage'; // Garanta que o caminho está correto (ex: ./pages/LoginPage)
import AdminPage from './components/pages/AdminPage'; // Garanta que o caminho está correto (ex: ./pages/AdminPage)
import LoadingSpinner from './components/LoadingSpinner'; // Garanta que o caminho está correto
import AdminPromptPage from './components/pages/AdminPage';

// --- Funções Auxiliares ---
const extractImageUrlsFromHtml = (htmlText: string): string[] => {
  const imageUrls: string[] = [];
  if (typeof document === 'undefined' || !htmlText) return [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, 'text/html');
  const imgTags = doc.querySelectorAll('img');
  imgTags.forEach(img => {
    const src = img.getAttribute('src');
    if (src && src.startsWith('/uploads/')) imageUrls.push(src);
  });
  return imageUrls;
};

const getImageUrlsFromFAQAnswer = (answer: string): string[] => {
  return extractImageUrlsFromHtml(answer);
};

const extractDocumentUrlsFromFAQ = (faq: FAQType): string[] => {
  const documentUrls: string[] = [];
  if (faq.attachments && Array.isArray(faq.attachments)) {
    faq.attachments.forEach(att => {
      if (att.type === 'document' && att.url) documentUrls.push(att.url);
    });
  }
  return documentUrls;
};

const getFilenameFromUrl = (url: string): string | null => {
  try {
    const parsedUrl = new URL(url, window.location.origin);
    const pathname = parsedUrl.pathname;
    const parts = pathname.split('/');
    const filename = parts[parts.length - 1];
    if (filename && filename.includes('.')) return decodeURIComponent(filename);
  } catch (e) {
    console.error("Erro ao parsear URL para extrair nome:", url, e);
  }
  return null;
};

const deleteFileFromServer = async (url: string) => {
  const filename = getFilenameFromUrl(url);
  if (filename) {
    try {
      const response = await fetch(`/api/uploads/${filename}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`Aviso: Falha ao remover arquivo ${filename} (Status: ${response.status}). Detalhes: ${errorText}`);
      } else {
        console.log(`Arquivo ${filename} removido do servidor.`);
      }
    } catch (fileDeleteError) {
      console.warn(`Aviso: Erro inesperado ao tentar remover arquivo ${filename}:`, fileDeleteError);
    }
  } else {
    console.warn(`Aviso: Não foi possível extrair nome de arquivo válido da URL ${url} para exclusão.`);
  }
};
// --- FIM Funções Auxiliares ---

// --- Componente ProtectedRoute ---
interface ProtectedRouteProps {
  allowedRoles: Array<User['role']>;
}
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="md" />
        <span className="ml-3 text-slate-500">Verificando acesso...</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
};
// --- FIM ProtectedRoute ---

// --- Componente UnauthorizedPage ---
const UnauthorizedPage: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="text-center p-10 bg-white shadow rounded-lg max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-red-600 mb-4">Acesso Negado</h1>
      <p className="text-slate-700 mt-2 mb-6">Você não tem permissão para acessar esta página.</p>
      <button
        onClick={() => navigate('/faqs')}
        className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors"
      >
        Voltar para FAQs
      </button>
    </div>
  );
};
// --- FIM UnauthorizedPage ---

// --- Componente AppContent ---
const AppContent: React.FC = () => {
  const [faqs, setFaqs] = useState<FAQType[]>([]);
  const [loadingFaqs, setLoadingFaqs] = useState(true);
  const navigate = useNavigate();
  const { user, isLoading: isAuthLoading } = useAuth();

  const fetchFaqs = useCallback(async () => {
    setLoadingFaqs(true);
    try {
      const fetchedFaqs = await faqService.loadFAQs();
      setFaqs(fetchedFaqs.sort((a, b) =>
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      ));
    } catch (error) {
      console.error("Falha ao carregar FAQs:", error);
    } finally {
      setLoadingFaqs(false);
    }
  }, []);

  useEffect(() => {
    fetchFaqs();
  }, [fetchFaqs]);

  const addFAQ = useCallback(async (formData: FormData): Promise<FAQType> => {
    try {
      const addedFaq = await faqService.saveFAQs(formData);
      setFaqs((prevFaqs) =>
        [addedFaq, ...prevFaqs].sort((a, b) =>
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        )
      );
      return addedFaq;
    } catch (error) {
      console.error("Erro ao adicionar FAQ no App:", error);
      alert(`Falha ao adicionar FAQ: ${error instanceof Error ? error.message : "Erro desconhecido."}`);
      throw error;
    }
  }, []);

  const handleSaveEditedFAQ = useCallback(async (formData: FormData, faqId: string): Promise<void> => { // <-- Garante Promise<void>
    try {
      console.log("[App.tsx - handleSaveEditedFAQ]: Iniciando salvamento.");
      const newAnswer = formData.get('answer') as string;
      const newAttachmentsData = formData.get('_attachmentsData') as string;
      const newAttachments: FAQAttachment[] = newAttachmentsData ? JSON.parse(newAttachmentsData) : [];
      const oldFaq = faqs.find(f => f.id === faqId);

      if (oldFaq) {
        // --- Lógica de exclusão de arquivos ---
        if (oldFaq.answer && newAnswer !== undefined) {
          const oldImageUrls = getImageUrlsFromFAQAnswer(oldFaq.answer);
          const newImageUrls = getImageUrlsFromFAQAnswer(newAnswer);
          const imagesToRemove = oldImageUrls.filter(oldUrl => !newImageUrls.includes(oldUrl));
          for (const imageUrl of imagesToRemove) await deleteFileFromServer(imageUrl);
        }
        const oldAttachments = oldFaq.attachments || [];
        const oldAttachmentUrls = oldAttachments.map(att => att.url);
        const newAttachmentUrls = newAttachments.map(att => att.url);
        const attachmentsToRemove = oldAttachmentUrls.filter(oldUrl => !newAttachmentUrls.includes(oldUrl));
        for (const attachmentUrl of attachmentsToRemove) await deleteFileFromServer(attachmentUrl);
        // --- Fim da lógica de exclusão ---
      } else {
        console.warn("[App.tsx - handleSaveEditedFAQ]: oldFaq NÃO encontrado para ID:", faqId);
      }
      // Chama o serviço que retorna Promise<FAQ>, mas nós retornamos void
      await faqService.updateFAQ(formData, faqId);
      console.log(`[App.tsx - handleSaveEditedFAQ]: FAQ ${faqId} atualizado.`);
      await fetchFaqs();
    } catch (error) {
      console.error(`[App.tsx - handleSaveEditedFAQ]: Falha ao atualizar FAQ ${faqId}:`, error);
      alert(`Falha ao atualizar FAQ: ${error instanceof Error ? error.message : "Erro desconhecido."}`);
      throw error; // Re-lança para que o wrapper possa saber que houve erro (opcional)
    }
  }, [faqs, fetchFaqs]);

  const handleFaqAction = useCallback(async (
    action: SuggestedFAQProposal['action'],
    proposal: SuggestedFAQProposal
  ): Promise<string | void> => {
    // ... (lógica existente sem alterações aqui) ...
    console.log(`[App.tsx - handleFaqAction] Ação recebida: ${action}`);
    try {
      let successMessage: string | void = undefined;
      if (action === 'add') { /* ... */ }
      else if (action === 'update') { /* ... */ }
      else if (action === 'delete') { /* ... */ }
      else if (action === 'deleteCategory') { /* ... */ }
      else if (action === 'renameCategory') { /* ... */ }
      await fetchFaqs();
      return successMessage;
    } catch (error) { /* ... */ throw error; }
  }, [faqs, fetchFaqs]);

  const handleEditFAQClick = useCallback((faq: FAQType) => {
    navigate(`/manage-faq/${faq.id}`);
  }, [navigate]);

  const handleDeleteFAQClick = useCallback(async (id: string) => {
    console.log("[App.tsx - handleDeleteFAQClick]: Iniciando exclusão via botão.", id);
    try {
      const faqToDelete = faqs.find(f => f.id === id);
      await handleFaqAction('delete', { action: 'delete', id, answer: faqToDelete?.answer, attachments: faqToDelete?.attachments });
    } catch (error) {
      console.error(`[App.tsx - handleDeleteFAQClick]: Falha capturada ao excluir FAQ ${id}.`);
    }
  }, [faqs, handleFaqAction]);


  if (isAuthLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner size="lg" color="text-orange-600" />
        <p className="ml-4 text-slate-600">Carregando aplicação...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-8 flex flex-col">
        {loadingFaqs ? (
          <div className="text-center text-slate-500 py-10">Carregando FAQs...</div>
        ) : (
          <Routes>
            {/* --- Rotas Públicas --- */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />
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
              onFaqAction={handleFaqAction}
            />} />

            {/* --- Rotas Protegidas (Editor ou Admin) --- */}
            <Route element={<ProtectedRoute allowedRoles={['admin', 'editor']} />}>
              {/* Rota para criar novo FAQ */}
              <Route path="/manage-faq/new" element={
                <ManageFAQsSection
                  // **CORREÇÃO AQUI:** Retorna explicitamente o resultado de addFAQ
                  onAddFAQ={async (formData): Promise<FAQType> => { // Adiciona o tipo de retorno explícito
                    const addedFaq = await addFAQ(formData); // Guarda o resultado
                    navigate('/faqs');
                    return addedFaq; // Retorna o FAQ adicionado
                  }}
                  onSaveEditedFAQ={async (formData, faqId) => { // Esta já retorna Promise<void> implicitamente
                    await handleSaveEditedFAQ(formData, faqId);
                    navigate('/faqs');
                  }}
                  onCancel={() => navigate('/faqs')}
                />
              } />
              {/* Rota para editar FAQ existente (usa o Wrapper que já foi corrigido) */}
              <Route path="/manage-faq/:id" element={
                <FAQManagePageWrapper
                  faqs={faqs}
                  onAddFAQ={addFAQ}
                  onSaveEditedFAQ={handleSaveEditedFAQ}
                  onCancel={() => navigate('/faqs')}
                />
              } />
            </Route>

            {/* --- Rotas Protegidas (Apenas Admin) --- */}
            <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
              <Route path="/admin/users" element={<AdminPage />} />
              <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                <Route path="/admin/users" element={<AdminPage />} />
                <Route path="/admin/prompt" element={<AdminPromptPage />} /> {/* <-- Rota adicionada */}
                {/* Outras futuras rotas de admin aqui */}
              </Route>
            </Route>

            {/* Rota não encontrada */}
            <Route path="*" element={<Navigate to="/faqs" replace />} />
          </Routes>
        )}
      </main>
      {/* <Footer /> */}
    </div>
  );
};
// --- FIM AppContent ---

// --- Componente FAQManagePageWrapper ---
const FAQManagePageWrapper: React.FC<{
  faqs: FAQType[];
  onAddFAQ: (formData: FormData) => Promise<FAQType>;
  onSaveEditedFAQ: (formData: FormData, faqId: string) => Promise<void>; // <-- Espera Promise<void>
  onCancel: () => void;
}> = ({ faqs, onAddFAQ, onSaveEditedFAQ, onCancel }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const faqToEdit = id ? faqs.find(faq => faq.id === id) : null;

  if (id && faqs.length > 0 && !faqToEdit) {
    return <p className="text-red-500 text-center p-4">FAQ com ID '{id}' não encontrado.</p>;
  }

  // **CORREÇÃO AQUI:** Cria funções separadas para Add e Edit dentro do Wrapper
  // Função para ADICIONAR e navegar
  const handleAddAndNavigate = async (formData: FormData): Promise<FAQType> => {
    try {
      const addedFaq = await onAddFAQ(formData); // Chama a função original que retorna FAQ
      navigate('/faqs');
      return addedFaq; // Retorna o FAQ
    } catch (error) {
      console.error("Falha ao adicionar FAQ no wrapper:", error);
      throw error; // Re-lança o erro
    }
  };

  // Função para EDITAR e navegar
  const handleEditAndNavigate = async (formData: FormData, faqId: string): Promise<void> => {
    try {
      await onSaveEditedFAQ(formData, faqId); // Chama a função original que retorna void
      navigate('/faqs');
      // Retorna void implicitamente
    } catch (error) {
      console.error("Falha ao salvar FAQ editado no wrapper:", error);
      // O erro já deve ter sido alertado
      // throw error; // Pode re-lançar se ManageFAQsSection precisar saber
    }
  };


  return (
    <ManageFAQsSection
      faqToEdit={faqToEdit}
      // Passa a função específica para adicionar
      onAddFAQ={handleAddAndNavigate}
      // Passa a função específica para editar
      onSaveEditedFAQ={handleEditAndNavigate}
      onCancel={onCancel}
    />
  );
};
// --- FIM FAQManagePageWrapper ---


// --- Componente App Principal ---
const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
};

export default App;