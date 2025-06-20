import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage as ChatMessageType, FAQ as FAQType } from '../types';
import ChatMessageItem from './ChatMessageItem';
import ChatInput from './ChatInput';
import LoadingSpinner from './LoadingSpinner';
import { geminiService } from '../services/geminiService'; // Agora um cliente de proxy
// Removida importação de Chat do @google/genai, pois não é mais usada diretamente aqui
import { SparklesIcon, CheckCircleIcon, XCircleIcon, InformationCircleIcon } from './Icons';

// Interface para a sugestão de FAQ proposta pela IA
export interface SuggestedFAQProposal {
  action: 'add' | 'update' | 'delete' | 'deleteCategory' | 'renameCategory';
  id?: string;
  question?: string;
  answer?: string;
  category?: string;
  reason?: string;
  categoryName?: string;
  oldCategoryName?: string;
  newCategoryName?: string;
}

// Props esperadas pelo componente AIAssistantSection
interface AIAssistantSectionProps {
  onFaqAction: (
    action: SuggestedFAQProposal['action'],
    proposal: SuggestedFAQProposal
  ) => Promise<string | void>;
  faqs: FAQType[];
}

// MODIFICADO: Função findRelevantFAQs para incluir informações de imagem E documento no texto de contexto.
const findRelevantFAQs = (query: string, faqsList: FAQType[], topN: number = 2): FAQType[] => {
  if (!query || faqsList.length === 0) return [];

  const queryLower = query.toLowerCase().split(/\s+/).filter(Boolean);

  const scoredFAQs = faqsList.map(faq => {
    let score = 0;
    const questionLower = faq.question.toLowerCase();
    const answerLower = faq.answer.toLowerCase();
    const categoryLower = faq.category.toLowerCase();

    // Extração de alt text de imagens (lógica existente)
    const imageUrlRegex = /!\[(.*?)\]\((.*?)\)/g;
    let imageMatch;
    let imageAltTexts = [];
    while ((imageMatch = imageUrlRegex.exec(faq.answer)) !== null) {
      if (imageMatch[1]) {
        imageAltTexts.push(imageMatch[1].toLowerCase());
      }
    }

    // NOVO: Extração de conteúdo de documento
    const documentContentRegex = /\*\*\*Conteúdo do Documento para IA \(NÃO EDITE\):\*\*\*\n([\s\S]*?)\n\*\*\*FIM DO CONTEÚDO DO DOCUMENTO PARA IA\*\*\*/;
    const documentMatch = faq.answer.match(documentContentRegex);
    const documentTextContent = documentMatch ? documentMatch[1].toLowerCase() : '';

    queryLower.forEach(word => {
      if (questionLower.includes(word)) score += 2;
      if (answerLower.includes(word)) score += 1; // Já inclui o texto do documento aqui
      if (categoryLower.includes(word)) score += 0.5;
      if (imageAltTexts.some(altText => altText.includes(word))) score += 1.5;
      // NOVO: Aumenta a pontuação se a palavra-chave estiver no conteúdo do documento
      if (documentTextContent.includes(word)) score += 3; // Maior peso para conteúdo de documento
    });
    return { faq, score };
  });

  return scoredFAQs
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.faq)
    .slice(0, topN); // Garante que apenas os topN sejam retornados
};

