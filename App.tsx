import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import Header from './components/Header';
import FAQSection from './components/FAQSection';
import AIAssistantSection from './components/AIAssistantSection';
import ManageFAQsSection from './components/ManageFAQsSection';
import Footer from './components/Footer';
import { FAQ as FAQType } from './types';
import { faqService } from './services/faqService';
import { SuggestedFAQProposal } from './components/AIAssistantSection';

// Função auxiliar para extrair URLs de imagem de texto Markdown
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

// Função para obter o filename a partir da URL (ex: /uploads/image-123.png -> image-123.png)
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

// NOVO: Componente auxiliar para a página de edição/criação de FAQ (renderizado pelas rotas)
const FAQManagePage: React.FC<{
  faqs: FAQType[];
  onAddFAQ: (newFaqData: Omit<FAQType, 'id'>) => Promise<FAQType>;
  // CORRIGIDO: Agora a tipagem de onSaveEditedFAQ está consistente com o que handleSaveEditedFAQ realmente passa
  onSaveEditedFAQ: (updatedFaqData: FAQType & { documentUrl?: string; documentText?: string; }) => Promise<void>;
  // onCancel é adaptado dentro deste componente
}> = ({ faqs, onAddFAQ, onSaveEditedFAQ }) => {
  const { id } = useParams<{ id: string }>(); // Pega o ID da URL
  // Encontra a FAQ para edição, ou null se for uma nova FAQ (rota /new)
  const faqToEdit = id ? faqs.find(faq => faq.id === id) : null;
  const navigate = useNavigate();

  // Função para salvar edição adaptada para navegar de volta
  const handleSave = async (updatedFaqData: Omit<FAQType, 'id'>) => {
    if (faqToEdit) { // Modo de edição
      await onSaveEditedFAQ({ ...updatedFaqData, id: faqToEdit.id });
      navigate('/faqs'); // Volta para a lista de FAQs após salvar
    } else { // Se for modo de criação
      await onAddFAQ(updatedFaqData); // <--- CORRIGIDO
      navigate('/faqs'); // Volta para a lista de FAQs após adicionar
    }
  };

  // Função para cancelar edição/criação, adaptada para navegar de volta
  const handleCancel = () => {
    navigate('/faqs'); // Volta para a lista de FAQs
  };

  return (
    <ManageFAQsSection
      faqToEdit={faqToEdit}
      onAddFAQ={onAddFAQ}
      onSaveEditedFAQ={handleSave}
      onCancel={handleCancel}
    />
  );
};


