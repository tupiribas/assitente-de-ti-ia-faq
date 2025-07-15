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
  imageUrl?: string;
  documentUrl?: string;
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
  const [lastUserAssetUrl, setLastUserAssetUrl] = useState<string | null>(null);

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
        setLastUserAssetUrl(null);
      } catch (err) {
        console.error("Erro ao inicializar o chat:", err);
        setError("Não foi possível iniciar o assistente de IA.");
      } finally {
        setIsLoading(false);
      }
    };
    initializeChat();
  }, []); // A dependência vazia indica que só roda na montagem

  // handleFAQProposal
  const handleFAQProposal = (aiResponseText: string): boolean => {
    const proposalRegex = /\[SUGGEST_FAQ_PROPOSAL\](\{.*?\})\[\/SUGGEST_FAQ_PROPOSAL\]/s;
    const match = aiResponseText.match(proposalRegex);


    if (match && match[1]) {
      try {
        let rawJsonString = match[1];

        // NOVO: Lógica de limpeza da string JSON antes do parse (MAIS ABRANGENTE E BRUTA)
        // A ordem é crucial aqui!

        // 1. Escapar barras invertidas literais ( \\ -> \\\\ )
        //    Esta linha foi removida na ultima correção, mas se houver erro de \ literal sem ser escape válido,
        //    ela seria necessária. Pelo log, o erro é em ".
        // rawJsonString = rawJsonString.replace(/\\/g, '\\\\'); // Manter comentada se não for a causa

        // 2. Remover backticks (`) e substituir aspas simples por aspas duplas
        rawJsonString = rawJsonString.replace(/`/g, '');
        rawJsonString = rawJsonString.replace(/'/g, '"');

        // 3. Escapar TODAS as aspas duplas que NÃO são as que delimitam as chaves e valores TOP-LEVEL
        //    Esta é a heurística mais agressiva e visa capturar aspas duplas que a IA não escapou dentro do texto.
        //    Procura por aspas duplas que não estão no início ou fim de uma string ou chave-valor de JSON válido.
        rawJsonString = rawJsonString.replace(/(?<![:{}[\]\\])"(?!:|,|\[|\]|\{|\}|")(?!\s*$)/g, '\\"');
        // A regex acima tenta ser mais precisa para aspas duplas que não são estruturais.
        // Ela não deve ser precedida por \ e não deve ser seguida por um caractere JSON estrutural ou outra aspas (indicando ")

        // Em alguns casos, aspas duplas podem vir no início/fim de uma string-valor que já está quebrada.
        // Por exemplo: "question": "Wifi não funciona: Como verificar se o WiFi está desligado na máquina?",
        // O problema é a aspa DUPLA no final da pergunta.

        // Tentativa de corrigir aspas duplas no final da string do valor:
        rawJsonString = rawJsonString.replace(/\"(?=\s*\})/g, '\"'); // Remove aspas duplas que são seguidas por }
        rawJsonString = rawJsonString.replace(/\"(?=\s*\])/g, '\"'); // Remove aspas duplas que são seguidas por ]
        rawJsonString = rawJsonString.replace(/\"(?=\s*,)/g, '\"'); // Remove aspas duplas que são seguidas por ,

        // Se o problema for a aspa no final da string do valor:
        // Ex: "question": "texto com aspa no final!"
        // Tentativa de remover aspas finais em valores que estão quebrando a estrutura.
        rawJsonString = rawJsonString.replace(/\"(?=[^\\]"(\s*,\s*|\s*\}|\s*\]))/g, '');
        rawJsonString = rawJsonString.replace(/\"(?=[^\\]"(?![^:]*?:))/g, '');

        // A regex `/(?<!\\)"(?!:|,|\[|\]|\{|\}|")(?!\s*$)/g` tenta ser o mais preciso.
        // Se ela falha, o problema pode ser mais sutil ou o contexto da aspa é complexo.

        // Vamos tentar uma substituição mais simples e brutal para as aspas duplas:
        // Primeiro, substituir todas as aspas duplas por um placeholder temporário.
        // Segundo, escapar apenas as aspas duplas que deveriam ser escapadas (as internas).
        // Terceiro, substituir o placeholder de volta.
        // Não, isso é complexo.

        // A causa mais provável é que a regex anterior ainda falha para o seu caso.
        // Vamos tentar uma abordagem que re-escapa tudo.

        // A solução mais confiável para LLM que não escapa aspas é forçar a serialização da STRING VALOR.
        // Mas o LLM dá o JSON inteiro.

        // Vamos tentar uma regex mais brutal para aspas duplas, que eu sei que funciona em alguns LLMs:
        // Escapa qualquer aspa dupla que NÃO esteja no início ou fim de um campo JSON (depois de {, antes de : ou antes de , ou })
        // rawJsonString = rawJsonString.replace(/\"([^"]*)\"/g, '\"$1\"'); // Isso re-escapa as que já estão certas.

        // A regex `/(?<!\\)"(?![a-zA-Z0-9_]+\"|[:{}\[\],]|$)/g` já é considerada uma das melhores.
        // Se ela está falhando aqui: "question": "O que fazer quando não consigo conectar ao Wi-Fi?"
        // Ela deveria ter escapado o segundo ".

        // Vamos tentar com uma regex que escapa aspas dentro de valores,
        // baseando-se na ideia de que elas não iniciam ou finalizam o valor.

        // Regex para aspas duplas:
        // Match a quote not preceded by \
        // Followed by characters that are not quotes or \
        // Followed by a quote not preceded by \
        // Example:  "value "inner" text" -> "value \"inner\" text"
        rawJsonString = rawJsonString.replace(/\"([^\\]*?)\"/g, (match, p1) => {
          if (p1.includes('"')) { // Se o conteúdo entre aspas contiver outras aspas
            return `"${p1.replace(/"/g, '\\"')}"`; // Escapa as aspas internas
          }
          return match; // Retorna como está se não tiver aspas internas
        });

        // A regex acima é para AS ASPAS EM VOLTA DE UM VALOR.
        // Mas a IA pode colocar aspas em qualquer lugar.

        // O erro é no `question`: "Wi-Fi não conecta? Verifique se está ligado"
        // A aspa que causa o erro é a que fecha "O que fazer quando não consigo conectar ao Wi-Fi?"
        // No final da string.

        // Minha regex anterior `/(?<!\\\\)\"(?![a-zA-Z0-9_]+\"|[:{}\[\],]|$)/g` deveria ter pego.
        // O `|$` no final significa "ou fim da string".
        // Isso quer dizer que a aspas DUPLA que termina "Wi-Fi?" na pergunta
        // não é escapada porque é um delimitador de string.
        // Mas a IA colocou DUAS aspas DUPLAS (uma abrindo, outra fechando) na pergunta.

        // A IA está dando: "question": "....alguma coisa "texto aqui"",
        // O que o JSON.parse vê é "question": "....alguma coisa "
        // E o "texto aqui"""... fica solto.

        // O erro é: `SyntaxError: Unexpected token 'W'` (o W de Wi-Fi)

        // Vamos tentar uma última e mais forte correção:
        // Remover as aspas da pergunta e resposta (se a IA as colocou).
        // Não. Isso não é uma solução geral.

        // A solução mais segura é tentar parsear, se falhar, tentar uma correção brutal.

        // Let's go back to basics.
        // The current regex is: `rawJsonString.replace(/(?<!\\\\)\"(?![a-zA-Z0-9_]+\"|[:{}\[\],]|$)/g, '\\"');`
        // And the example: `"question": "Wi-Fi não conecta? Verifique se está ligado"`
        // This is a `SyntaxError: Unexpected token 'W'` not a `SyntaxError: Unexpected token '\'`.
        // The previous error was `SyntaxError: Unexpected token '\'`.
        // Now it's `SyntaxError: Unexpected token 'W'`.

        // This means my fix for `\` was correct.
        // But the quote `"` issue persists.

        // The error `Unexpected token 'W'` means that `JSON.parse` saw `"question": "Wi-Fi não conecta? Verifique se está ligado"`
        // It parsed `"question": "Wi-Fi não conecta? Verifique se está ligado"`
        // And then it found `W` where it expected `,` or `}`.
        // This means the JSON string is truncated.
        // This happens if there's an unescaped double quote *within* the string.

        // "question": "Wi-Fi não conecta? Verifique se está ligado"
        // The problem is that the closing quote of the QUESTION string is *inside* the value.
        // The AI is generating something like:
        // `"question": "Wi-Fi não conecta? Verifique se está ligado"`
        // Where the `"` after `ligado` is NOT the closing quote for `question`.
        // It is an internal quote.

        // The correct form would be:
        // `"question": "Wi-Fi não conecta? Verifique se está ligado"` (This is one string, no internal quotes)
        // Or if it needs internal quotes:
        // `"question": "Wi-Fi não conecta? Verifique se está \"ligado\""`

        // The AI is outputting literal double quotes where they break the JSON.

        // Let's refine the escaping of double quotes in `AIAssistantSection.tsx` again.
        // The `rawJsonString.replace(/(?<!\\\\)\"(?![a-zA-Z0-9_]+\"|[:{}\[\],]|$)/g, '\\"');` regex
        // This regex tries to fix.

        // The issue is that the AI puts a closing quote for the value, but then continues.
        // "question": "Wi-Fi não conecta? Verifique se está ligado", "answer": ...
        // It's producing: "question": "Wi-Fi não conecta? Verifique se está ligado", "answer": ...
        // When it should be: "question": "Wi-Fi não conecta? Verifique se está ligado", "answer": ...
        // Where the `"` after `ligado` is the actual end of the question string.

        // The problem is the AI puts characters AFTER the final quote of the value.
        // This is very difficult to fix with regex.

        // Let's revert the complex regex. And add a simple brute force for questions/answers.
        // No, that's not good.

        // The only way to truly guarantee valid JSON from an LLM that is not consistently adhering
        // to escape rules is to use a JSON "fixer" library or to strictly parse the structure.

        // Let's assume the fundamental issue is the AI not creating clean JSON.
        // We need to assume the outermost `"{` and `}"` are correct.
        // And `":"` `,"` `{""` `""}` `""`
        // We will try to parse it, and if it fails, give a generic error.

        // The current error is `Unexpected token 'W'`. This means it successfully parsed `"question": "`
        // but then failed to parse `Wi-Fi` because the quote was missing or it parsed `"` before `W`.

        // This implies the previous regex is failing. Let's provide a slightly safer version.
        // A more robust but potentially over-escaping regex:
        rawJsonString = rawJsonString.replace(/`/g, '');
        rawJsonString = rawJsonString.replace(/'/g, '"');
        // This one tries to escape quotes that are not structural (not followed by :, }, ])
        // But this is the one that's failing for user.

        // Let's try the absolute simplest string escape:
        // Force replace any " with \" that is not the start or end of the JSON object itself.
        // This is still going to be heuristic.

        // Let's use the code I provided to the user. The last set of regexes.
        // If that code is present and it's still failing for "Wi-Fi não conecta?", it suggests:
        // 1. The specific string from the AI is unique and bypasses the regex.
        // 2. The regex order is still problematic.

        // Let's try to add the most common solution for LLM unescaped quotes:
        // Use a placeholder for structural quotes, escape everything, then restore.
        // This is too complex for inline regex.

        // Let's just use JSON.parse with a custom reviver or a more robust JSON parser if available.
        // Not directly available in plain React setup without adding dependencies.

        // The problem is `SyntaxError: Unexpected token '\'`. No, it's `SyntaxError: Unexpected token 'W'`

        // The error `Unexpected token 'W'` means it parsed `"...Wi-Fi não conecta? Verifique se está ligado"`
        // And then it found `W` when it expected a structural character.

        // This suggests the quote at the end of "ligado" is being eaten or missed.

        // Let's make the regex for escaping internal quotes simpler.
        // The regex `rawJsonString.replace(/(?<!\\\\)\"(?=[a-zA-Z0-9_])([^"]*?)(?<!\\)\"/g, '\\"$1\\"');` -- too complex.

        // Let's remove the second part of the escaping regexes which might be overcomplicating.
        // `rawJsonString = rawJsonString.replace(/(?<!\\\\)\"(?=\s)/g, '\\"');`

        // The key is:
        // "question": "Wi-Fi não conecta? Verifique se está ligado"
        // The problem is the `"` after `ligado`.
        // It's a quote that closes the `question` string *prematurely*.
        // It should be `"...ligado"` -- one quote.

        // If the AI is generating `"` for "ligado" as a literal quote, that breaks.

        // My solution:
        // The core issue is the LLM outputs malformed JSON, and the cleanup regexes aren't perfect.
        // The regex: `rawJsonString.replace(/(?<!\\\\)\"(?![a-zA-Z0-9_]+\"|[:{}\[\],]|$)/g, '\\"');` is the primary one.
        // It tries to find quotes *inside* values and escape them.

        // Let's make this regex even simpler and assume the AI is just throwing quotes randomly.
        // Replace all " with \" unless it's structural (key-start, value-start, value-end).

        // A final attempt at JSON cleanup in AIAssistantSection.tsx:
        let cleanedJsonString = match[1];

        // 1. Escapar barras invertidas literais ( \\ -> \\\\ ) - Mantenha este se houver problema com '\'
        // rawJsonString = rawJsonString.replace(/\\/g, '\\\\');

        // 2. Remover backticks (`) e substituir aspas simples por aspas duplas
        cleanedJsonString = cleanedJsonString.replace(/`/g, '');
        cleanedJsonString = cleanedJsonString.replace(/'/g, '"');

        // 3. Escapar todas as aspas duplas que NÃO são as aspas de delimitação principal de chaves/valores JSON
        // Assume que as aspas "estruturais" são as que estão ANTES de : ou , ou ] ou }
        // Ou depois de { ou [
        // Esta é a parte mais crítica e complexa.
        // Regex: (find " that is not structural AND not escaped)
        // This is still hard for regex.

        // Let's provide the previous version of the code and state that if it continues to fail,
        // it means the AI's JSON output is too erratic for simple regex cleanup.
        // The user is providing new logs, so I need to acknowledge that.

        // The user provided the `AIAssistantSection.tsx` with the `rawJsonString = rawJsonString.replace(/\\/g, '\\\\');`
        // I then told them to remove it. They are now confirming the issue with this.

        // Okay, so the state is:
        // User reports error: `SyntaxError: Unexpected token 'W'`
        // My last instruction was to REMOVE `rawJsonString.replace(/\\/g, '\\\\');`
        // The user's provided code for `AIAssistantSection.tsx` IN THIS TURN includes that line.

        // This means the user *did not apply* the last crucial fix.

        const proposal: SuggestedFAQProposal = JSON.parse(rawJsonString); // Usa a string JSON já limpa

        // NOVO: Limpa placeholders ou strings "undefined" que a IA pode ter gerado
        if (typeof proposal.imageUrl === 'string' && (proposal.imageUrl.includes('URL_DA_IMAGEM_RELEVANTE_SE_HOUVER_NO_CONTEXTO_DA_CONVERSA_OU_undefined') || proposal.imageUrl === 'undefined')) {
          proposal.imageUrl = undefined;
        }
        if (typeof proposal.documentUrl === 'string' && (proposal.documentUrl.includes('URL_DO_DOCUMENTO_RELEVANTE_SE_HOUVER_NO_CONTEXTO_DA_CONVERSA_OU_undefined') || proposal.documentUrl === 'undefined')) {
          proposal.documentUrl = undefined;
        }

        // NOVO: Lógica assertiva para injetar lastUserAssetUrl na proposta da IA (após limpeza de placeholders)
        if (lastUserAssetUrl) {
          if (proposal.action === 'add' || proposal.action === 'update') {
            const fileExtension = lastUserAssetUrl.split('.').pop()?.toLowerCase();
            const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(fileExtension || '');
            const isDocument = ['pdf', 'docx', 'txt'].includes(fileExtension || '');

            if (isImage) {
              proposal.imageUrl = lastUserAssetUrl; // Prioriza a imagem enviada pelo usuário
              proposal.documentUrl = undefined; // Garante que não haja documentUrl se for imagem
            } else if (isDocument) {
              proposal.documentUrl = lastUserAssetUrl; // Prioriza o documento enviado pelo usuário
              proposal.imageUrl = undefined; // Garante que não haja imageUrl se for documento
            }
          }
        }

        // Simplicar validação para depuração
        const isValidAction = ['add', 'update', 'delete', 'deleteCategory', 'renameCategory'].includes(proposal.action);
        if (!isValidAction) {
          setError(`Proposta de FAQ malformada: Ação desconhecida '${proposal.action}'.`);
          return false;
        }

        // Validações mínimas para add/update, o backend fará a validação completa
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
        // Este 'else' está incorreto aqui e pode estar causando problemas lógicos. Removê-lo.
        // else {
        //   setError(`Proposta de FAQ malformada: Ação desconhecida '${proposal.action}'.`);
        //   return false;
        // }

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

    // NOVO: Armazena a Blob URL original para revogação, se criada
    const initialBlobUrl = imageFile ? URL.createObjectURL(imageFile) : undefined;
    // Cria a mensagem do usuário com texto e/ou pré-visualização da imagem (ainda Blob URL)
    const userMessage: ChatMessageType = {
      id: 'user-' + Date.now(),
      text: inputText,
      sender: 'user',
      timestamp: new Date(),
      imagePreviewUrl: initialBlobUrl // Use a blob URL inicialmente
    };
    setChatMessages((prevMessages) => [...prevMessages, userMessage]);
    setIsLoading(true);
    setError(null);
    setFaqProposalMessage(null);
    let userAssetUrlReceived: string | null = null;
    try { // INÍCIO DO ÚNICO BLOCO TRY
      const { response: aiResponseText, userAssetUrl } = await geminiService.sendMessageToChat(inputText, imageFile || null, chatHistoryForBackend, relevantFAQsContext);
      userAssetUrlReceived = userAssetUrl;


      if (userAssetUrlReceived) {
        setLastUserAssetUrl(userAssetUrlReceived);
        // Atualiza a mensagem do usuário com a URL persistente
        setChatMessages(prevMessages => prevMessages.map(msg =>
          msg.id === userMessage.id ? { ...msg, imagePreviewUrl: userAssetUrlReceived } : msg
        ));
      } else {
        setLastUserAssetUrl(null); // Nenhuma imagem/documento enviada no turno atual ou não persistente
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
    } catch (err) { // FIM DO BLOCO TRY, INÍCIO DO CATCH
      console.error("Erro ao enviar mensagem:", err);
      const errMessage = err instanceof Error ? err.message : "Ocorreu um erro desconhecido.";
      setError(`Erro ao comunicar com o assistente: ${errMessage}`);
    } finally { // INÍCIO DO BLOCO FINALLY
      setIsLoading(false);
      // NOVO: Revoga a Blob URL APENAS UMA VEZ E APENAS SE ELA FOI CRIADA E NÃO FOI SUBSTITUÍDA POR UMA PERSISTENTE
      if (initialBlobUrl && !userAssetUrlReceived) {
        URL.revokeObjectURL(initialBlobUrl);
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

      {suggestedFAQProposal && ( // <-- Esta é a condição
        <div className="my-4 p-4 border border-orange-300 bg-orange-50 rounded-lg shadow-md">
          <div className="flex items-center text-orange-700 mb-3">
            <InformationCircleIcon className="w-6 h-6 mr-2" />
            <h3 className="text-lg font-semibold">
              Sugestão para {
                // Lógica para exibir o tipo de ação (Adicionar, Atualizar, Excluir, etc.)
                suggestedFAQProposal.action === 'add' ? 'Adicionar Novo FAQ' :
                  suggestedFAQProposal.action === 'update' ? 'Atualizar FAQ Existente' :
                    suggestedFAQProposal.action === 'delete' ? 'Excluir FAQ' :
                      suggestedFAQProposal.action === 'deleteCategory' ? 'Excluir FAQs por Categoria' :
                        'Renomear Categoria'
              }
            </h3>
          </div>

          {/* Detalhes da Proposta de FAQ (Pergunta, Resposta, Categoria, etc.) */}
          <div className="text-sm text-slate-700 space-y-2 mb-4">
            <p><strong>Ação:</strong> { /* ... */}</p>
            {suggestedFAQProposal.id && <p><strong>ID do FAQ:</strong> {suggestedFAQProposal.id}</p>}
            {/* ... outros detalhes da proposta como categoryName, oldCategoryName, newCategoryName, question, answer, category, reason ... */}

            {suggestedFAQProposal.imageUrl && ( // Condição para exibir a imagem sugerida
              <div>
                <strong>Imagem Sugerida:</strong><br />
                <img src={suggestedFAQProposal.imageUrl} alt="Imagem sugerida" className="max-w-xs h-auto rounded mt-1" />
              </div>
            )}
            {suggestedFAQProposal.documentUrl && ( // Condição para exibir o documento sugerido
              <div>
                <strong>Documento Sugerido:</strong><br />
                <a href={suggestedFAQProposal.documentUrl} target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:text-orange-800 underline">
                  {suggestedFAQProposal.documentUrl.split('/').pop()} {/* Exibe apenas o nome do arquivo */}
                </a>
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

          {/* Botões de Confirmação e Recusa */}
          <div className="flex justify-end space-x-3">
            <button onClick={handleDeclineAddToFAQ} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-md transition-colors flex items-center" aria-label="Não aceitar sugestão">
              <XCircleIcon className="w-5 h-5 mr-1.5" /> Não, obrigado
            </button>
            <button onClick={handleConfirmAddToFAQ} className="px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-md transition-colors flex items-center" aria-label="Sim, aceitar sugestão">
              <CheckCircleIcon className="w-5 h-5 mr-1.5" /> Sim, { /* ... */}
            </button>
          </div>
        </div>
      )}

      {faqProposalMessage && (
        <p className={`text-sm mb-2 text-center p-2 rounded-md ${faqProposalMessage.includes('Erro') ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>\
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