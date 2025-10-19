import React from 'react';
import { FAQ, FAQAttachment } from '../types';
// Certifique-se de que DocumentIcon (ou similar) está exportado de Icons.tsx
import { ChevronDownIcon, ChevronUpIcon, PencilIcon, TrashIcon, DocumentIcon } from './Icons';
import DOMPurify from 'dompurify';
import ReactMarkdown from 'react-markdown';
import { LinkRenderer } from './utils/markdownRenderers';
import remarkGfm from 'remark-gfm'; // Para tabelas, strikethrough, etc. em Markdown

interface FAQItemProps {
  faq: FAQ;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: (faq: FAQ) => void; // A verificação é feita no componente pai (FAQSection)
  onDelete: (id: string) => void; // A verificação é feita no componente pai (FAQSection)
  canManage: boolean; // Recebe a permissão
}

// Ícones SVG para PDF e Documento Genérico (para exibição nos anexos)
const PDF_ICON_SVG_ITEM = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="inline-block w-5 h-5 align-middle mr-1.5 text-red-600">
  <path fill-rule="evenodd" d="M19.5 7.5V4.5H4.5A.75.75 0 0 0 3.75 5.25v14.5A.75.75 0 0 0 4.5 20.5h15a.75.75 0 0 0 .75-.75V8.25A.75.75 0 0 0 19.5 7.5ZM13.297 9.75a.75.75 0 0 0-.987-1.125l-3 2.25a.75.75 0 0 0-.174.457v3.393a.75.75 0 0 0 .75.75h2.25a.75.75 0 0 0 .75-.75v-2.25h1.5a.75.75 0 0 0 0-1.5h-1.5Z" clip-rule="evenodd" />
</svg>`;

const DOCUMENT_ICON_SVG_ITEM = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="inline-block w-5 h-5 align-middle mr-1.5 text-slate-600">
  <path fillRule="evenodd" d="M11.54 22.351l.07.035c.104.052.215.087.33.103.015.004.03.007.045.008a.75.75 0 00.352-.004l.05-.02.017-.008.002-.001a.75.75 0 00.1-.043c.095-.06.183-.127.265-.205L19.5 15.25V9.25L10.25 2.25H5.25A2.25 2.25 0 003 4.5v15.75A2.25 2.25 0 005.25 22.5h6.29Z" clipRule="evenodd" />
  <path fillRule="evenodd" d="M12.25 15.25V5.5h4.167L12.25 2.25v13Z" clipRule="evenodd" />
</svg>`;