const AIAssistantSection: React.FC<AIAssistantSectionProps> = ({ onFaqAction, faqs }) => {
  const [chatMessages, setChatMessages] = useState<ChatMessageType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Removido chatSession diretamente aqui, pois a sessão é stateless no backend
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [suggestedFAQProposal, setSuggestedFAQProposal] = useState<SuggestedFAQProposal | null>(null);
  const [faqProposalMessage, setFaqProposalMessage] = useState<string | null>(null);


  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [chatMessages, suggestedFAQProposal, faqProposalMessage]);

  // Efeito para inicializar a sessão de chat com a IA
  // MODIFICADO: Apenas envia a mensagem de boas-vindas da IA
  useEffect(() => {
    const initializeChat = async () => {
      setIsLoading(true);
      try {
        const welcomeMessage: ChatMessageType = {
          id: 'welcome-' + Date.now(),
          text: 'Olá! Sou o TI-Helper, seu assistente de IA. Como posso ajudar com seus problemas de TI hoje?',
          sender: 'ai',
          timestamp: new Date(),
          imagePreviewUrl: undefined
        };
        setChatMessages([welcomeMessage]);
      } catch (err) {
        console.error("Erro ao inicializar o chat:", err);
        setError("Não foi possível iniciar o assistente de IA.");
      } finally {
        setIsLoading(false);
      }
    };
    initializeChat();
  }, []); // A dependência vazia indica que só roda na montagem

  // handleFAQProposal (sem alterações)
  const handleFAQProposal = (aiResponseText: string): boolean => {
    const proposalRegex = /\[SUGGEST_FAQ_PROPOSAL\](\{.*?\})\[\/SUGGEST_FAQ_PROPOSAL\]/s;
    const match = aiResponseText.match(proposalRegex);

    if (match && match[1]) {
      try {
        const proposal: SuggestedFAQProposal = JSON.parse(match[1]);

        if (!proposal.action) {
          setError("Proposta de FAQ malformada: Ação não especificada.");
          return false;
        }

        if (proposal.action === 'add' || proposal.action === 'update') {
          if (!proposal.question || !proposal.answer || !proposal.category) {
            setError(`Proposta de FAQ malformada para '${proposal.action}': Pergunta, Resposta e Categoria são obrigatórios.`);
            return false;
          }
          if (proposal.action === 'update' && !proposal.id) {
            setError("Proposta de FAQ malformada: Ação 'update' sem ID.");
            return false;
          }
        } else if (proposal.action === 'delete') {
          if (!proposal.id) {
            setError("Proposta de FAQ malformada: Ação 'delete' sem ID.");
            return false;
          }
        } else if (proposal.action === 'deleteCategory') {
          if (!proposal.categoryName) {
            setError("Proposta de FAQ malformada: Ação 'deleteCategory' sem nome da categoria.");
            return false;
          }
        } else if (proposal.action === 'renameCategory') {
          if (!proposal.oldCategoryName || !proposal.newCategoryName) {
            setError("Proposta de FAQ malformada: Ação 'renameCategory' sem nome da categoria antiga ou nova.");
            return false;
          }
        } else {
          setError(`Proposta de FAQ malformada: Ação desconhecida '${proposal.action}'.`);
          return false;
        }

        setSuggestedFAQProposal(proposal);
        return true;

      } catch (e) {
        console.error("Erro ao parsear JSON da proposta de FAQ:", e);
        setError("A IA tentou sugerir um FAQ, mas houve um erro no formato da sugestão.");
      }
    }
    return false;
  };


  // MODIFICADO: Lógica para enviar mensagem para a IA e processar a resposta (agora com imagem)
  const handleSendMessage = async (inputText: string, imageFile?: File | null) => {
    if ((!inputText.trim() && !imageFile) || suggestedFAQProposal) return;

    // NOVO: Gerar o contexto relevante dos FAQs
    const relevantFAQs = findRelevantFAQs(inputText, faqs);
    let relevantFAQsContext = '';
    if (relevantFAQs.length > 0) {
      relevantFAQsContext = `Contexto da nossa base de conhecimento:\n\n`;
      relevantFAQs.forEach((faq, index) => {
        relevantFAQsContext += `### FAQ ${index + 1}: ${faq.question}\n`;
        relevantFAQsContext += `Resposta: ${faq.answer}\n\n`; // A resposta inclui a sintaxe Markdown da imagem
      });
    }

    // Constrói o histórico do chat para enviar ao backend
    // Exclui a mensagem de boas-vindas inicial se for a primeira mensagem
    const chatHistoryForBackend = chatMessages
      .filter(msg => msg.id.startsWith('user-') || msg.id.startsWith('ai-')) // Filtra apenas user/ai messages
      .map(msg => ({ sender: msg.sender, text: msg.text })); // Cria um formato simples para o histórico

    // Cria a mensagem do usuário com texto e/ou pré-visualização da imagem
    const userMessage: ChatMessageType = {
      id: 'user-' + Date.now(),
      text: inputText,
      sender: 'user',
      timestamp: new Date(),
      imagePreviewUrl: imageFile ? URL.createObjectURL(imageFile) : undefined // Cria uma URL temporária para pré-visualização
    };
    setChatMessages((prevMessages) => [...prevMessages, userMessage]);
    setIsLoading(true);
    setError(null);
    setFaqProposalMessage(null);

    try {
      // MODIFICADO: Chama o geminiService, passando o texto, o arquivo de imagem, o histórico E o contexto dos FAQs
      const aiResponseText = await geminiService.sendMessageToChat(inputText, imageFile || null, chatHistoryForBackend, relevantFAQsContext);

      const proposalHandled = handleFAQProposal(aiResponseText);

      if (!proposalHandled) {
        const aiMessage: ChatMessageType = {
          id: 'ai-' + Date.now(),
          text: aiResponseText,
          sender: 'ai',
          timestamp: new Date(),
          imagePreviewUrl: undefined
        };
        setChatMessages((prevMessages) => [...prevMessages, aiMessage]);
      }
    } catch (err) {
      console.error("Erro ao enviar mensagem:", err);
      const errMessage = err instanceof Error ? err.message : "Ocorreu um erro desconhecido.";
      setError(`Erro ao comunicar com o assistente: ${errMessage}`);
    } finally {
      setIsLoading(false);
      // Revogar a URL temporária da pré-visualização para liberar memória
      if (userMessage.imagePreviewUrl) {
        URL.revokeObjectURL(userMessage.imagePreviewUrl);
      }
    }
  };


  // handleConfirmAddToFAQ (sem alterações)
  const handleConfirmAddToFAQ = async () => {
    if (suggestedFAQProposal) {
      try {
        let message = '';
        const result = await onFaqAction(suggestedFAQProposal.action, suggestedFAQProposal);

        if (suggestedFAQProposal.action === 'add') {
          message = "FAQ adicionado com sucesso!";
        } else if (suggestedFAQProposal.action === 'update') {
          message = "FAQ atualizado com sucesso!";
        } else if (suggestedFAQProposal.action === 'delete') {
          message = "FAQ excluído com sucesso!";
        } else if (suggestedFAQProposal.action === 'deleteCategory') {
          message = typeof result === 'string' ? result : "FAQs da categoria excluídos com sucesso!";
        } else if (suggestedFAQProposal.action === 'renameCategory') {
          message = typeof result === 'string' ? result : "Categoria renomeada com sucesso!";
        }
        setFaqProposalMessage(message);
      } catch (err) {
        console.error("Erro ao processar FAQ:", err);
        const errorMessage = err instanceof Error ? err.message : "Erro desconhecido.";
        setFaqProposalMessage(`Erro: ${errorMessage}`);
      } finally {
        setSuggestedFAQProposal(null);
      }
    }
  };

  // handleDeclineAddToFAQ (sem alterações)
  const handleDeclineAddToFAQ = () => {
    setFaqProposalMessage("Ok, não vamos adicionar este item ao FAQ por enquanto.");
    setSuggestedFAQProposal(null);
  };

  return (
    <div className="bg-white p-4 sm:p-6 rounded-lg shadow-xl flex flex-col flex-grow">
      <div className="flex items-center mb-4 pb-4 border-b border-slate-200">
        <SparklesIcon className="w-8 h-8 text-orange-600 mr-3" />
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">Assistente de IA</h2>
      </div>

      <div className="flex-grow overflow-y-auto mb-4 pr-2 space-y-4">
        {chatMessages.map((msg) => (
          <ChatMessageItem key={msg.id} message={msg} />
        ))}
        {isLoading && chatMessages.length > 0 && chatMessages[chatMessages.length - 1].sender === 'user' && (
          <div className="flex justify-start">
            <div className="bg-slate-200 p-3 rounded-lg max-w-xs lg:max-w-md animate-pulse">
              <LoadingSpinner size="sm" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {suggestedFAQProposal && (
        <div className="my-4 p-4 border border-blue-300 bg-blue-50 rounded-lg shadow-md">
          <div className="flex items-center text-orange-700 mb-3">
            <InformationCircleIcon className="w-6 h-6 mr-2" />
            <h3 className="text-lg font-semibold">
              Sugestão para {
                suggestedFAQProposal.action === 'add' ? 'Adicionar Novo FAQ' :
                  suggestedFAQProposal.action === 'update' ? 'Atualizar FAQ Existente' :
                    suggestedFAQProposal.action === 'delete' ? 'Excluir FAQ' :
                      suggestedFAQProposal.action === 'deleteCategory' ? 'Excluir FAQs por Categoria' :
                        'Renomear Categoria'
              }
            </h3>
          </div>
          <div className="text-sm text-slate-700 space-y-2 mb-4">
            <p><strong>Ação:</strong> {
              suggestedFAQProposal.action === 'add' ? 'Adicionar' :
                suggestedFAQProposal.action === 'update' ? 'Atualizar' :
                  suggestedFAQProposal.action === 'delete' ? 'Excluir' :
                    suggestedFAQProposal.action === 'deleteCategory' ? 'Excluir Categoria' :
                      'Renomear Categoria'
            }</p>
            {suggestedFAQProposal.id && <p><strong>ID do FAQ:</strong> {suggestedFAQProposal.id}</p>}
            {suggestedFAQProposal.categoryName && <p><strong>Categoria a Excluir:</strong> {suggestedFAQProposal.categoryName}</p>}
            {suggestedFAQProposal.oldCategoryName && <p><strong>Categoria Antiga:</strong> {suggestedFAQProposal.oldCategoryName}</p>}
            {suggestedFAQProposal.newCategoryName && <p><strong>Nova Categoria:</strong> {suggestedFAQProposal.newCategoryName}</p>}
            {suggestedFAQProposal.question && <p><strong>Pergunta:</strong> {suggestedFAQProposal.question}</p>}
            {suggestedFAQProposal.answer && <p><strong>Resposta:</strong> {suggestedFAQProposal.answer}</p>}
            {suggestedFAQProposal.category && suggestedFAQProposal.action !== 'deleteCategory' && suggestedFAQProposal.action !== 'renameCategory' && <p><strong>Categoria do FAQ:</strong> {suggestedFAQProposal.category}</p>}
            {suggestedFAQProposal.reason && <p><strong>Motivo:</strong> {suggestedFAQProposal.reason}</p>}
          </div>
          <p className="text-sm text-slate-600 mb-3">
            Gostaria de {
              suggestedFAQProposal.action === 'add' ? 'adicionar' :
                suggestedFAQProposal.action === 'update' ? 'atualizar' :
                  suggestedFAQProposal.action === 'delete' ? 'excluir' :
                    suggestedFAQProposal.action === 'deleteCategory' ? 'excluir' :
                      'renomear'
            } esta informação ao nosso FAQ para ajudar outros usuários?
          </p>
          <div className="flex justify-end space-x-3">
            <button
              onClick={handleDeclineAddToFAQ}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-md transition-colors flex items-center"
              aria-label="Não aceitar sugestão"
            >
              <XCircleIcon className="w-5 h-5 mr-1.5" />
              Não, obrigado
            </button>
            <button
              onClick={handleConfirmAddToFAQ}
              className="px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-md transition-colors flex items-center"
              aria-label="Sim, aceitar sugestão"
            >
              <CheckCircleIcon className="w-5 h-5 mr-1.5" />
              Sim, {
                suggestedFAQProposal.action === 'add' ? 'adicionar' :
                  suggestedFAQProposal.action === 'update' ? 'atualizar' :
                    suggestedFAQProposal.action === 'delete' ? 'excluir' :
                      suggestedFAQProposal.action === 'deleteCategory' ? 'excluir' :
                        'renomear'
              }
            </button>
          </div>
        </div>
      )}

      {faqProposalMessage && (
        <p className={`text-sm mb-2 text-center p-2 rounded-md ${faqProposalMessage.includes('Erro') ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
          {faqProposalMessage}
        </p>
      )}

      {error && <p className="text-red-500 text-sm mb-2 text-center p-2 bg-red-100 rounded-md">{error}</p>}

      {/* MODIFICADO: onSendMessage agora passa a imagem */}
      <ChatInput
        onSendMessage={handleSendMessage}
        isLoading={isLoading || !!suggestedFAQProposal}
      />
    </div>
  );
};

export default AIAssistantSection;