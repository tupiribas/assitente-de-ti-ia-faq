import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage as ChatMessageType, FAQ as FAQType, FAQAttachment } from '../types'; // VVVV Garanta que FAQAttachment está importado aqui VVVV
import ChatMessageItem from './ChatMessageItem';
import ChatInput from './ChatInput';
import LoadingSpinner from './LoadingSpinner';
import { geminiService } from '../services/geminiService';
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
  imageUrl?: string;
  documentUrl?: string;
  documentText?: string;
  // VVVV CORREÇÃO AQUI: Adicione a propriedade 'attachments' VVVV
  attachments?: FAQAttachment[]; // Anexos da proposta (documentos), torná-lo opcional com '?'
  // ^^^^ FIM DA CORREÇÃO ^^^^
}


interface AIAssistantSectionProps {
  onFaqAction: (
    action: SuggestedFAQProposal['action'],
    proposal: SuggestedFAQProposal
  ) => Promise<string | void>;
  faqs: FAQType[];
}

const findRelevantFAQs = (query: string, faqsList: FAQType[], topN: number = 2): FAQType[] => {
  if (!query || faqsList.length === 0) return [];

  const queryLower = query.toLowerCase().split(/\s+/).filter(Boolean);

  const scoredFAQs = faqsList.map(faq => {
    let score = 0;
    const questionLower = faq.question.toLowerCase();
    const answerLower = faq.answer.toLowerCase();
    const categoryLower = faq.category.toLowerCase();

    const imageUrlRegex = /!\[(.*?)\]\((.*?)\)/g;
    let imageMatch;
    let imageAltTexts = [];
    while ((imageMatch = imageUrlRegex.exec(faq.answer)) !== null) {
      if (imageMatch[1]) {
        imageAltTexts.push(imageMatch[1].toLowerCase());
      }
    }

    // NOVO: Extração de conteúdo de documento, já existe e é usado para pontuação
    const documentTextContent = faq.documentText ? faq.documentText.toLowerCase() : '';

    queryLower.forEach(word => {
      if (questionLower.includes(word)) score += 2;
      if (answerLower.includes(word)) score += 1;
      if (categoryLower.includes(word)) score += 0.5;
      if (imageAltTexts.some(altText => altText.includes(word))) score += 1.5;
      if (documentTextContent.includes(word)) score += 3;
    });
    return { faq, score };
  });

  return scoredFAQs
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.faq)
    .slice(0, topN);
};