// NOVO: Componente Wrapper para o conteúdo principal que usa o roteador e hooks
const AppContent: React.FC = () => {
  const [faqs, setFaqs] = useState<FAQType[]>([]);
  const [loadingFaqs, setLoadingFaqs] = useState(true);
  const navigate = useNavigate(); // Hook para navegação

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

  // Função para adicionar FAQ
  const addFAQ = useCallback(async (newFaqData: Omit<FAQType, 'id'> & { documentUrl?: string; documentText?: string }) => {
    try {
      const addedFaq = await faqService.saveFAQs(newFaqData);
      setFaqs((prevFaqs) => [addedFaq, ...prevFaqs]);
      return addedFaq;
    } catch (error) {
      console.error("Erro ao adicionar FAQ no App:", error);
      throw error;
    }
  }, []);

  // Lida com todas as ações de FAQ (usada por AIAssistantSection e FAQSection)
  const handleFaqAction = useCallback(async (
    action: 'add' | 'update' | 'delete' | 'deleteCategory' | 'renameCategory',
    faqData: SuggestedFAQProposal
  ): Promise<string | void> => { // Tipo de retorno agora é Promise<string | void>
    try {
      if (action === 'add') {
        // Não precisamos do retorno de faqService.saveFAQs para atualizar o estado aqui.
        // setFaqs será feito por fetchFaqs() após a ação.
        await faqService.saveFAQs(faqData as Omit<FAQType, 'id'>);
        return; // Retorna void para 'add'
      } else if (action === 'update') {
        if (!faqData.id) throw new Error("ID do FAQ é obrigatório para atualização.");

        // Lógica para remover imagens antigas
        const oldFaq = faqs.find(f => f.id === faqData.id);
        if (oldFaq && oldFaq.answer && faqData.answer !== undefined) {
          const oldImageUrls = extractImageUrlsFromMarkdown(oldFaq.answer);
          const newImageUrls = extractImageUrlsFromMarkdown(faqData.answer);
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
                  console.log(`Imagem ${filename} associada ao FAQ ${faqData.id} removida do servidor durante a atualização.`);
                }
              } catch (imageDeleteError) {
                console.warn(`Aviso: Erro inesperado ao tentar remover imagem ${filename} durante a atualização:`, imageDeleteError);
              }
            }
          }
        }
        await faqService.updateFAQ(faqData as FAQType);
        return; // Retorna void para 'update'
      } else if (action === 'delete') {
        if (!faqData.id) throw new Error("ID do FAQ é obrigatório para exclusão.");

        const faqAnswerForImageDeletion = faqData.answer || faqs.find(f => f.id === faqData.id)?.answer;

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

        await faqService.deleteFAQ(faqData.id);
        return "FAQ excluído com sucesso!"; // Retorna string para 'delete'
      } else if (action === 'deleteCategory') {
        if (!faqData.categoryName) throw new Error("Nome da categoria é obrigatório para exclusão por categoria.");
        // Remova a lógica de deletar imagens por categoria aqui, se quiser que ela seja feita apenas pelo backend.
        // O backend deve cuidar da limpeza dos arquivos associados.
        const successMessage = await faqService.deleteFAQsByCategory(faqData.categoryName);
        return successMessage; // Retorna string para 'deleteCategory'
      } else if (action === 'renameCategory') {
        if (!faqData.oldCategoryName || !faqData.newCategoryName) {
          throw new Error("Nomes da categoria antiga e nova são obrigatórios para renomear.");
        }
        const successMessage = await faqService.renameCategory(faqData.oldCategoryName, faqData.newCategoryName);
        return successMessage; // Retorna string para 'renameCategory'
      }
      return; // Retorno padrão, se nenhuma das ações acima for correspondida
    } catch (error) {
      console.error(`Erro ao ${action} FAQ no App:`, error);
      throw error;
    }
  }, [faqs]); // 'faqs' ainda é dependência por causa do `faqs.find` e `extractImageUrlsFromMarkdown` no delete/update.
  // NOVO: Função para recarregar os FAQs do servidor
  const fetchFaqs = useCallback(async () => {
    setLoadingFaqs(true);
    try {
      const fetchedFaqs = await faqService.loadFAQs();
      setFaqs(fetchedFaqs);
    } catch (error) {
      console.error("Falha ao recarregar FAQs:", error);
    } finally {
      setLoadingFaqs(false);
    }
  }, []); // Dependência vazia, pois só recarrega dados

  // Funções para passar ao FAQSection - agora elas navegam
  const handleSaveEditedFAQ = useCallback(async (updatedFaqData: FAQType & { documentUrl?: string; documentText?: string }) => {
    try {
      // CORRIGIDO: Adiciona explicitamente 'action: 'update'' ao objeto
      await handleFaqAction('update', { ...updatedFaqData, action: 'update' });
      console.log(`FAQ ${updatedFaqData.id} atualizado com sucesso.`);
      await fetchFaqs();
    } catch (error) {
      console.error(`Falha ao atualizar FAQ ${updatedFaqData.id}:`, error);
      alert(`Falha ao atualizar FAQ: ${error instanceof Error ? error.message : "Erro desconhecido."}`);
    }
  }, [handleFaqAction]);

  const handleEditFAQClick = useCallback((faq: FAQType) => {
    navigate(`/manage-faq/${faq.id}`); // Navega para a rota de edição com o ID
  }, [navigate]);

  const handleDeleteFAQClick = useCallback(async (id: string) => {
    try {
      // Encontra a FAQ completa NO MOMENTO DA CLICADA para garantir que a `answer` não esteja stale
      const faqToDeleteCompletely = faqs.find(f => f.id === id);
      if (faqToDeleteCompletely) {
        // CORRIGIDO: Adiciona action: 'delete' ao objeto
        await handleFaqAction('delete', { action: 'delete', id, answer: faqToDeleteCompletely.answer });
        console.log(`FAQ ${id} excluído com sucesso.`);
        await fetchFaqs();
      } else {
        // CORRIGIDO: Adiciona action: 'delete' ao objeto
        console.warn(`FAQ com ID ${id} não encontrado no estado para exclusão completa. Tentando excluir apenas o registro.`);
        await handleFaqAction('delete', { action: 'delete', id });
      }
    } catch (error) {
      console.error(`Falha ao excluir FAQ ${id}:`, error);
      alert(`Falha ao excluir FAQ: ${error instanceof Error ? error.message : "Erro desconhecido."}`);
    }
  }, [faqs, handleFaqAction]);


  return (
    <div className="min-h-screen flex flex-col">
      {/* O Header agora usará o useNavigate para mudar de rota */}
      <Header /> {/* currentView e setCurrentView não são mais passados diretamente */}
      <main className="flex-grow container mx-auto px-4 py-8">
        {loadingFaqs ? (
          <div className="text-center text-slate-600">Carregando FAQs...</div>
        ) : (
          <Routes> {/* <--- Define as rotas aqui */}
            {/* Rota padrão para / e /faqs */}
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
            {/* Rota para o Assistente IA */}
            <Route path="/ai-assistant" element={<AIAssistantSection
              faqs={faqs}
              // MODIFICADO: Envolve handleFaqAction para chamar fetchFaqs
              onFaqAction={async (action, proposal) => {
                const result = await handleFaqAction(action, proposal); // Executa a ação
                await fetchFaqs(); // Recarrega os FAQs após a ação
                return result; // Retorna o resultado (string ou void) para AIAssistantSection processar a mensagem
              }}
            />
            } />
            {/* Rota para CRIAR NOVO FAQ */}
            <Route path="/manage-faq/new" element={<FAQManagePage
              faqs={faqs} // Passa faqs para que FAQManagePage possa encontrar a FAQ para edição
              onAddFAQ={addFAQ} // Passa a função para adicionar
              onSaveEditedFAQ={handleSaveEditedFAQ} // Passa a função para salvar edição
            // onCancel é adaptado dentro de FAQManagePage
            />} />
            {/* Rota para EDITAR FAQ EXISTENTE */}
            <Route path="/manage-faq/:id" element={<FAQManagePage
              faqs={faqs} // Passa faqs para que FAQManagePage possa encontrar a FAQ para edição
              onAddFAQ={addFAQ} // Passa a função para adicionar (necessário pois ManageFAQsSection a espera)
              onSaveEditedFAQ={handleSaveEditedFAQ} // Passa a função para salvar edição
            // onCancel é adaptado dentro de FAQManagePage
            />} />
          </Routes>
        )}
      </main>
      <Footer />
    </div>
  );
};

// Componente App principal que envolve AppContent com BrowserRouter
const App: React.FC = () => {
  return (
    <Router>
      <AppContent />
    </Router>
  );
};

export default App;