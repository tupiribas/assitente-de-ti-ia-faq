import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useParams, Navigate, Outlet, useLocation } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import Header from './components/Header';
import FAQSection from './components/FAQSection';
import AIAssistantSection from './components/AIAssistantSection';
import ManageFAQsSection from './components/ManageFAQsSection';
import { FAQ as FAQType, FAQAttachment, User } from './types'; // Importa User e FAQType
import { faqService } from './services/faqService';
import { SuggestedFAQProposal } from './components/AIAssistantSection';
import { AuthProvider, useAuth } from './contexts/AuthContext'; // Importa AuthProvider e useAuth
import LoginPage from './components/pages/LoginPage'; // Garanta que o caminho está correto (ex: ./pages/LoginPage)
import AdminPage from './components/pages/AdminPage'; // Garanta que o caminho está correto (ex: ./pages/AdminPage)
import LoadingSpinner from './components/LoadingSpinner'; // Garanta que o caminho está correto

// --- Funções Auxiliares (Coloque as funções extractImageUrlsFromHtml, getImageUrlsFromFAQAnswer, etc. aqui) ---
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
        credentials: 'include' // Envia cookie de sessão
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
  const location = useLocation(); // Pega a localização atual

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="md" />
        <span className="ml-3 text-slate-500">Verificando acesso...</span>
      </div>
    );
  }

  if (!user) {
    // Redireciona para login, guardando a página de origem
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    // Redireciona para página não autorizada
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />; // Renderiza o componente da rota filha
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
  const [loadingFaqs, setLoadingFaqs] = useState(true); // Controla o loading dos FAQs
  const navigate = useNavigate();
  const { user, isLoading: isAuthLoading } = useAuth(); // Pega usuário e loading de autenticação

  // Função para buscar FAQs
  const fetchFaqs = useCallback(async () => {
    setLoadingFaqs(true);
    try {
      const fetchedFaqs = await faqService.loadFAQs();
      // Ordena os FAQs ao buscar
      setFaqs(fetchedFaqs.sort((a, b) =>
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      ));
    } catch (error) {
      console.error("Falha ao carregar FAQs:", error);
      // Opcional: Mostrar erro para o usuário
    } finally {
      setLoadingFaqs(false);
    }
  }, []);

  // Busca FAQs quando o componente monta
  useEffect(() => {
    fetchFaqs();
  }, [fetchFaqs]);

  // Função para adicionar FAQ (retorna Promise<FAQType>)
  const addFAQ = useCallback(async (formData: FormData): Promise<FAQType> => {
    try {
      const addedFaq = await faqService.saveFAQs(formData);
      // Atualiza estado local e re-ordena
      setFaqs((prevFaqs) =>
        [addedFaq, ...prevFaqs].sort((a, b) =>
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        )
      );
      return addedFaq;
    } catch (error) {
      console.error("Erro ao adicionar FAQ no App:", error);
      alert(`Falha ao adicionar FAQ: ${error instanceof Error ? error.message : "Erro desconhecido."}`);
      throw error; // Re-lança para ManageFAQsSection tratar se necessário
    }
  }, []); // Dependências vazias se não usar 'user' aqui

  // Função para salvar FAQ editado
  const handleSaveEditedFAQ = useCallback(async (formData: FormData, faqId: string) => {
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
      await faqService.updateFAQ(formData, faqId); // Atualiza no backend
      console.log(`[App.tsx - handleSaveEditedFAQ]: FAQ ${faqId} atualizado.`);
      await fetchFaqs(); // Recarrega a lista
    } catch (error) {
      console.error(`[App.tsx - handleSaveEditedFAQ]: Falha ao atualizar FAQ ${faqId}:`, error);
      alert(`Falha ao atualizar FAQ: ${error instanceof Error ? error.message : "Erro desconhecido."}`);
    }
  }, [faqs, fetchFaqs]);

  // Função para lidar com ações sugeridas pela IA
  const handleFaqAction = useCallback(async (
    action: SuggestedFAQProposal['action'],
    proposal: SuggestedFAQProposal
  ): Promise<string | void> => {
    console.log(`[App.tsx - handleFaqAction] Ação recebida: ${action}`);
    try {
      let successMessage: string | void = undefined;
      // Adição
      if (action === 'add') {
        const formData = new FormData();
        formData.append('question', proposal.question || '');
        formData.append('answer', proposal.answer || '');
        formData.append('category', proposal.category || '');
        if (proposal.attachments) formData.append('_attachmentsData', JSON.stringify(proposal.attachments));
        formData.append('documentText', proposal.documentText || '');
        await faqService.saveFAQs(formData);
        successMessage = "FAQ adicionado com sucesso pela IA!";
        // Atualização
      } else if (action === 'update') {
        if (!proposal.id) throw new Error("ID do FAQ obrigatório para 'update'.");
        const formData = new FormData();
        formData.append('question', proposal.question || '');
        formData.append('answer', proposal.answer || '');
        formData.append('category', proposal.category || '');
        if (proposal.attachments) formData.append('_attachmentsData', JSON.stringify(proposal.attachments));
        formData.append('documentText', proposal.documentText || '');
        // Lógica de exclusão de arquivos se a IA sugerir remoção precisaria ser adicionada aqui também
        await faqService.updateFAQ(formData, proposal.id);
        successMessage = "FAQ atualizado com sucesso pela IA!";
        // Exclusão Individual
      } else if (action === 'delete') {
        if (!proposal.id) throw new Error("ID do FAQ obrigatório para 'delete'.");
        const faqToDelete = faqs.find(f => f.id === proposal.id);
        if (faqToDelete) {
          // Excluir arquivos associados
          const imageUrls = getImageUrlsFromFAQAnswer(faqToDelete.answer);
          for (const url of imageUrls) await deleteFileFromServer(url);
          const attachmentUrls = (faqToDelete.attachments || []).map(att => att.url);
          for (const url of attachmentUrls) await deleteFileFromServer(url);
        }
        await faqService.deleteFAQ(proposal.id);
        successMessage = "FAQ excluído com sucesso!"; // Retorna a mensagem padrão
        // Exclusão por Categoria
      } else if (action === 'deleteCategory') {
        if (!proposal.categoryName) throw new Error("Nome da categoria obrigatório para 'deleteCategory'.");
        const faqsInCategory = faqs.filter(faq => faq.category.toLowerCase() === proposal.categoryName?.toLowerCase());
        for (const faq of faqsInCategory) {
          const imageUrls = getImageUrlsFromFAQAnswer(faq.answer);
          for (const url of imageUrls) await deleteFileFromServer(url);
          const attachmentUrls = (faq.attachments || []).map(att => att.url);
          for (const url of attachmentUrls) await deleteFileFromServer(url);
        }
        successMessage = await faqService.deleteFAQsByCategory(proposal.categoryName); // Usa a mensagem do serviço
        // Renomear Categoria
      } else if (action === 'renameCategory') {
        if (!proposal.oldCategoryName || !proposal.newCategoryName) throw new Error("Nomes antigo e novo obrigatórios para 'renameCategory'.");
        successMessage = await faqService.renameCategory(proposal.oldCategoryName, proposal.newCategoryName); // Usa a mensagem do serviço
      }

      await fetchFaqs(); // Recarrega a lista após qualquer ação bem-sucedida
      return successMessage; // Retorna a mensagem de sucesso apropriada

    } catch (error) {
      console.error(`[App.tsx - handleFaqAction]: Erro ao ${action} FAQ:`, error);
      alert(`Falha ao processar ação da IA (${action}): ${error instanceof Error ? error.message : "Erro desconhecido."}`);
      throw error; // Re-lança para AIAssistantSection
    }
  }, [faqs, fetchFaqs]);

  // Navega para a página de edição
  const handleEditFAQClick = useCallback((faq: FAQType) => {
    navigate(`/manage-faq/${faq.id}`);
  }, [navigate]);

  // Lida com o clique no botão excluir na lista de FAQs
  const handleDeleteFAQClick = useCallback(async (id: string) => {
    console.log("[App.tsx - handleDeleteFAQClick]: Iniciando exclusão via botão.", id);
    try {
      // Chama handleFaqAction para centralizar a lógica de exclusão (incluindo arquivos)
      await handleFaqAction('delete', { action: 'delete', id });
      // fetchFaqs já é chamado dentro de handleFaqAction após sucesso
    } catch (error) {
      // Erro já é tratado e alertado dentro de handleFaqAction
      console.error(`[App.tsx - handleDeleteFAQClick]: Falha capturada ao excluir FAQ ${id}.`);
    }
  }, [handleFaqAction]); // Apenas handleFaqAction como dependência


  // Mostra loading principal apenas durante a verificação inicial de autenticação
  if (isAuthLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner size="lg" color="text-orange-600" />
        <p className="ml-4 text-slate-600">Carregando aplicação...</p>
      </div>
    );
  }

  // Renderiza o layout principal após a verificação de auth
  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <Header /> {/* Header agora usa useAuth internamente */}
      <main className="flex-grow container mx-auto px-4 py-8 flex flex-col">
        {/* Mostra loading de FAQs apenas se estiver buscando E a autenticação já terminou */}
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
            // Não passa mais canManage
            />} />
            <Route path="/faqs" element={<FAQSection
              faqs={faqs}
              onEditFAQ={handleEditFAQClick}
              onDeleteFAQ={handleDeleteFAQClick}
            // Não passa mais canManage
            />} />
            <Route path="/ai-assistant" element={<AIAssistantSection
              faqs={faqs}
              onFaqAction={handleFaqAction} // Passa a função unificada
            />} />

            {/* --- Rotas Protegidas (Editor ou Admin) --- */}
            <Route element={<ProtectedRoute allowedRoles={['admin', 'editor']} />}>
              {/* Rota para criar novo FAQ */}
              <Route path="/manage-faq/new" element={
                <ManageFAQsSection
                  // Passa addFAQ diretamente, a navegação é feita dentro dela agora
                  onAddFAQ={async (formData) => {
                    await addFAQ(formData);
                    navigate('/faqs');
                  }}
                  onSaveEditedFAQ={handleSaveEditedFAQ} // handleSaveEditedFAQ já recarrega e navega
                  onCancel={() => navigate('/faqs')}
                />
              } />
              {/* Rota para editar FAQ existente */}
              <Route path="/manage-faq/:id" element={
                <FAQManagePageWrapper // Usa o Wrapper para buscar o FAQ
                  faqs={faqs} // Passa a lista para o wrapper encontrar
                  onAddFAQ={addFAQ} // Passa addFAQ (embora não vá ser usado aqui)
                  onSaveEditedFAQ={handleSaveEditedFAQ} // Passa a função de salvar
                  onCancel={() => navigate('/faqs')}
                />
              } />
            </Route>

            {/* --- Rotas Protegidas (Apenas Admin) --- */}
            <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
              <Route path="/admin/users" element={<AdminPage />} />
              {/* Adicionar outras rotas de admin aqui, se necessário */}
            </Route>

            {/* Rota não encontrada - Redireciona para /faqs */}
            <Route path="*" element={<Navigate to="/faqs" replace />} />
          </Routes>
        )}
      </main>
      {/* <Footer /> Opcional */}
    </div>
  );
};
// --- FIM AppContent ---