const AIAssistantSection: React.FC<AIAssistantSectionProps> = ({ onFaqAction, faqs }) => {
  const [chatMessages, setChatMessages] = useState<ChatMessageType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [suggestedFAQProposal, setSuggestedFAQProposal] = useState<SuggestedFAQProposal | null>(null);
  const [faqProposalMessage, setFaqProposalMessage] = useState<string | null>(null);
  const [lastUserAssetUrl, setLastUserAssetUrl] = useState<string | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [chatMessages, suggestedFAQProposal, faqProposalMessage]);

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
        setLastUserAssetUrl(null);
      } catch (err) {
        console.error("Erro ao inicializar o chat:", err);
        setError("Não foi possível iniciar o assistente de IA.");
      } finally {
        setIsLoading(false);
      }
    };
    initializeChat();
  }, []);

  const handleFAQProposal = (aiResponseText: string): boolean => {
    const proposalRegex = /\[SUGGEST_FAQ_PROPOSAL\](\{.*?\})\[\/SUGGEST_FAQ_PROPOSAL\]/s;
    const customActionRegex = /\[CUSTOM_ACTION_REQUEST\](\{.*?\})\[\/CUSTOM_ACTION_REQUEST\]/s;

    const match = aiResponseText.match(proposalRegex);
    const customActionMatch = aiResponseText.match(customActionRegex);

    if (match && match[1]) {
      try {
        let rawJsonString = match[1];

        rawJsonString = rawJsonString.replace(/`/g, '');
        rawJsonString = rawJsonString.replace(/'/g, '"');
        rawJsonString = rawJsonString.replace(/"imageUrl":\s*undefined/g, '"imageUrl": null');
        rawJsonString = rawJsonString.replace(/"documentUrl":\s*undefined/g, '"documentUrl": null');
        rawJsonString = rawJsonString.replace(/"documentText":\s*undefined/g, '"documentText": null'); // <--- NOVO: Garanta que documentText também seja null

        const proposal: SuggestedFAQProposal = JSON.parse(rawJsonString);

        if (typeof proposal.imageUrl === 'string' && (proposal.imageUrl.includes('URL_DA_IMAGEM_RELEVANTE_SE_HOUVER_NO_CONTEXTO_DA_CONVERSA_OU_undefined') || proposal.imageUrl === 'undefined')) {
          proposal.imageUrl = undefined;
        }
        if (typeof proposal.documentUrl === 'string' && (proposal.documentUrl.includes('URL_DO_DOCUMENTO_RELEVANTE_SE_HOUVER_NO_CONTEXTO_DA_CONVERSA_OU_undefined') || proposal.documentUrl === 'undefined')) {
          proposal.documentUrl = undefined;
        }
        if (typeof proposal.documentText === 'string' && (proposal.documentText.includes('CONTEÚDO_DO_DOCUMENTO_RELEVANTE_SE_HOUVER_NO_CONTEXTO_DA_CONVERSA_OU_undefined') || proposal.documentText === 'undefined')) {
          proposal.documentText = undefined; // <--- NOVO: Limpeza para documentText
        }

        if (lastUserAssetUrl) {
          if (proposal.action === 'add' || proposal.action === 'update') {
            const fileExtension = lastUserAssetUrl.split('.').pop()?.toLowerCase();
            const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(fileExtension || '');
            const isDocument = ['pdf', 'docx', 'txt'].includes(fileExtension || '');

            if (isImage) {
              proposal.imageUrl = lastUserAssetUrl;
              proposal.documentUrl = undefined;
              proposal.documentText = undefined; // Imagens não tem documentText
            } else if (isDocument) {
              proposal.documentUrl = lastUserAssetUrl;
              // Se a IA está sugerindo um FAQ e houve um anexo,
              // o extractedText para preencher documentText viria do seu próprio conhecimento ou seria inferido.
              // A URL do anexo já está sendo enviada para a IA, ela deveria usar isso.
              // Para garantir, você pode adicionar uma lógica aqui para pegar uploadedAssetText
              // se a proposta veio logo após um upload de documento pelo usuário no chat.
              // Por simplicidade, vamos deixar a IA inferir ou confiar que ela preenche.
              proposal.imageUrl = undefined;
            }
          }
        }

        const isValidAction = ['add', 'update', 'delete', 'deleteCategory', 'renameCategory'].includes(proposal.action);
        if (!isValidAction) {
          setError(`Proposta de FAQ malformada: Ação desconhecida '${proposal.action}'.`);
          return false;
        }

        if ((proposal.action === 'add' || proposal.action === 'update') && (!proposal.question || !proposal.answer || !proposal.category)) {
          setError(`Proposta de FAQ malformada para '${proposal.action}': Pergunta, Resposta e Categoria são obrigatórios.`);
          return false;
        }
        if (proposal.action === 'update' && !proposal.id) {
          setError("Proposta de FAQ malformada: Ação 'update' sem ID.");
          return false;
        }
        if (proposal.action === 'delete' && !proposal.id) {
          setError("Proposta de FAQ malformada: Ação 'delete' sem ID.");
          return false;
        }
        if (proposal.action === 'deleteCategory' && !proposal.categoryName) {
          setError("Proposta de FAQ malformada: Ação 'deleteCategory' sem nome da categoria.");
          return false;
        }
        if (proposal.action === 'renameCategory' && (!proposal.oldCategoryName || !proposal.newCategoryName)) {
          setError("Proposta de FAQ malformada: Ação 'renameCategory' sem nome da categoria antiga ou nova.");
          return false;
        }

        setSuggestedFAQProposal(proposal);
        return true;

      } catch (e) {
        console.error("Erro ao parsear JSON da proposta de FAQ:", e);
        setError("A IA tentou sugerir um FAQ, mas houve um erro no formato da sugestão. O JSON gerado pela IA pode estar malformado. Por favor, ajuste o prompt da IA.");
      }
    }
    else if (customActionMatch && customActionMatch[1]) {
      try {
        const actionProposal: { action: string } = JSON.parse(customActionMatch[1]);
        if (actionProposal.action === 'view_faq_log') {
          fetch('/api/logs/faq-activity')
            .then(res => {
              if (!res.ok) {
                throw new Error(`Erro ao carregar log: ${res.statusText}`);
              }
              return res.text();
            })
            .then(logText => {
              const logMessage: ChatMessageType = {
                id: 'ai-log-' + Date.now(),
                text: `**Log de Atividades do FAQ:**\n\n\`\`\`\n${logText}\n\`\`\``,
                sender: 'ai',
                timestamp: new Date(),
                imagePreviewUrl: undefined
              };
              setChatMessages((prevMessages) => [...prevMessages, logMessage]);
              setError(null);
            })
            .catch(err => {
              console.error("Erro ao carregar log de FAQ:", err);
              setError(`Não foi possível carregar o log de atividades: ${err.message}`);
            });
          return true;
        }
      } catch (e) {
        console.error("Erro ao parsear JSON da ação customizada:", e);
        setError("A IA tentou disparar uma ação, mas o formato estava inválido.");
      }
    }
    return false;
  };

  const handleSendMessage = async (inputText: string, imageFile?: File | null) => {
    if ((!inputText.trim() && !imageFile) || suggestedFAQProposal) return;

    const relevantFAQs = findRelevantFAQs(inputText, faqs);
    let relevantFAQsContext = '';
    if (relevantFAQs.length > 0) {
      relevantFAQsContext = `Contexto da nossa base de conhecimento:\n\n`;
      relevantFAQs.forEach((faq, index) => {
        relevantFAQsContext += `### FAQ ${index + 1}: ${faq.question}\n`;
        relevantFAQsContext += `Resposta: ${faq.answer}\n`; // Já inclui o HTML/Markdown
        if (faq.documentText) { // <--- NOVO: Adiciona o texto do documento para a IA
          relevantFAQsContext += `Conteúdo do Documento da FAQ ${faq.question}: ${faq.documentText}\n`;
        }
        relevantFAQsContext += `\n`;
      });
    }

    const chatHistoryForBackend = chatMessages
      .filter(msg => msg.id.startsWith('user-') || msg.id.startsWith('ai-'))
      .map(msg => ({ sender: msg.sender, text: msg.text }));

    const initialBlobUrl = imageFile ? URL.createObjectURL(imageFile) : undefined;
    const userMessage: ChatMessageType = {
      id: 'user-' + Date.now(),
      text: inputText,
      sender: 'user',
      timestamp: new Date(),
      imagePreviewUrl: initialBlobUrl
    };
    setChatMessages((prevMessages) => [...prevMessages, userMessage]);
    setIsLoading(true);
    setError(null);
    setFaqProposalMessage(null);
    let userAssetUrlReceived: string | null = null;
    try {
      const { response: aiResponseText, userAssetUrl } = await geminiService.sendMessageToChat(inputText, imageFile || null, chatHistoryForBackend, relevantFAQsContext);
      userAssetUrlReceived = userAssetUrl;


      if (userAssetUrlReceived) {
        setLastUserAssetUrl(userAssetUrlReceived);
        setChatMessages(prevMessages => prevMessages.map(msg =>
          msg.id === userMessage.id ? { ...msg, imagePreviewUrl: userAssetUrlReceived } : msg
        ));
      } else {
        setLastUserAssetUrl(null);
      }

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
      setError(`Erro ao comunicar com o assistente: ${errMessage}. Se o problema persistir, verifique o console do servidor para mais detalhes. O JSON gerado pela IA pode estar malformado.`);
    } finally {
      setIsLoading(false);
      if (initialBlobUrl && !userAssetUrlReceived) {
        URL.revokeObjectURL(initialBlobUrl);
      }
    }
  };

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
        <div className="my-4 p-4 border border-orange-300 bg-orange-50 rounded-lg shadow-md">
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
            <p><strong>Ação:</strong> {suggestedFAQProposal.action}</p>
            {suggestedFAQProposal.id && <p><strong>ID do FAQ:</strong> {suggestedFAQProposal.id}</p>}
            {suggestedFAQProposal.question && <p><strong>Pergunta:</strong> {suggestedFAQProposal.question}</p>}
            {suggestedFAQProposal.answer && <p><strong>Resposta:</strong> {suggestedFAQProposal.answer}</p>}
            {suggestedFAQProposal.category && <p><strong>Categoria:</strong> {suggestedFAQProposal.category}</p>}
            {suggestedFAQProposal.reason && <p><strong>Motivo:</strong> {suggestedFAQProposal.reason}</p>}
            {suggestedFAQProposal.categoryName && <p><strong>Nome da Categoria:</strong> {suggestedFAQProposal.categoryName}</p>}
            {suggestedFAQProposal.oldCategoryName && <p><strong>Categoria Antiga:</strong> {suggestedFAQProposal.oldCategoryName}</p>}
            {suggestedFAQProposal.newCategoryName && <p><strong>Nova Categoria:</strong> {suggestedFAQProposal.newCategoryName}</p>}

            {suggestedFAQProposal.imageUrl && (
              <div>
                <strong>Imagem Sugerida:</strong><br />
                <img src={suggestedFAQProposal.imageUrl} alt="Imagem sugerida" className="max-w-xs h-auto rounded mt-1" />
              </div>
            )}
            {suggestedFAQProposal.documentUrl && (
              <div>
                <strong>Documento Sugerido:</strong><br />
                <a href={suggestedFAQProposal.documentUrl} target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:text-orange-800 underline">
                  {suggestedFAQProposal.documentUrl.split('/').pop()}
                </a>
              </div>
            )}
            {/* NOVO: Exibe o documentText se presente na sugestão */}
            {suggestedFAQProposal.documentText && (
              <div>
                <strong>Conteúdo do Documento (para IA):</strong><br />
                <pre className="whitespace-pre-wrap text-xs text-slate-500 bg-slate-100 p-2 rounded-md max-h-24 overflow-y-auto">{suggestedFAQProposal.documentText}</pre>
              </div>
            )}
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
            <button onClick={handleDeclineAddToFAQ} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-md transition-colors flex items-center" aria-label="Não aceitar sugestão">
              <XCircleIcon className="w-5 h-5 mr-1.5" /> Não, obrigado
            </button>
            <button onClick={handleConfirmAddToFAQ} className="px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-md transition-colors flex items-center" aria-label="Sim, aceitar sugestão">
              <CheckCircleIcon className="w-5 h-5 mr-1.5" /> Sim, {
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

      <ChatInput
        onSendMessage={handleSendMessage}
        isLoading={isLoading || !!suggestedFAQProposal}
      />
    </div>
  );
};

export default AIAssistantSection;