const FAQItem: React.FC<FAQItemProps> = ({ faq, isExpanded, onToggle, onEdit, onDelete, canManage }) => {
  // Retorna null ou um placeholder se faq for inválido para evitar erros
  if (!faq || typeof faq !== 'object' || !faq.id) {
    console.warn("FAQItem received invalid faq prop:", faq);
    return null;
  }

  // Função para renderizar a resposta (HTML ou Markdown)
  const renderFaqAnswer = (answerContent: string | null | undefined) => {
    if (!answerContent || answerContent.trim() === '' || answerContent.trim() === '<p><br></p>') {
      return <p className="text-slate-500 italic">Nenhuma resposta fornecida.</p>;
    }

    const documentContentForAIRegex = /<div style="display:none;">\s*\*\*\*Conteúdo do Documento para IA[\s\S]*?\*\*\*FIM DO CONTEÚDO DO DOCUMENTO PARA IA\*\*\*<\/div>\s*/gi;
    const contentForDisplay = answerContent.replace(documentContentForAIRegex, '').trim();

    if (!contentForDisplay || contentForDisplay === '<p></p>') {
      return <p className="text-slate-500 italic">Nenhuma resposta textual fornecida.</p>;
    }

    const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(contentForDisplay);

    if (looksLikeHtml) {
      const cleanHtml = DOMPurify.sanitize(contentForDisplay, {
        USE_PROFILES: { html: true },
        ADD_ATTR: ['target', 'rel', 'download', 'alt', 'src', 'width', 'height', 'style'] // Permite style para imagens redimensionadas
      });
      // Adiciona classe 'prose' ao wrapper para melhor estilo padrão
      return <div className="prose prose-sm sm:prose-base max-w-none" dangerouslySetInnerHTML={{ __html: cleanHtml }} />;
    } else {
      // Renderiza como Markdown dentro de um div com classe 'prose'
      return (
        <div className="prose prose-sm sm:prose-base max-w-none">
          <ReactMarkdown
            components={{ a: LinkRenderer }}
            remarkPlugins={[remarkGfm]}
          >
            {contentForDisplay}
          </ReactMarkdown>
        </div>
      );
    }
  };

  // Função para renderizar a lista de anexos (apenas documentos)
  const renderAttachments = (attachments?: FAQAttachment[]) => {
    const documentAttachments = attachments?.filter(att => att.type === 'document' && att.url); // Garante que a URL exista

    if (!documentAttachments || documentAttachments.length === 0) {
      return null;
    }

    return (
      <div className="flex flex-wrap gap-2 mt-4">
        {documentAttachments.map((att) => (
          <a
            key={att.url} // Usa URL como chave
            href={att.url}
            target="_blank"
            rel="noopener noreferrer"
            download // Adiciona atributo download
            className="faq-document-card inline-flex items-center bg-gray-100 p-2 pr-3 rounded-lg border border-gray-200 hover:bg-gray-200 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-400 transition-colors text-sm text-slate-700 hover:text-slate-900" // Corrigido cor do texto
            title={`Baixar ${att.name || 'documento'}`}
          >
            <span
              dangerouslySetInnerHTML={{ __html: att.extension?.toLowerCase() === 'pdf' ? PDF_ICON_SVG_ITEM : DOCUMENT_ICON_SVG_ITEM }}
              className="flex-shrink-0"
              aria-hidden="true" // Esconde ícone de leitores de tela
            />
            <span className="quill-document-filename truncate ml-1.5">{att.name || 'Anexo'}</span>
          </a>
        ))}
      </div>
    );
  };

  // Verifica se o FAQ atual tem anexos do tipo 'document'
  const hasDocumentAttachments = faq.attachments?.some(att => att.type === 'document');

  return (
    <div className="border border-slate-200 rounded-lg shadow-sm transition-shadow duration-300 ease-in-out hover:shadow-md bg-white">
      {/* Botão para expandir/recolher */}
      <button
        onClick={onToggle}
        className="w-full flex justify-between items-center p-4 text-left text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-orange-300 rounded-t-lg"
        aria-expanded={isExpanded}
      // Adiciona aria-controls para acessibilidade se o conteúdo tiver ID
      // aria-controls={`faq-content-${faq.id}`}
      >
        <span className="font-medium text-base mr-2">{faq.question}</span>
        <div className="flex items-center space-x-2 flex-shrink-0">
          {hasDocumentAttachments && !isExpanded && (
            <DocumentIcon className="w-5 h-5 text-slate-400" aria-label="Possui anexos" />
          )}
          {isExpanded ? (
            <ChevronUpIcon className="w-5 h-5 text-orange-600" aria-hidden="true" />
          ) : (
            <ChevronDownIcon className="w-5 h-5 text-slate-500" aria-hidden="true" />
          )}
        </div>
      </button>

      {/* Conteúdo Expandido */}
      {isExpanded && (
        // Pode adicionar id aqui se usar aria-controls
        // id={`faq-content-${faq.id}`}
        <div className="p-4 border-t border-slate-200 bg-slate-50 rounded-b-lg">
          <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
            {/* Bloco da Resposta e Anexos */}
            <div className="flex-grow break-words max-w-full overflow-hidden"> {/* Adiciona overflow-hidden */}
              {renderFaqAnswer(faq.answer)}
              {renderAttachments(faq.attachments)}
            </div>

            {/* Bloco de Botões de Ação (Condicional) */}
            {canManage && (
              <div className="flex-shrink-0 flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 mt-2 sm:mt-0 self-start sm:self-start"> {/* Ajusta alinhamento */}
                <button
                  onClick={() => onEdit(faq)}
                  className="p-2 rounded-md bg-blue-500 text-white hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                  aria-label={`Editar FAQ: ${faq.question}`}
                  title="Editar FAQ"
                >
                  <PencilIcon className="w-4 h-4 sm:w-5 sm:h-5" /> {/* Tamanho responsivo */}
                </button>
                <button
                  onClick={() => onDelete(faq.id)}
                  className="p-2 rounded-md bg-red-500 text-white hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
                  aria-label={`Excluir FAQ: ${faq.question}`}
                  title="Excluir FAQ"
                >
                  <TrashIcon className="w-4 h-4 sm:w-5 sm:h-5" /> {/* Tamanho responsivo */}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FAQItem;