// --- Componente FAQManagePageWrapper ---
const FAQManagePageWrapper: React.FC<{
  faqs: FAQType[];
  onAddFAQ: (formData: FormData) => Promise<FAQType>; // Espera Promise<FAQType>
  onSaveEditedFAQ: (formData: FormData, faqId: string) => Promise<void>;
  onCancel: () => void;
}> = ({ faqs, onAddFAQ, onSaveEditedFAQ, onCancel }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const faqToEdit = id ? faqs.find(faq => faq.id === id) : null;

  // Mostra mensagem se ID existe mas FAQ não foi encontrado (após faqs carregarem)
  if (id && faqs.length > 0 && !faqToEdit) {
    return <p className="text-red-500 text-center p-4">FAQ com ID '{id}' não encontrado.</p>;
  }
  // Pode mostrar um loader se ID existe mas faqs ainda não carregaram
  if (id && faqs.length === 0) {
    // return <LoadingSpinner />; // Ou apenas deixa o ManageFAQsSection lidar com faqToEdit sendo null
  }

  // Função passada para ManageFAQsSection que lida com a navegação
  const handleSaveAndNavigate = async (formData: FormData, currentFaqId?: string) => {
    try {
      if (currentFaqId) {
        await onSaveEditedFAQ(formData, currentFaqId);
      } else {
        await onAddFAQ(formData);
      }
      navigate('/faqs'); // Navega após sucesso
    } catch (error) {
      // O erro já deve ter sido alertado pelas funções onSaveEditedFAQ ou onAddFAQ
      console.error("Falha ao salvar/adicionar FAQ no wrapper:", error);
    }
  };

  return (
    <ManageFAQsSection
      faqToEdit={faqToEdit} // Passa o FAQ encontrado (ou null para novo)
      // Ajusta as props para chamar handleSaveAndNavigate
      onAddFAQ={handleSaveAndNavigate}
      onSaveEditedFAQ={handleSaveAndNavigate}
      onCancel={onCancel}
    />
  );
};
// --- FIM FAQManagePageWrapper ---

// --- Componente App Principal ---
const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider> {/* Envolve toda a aplicação */}
        <AppContent />
      </AuthProvider>
    </Router>
  );
};

export default App;