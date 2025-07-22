import React from 'react';
import { FAQ, FAQAttachment } from '../types';
import { ChevronDownIcon, ChevronUpIcon, PencilIcon, TrashIcon, NoImageIcon } from './Icons';
import DOMPurify from 'dompurify';
import ReactMarkdown from 'react-markdown';
import { LinkRenderer } from './utils/markdownRenderers';
import remarkGfm from 'remark-gfm';

interface FAQItemProps {
  faq: FAQ;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: (faq: FAQ) => void;
  onDelete: (id: string) => void;
}

const PDF_ICON_SVG_ITEM = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="inline-block w-5 h-5 align-middle mr-1.5 text-red-600">
  <path fill-rule="evenodd" d="M19.5 7.5V4.5H4.5A.75.75 0 0 0 3.75 5.25v14.5A.75.75 0 0 0 4.5 20.5h15a.75.75 0 0 0 .75-.75V8.25A.75.75 0 0 0 19.5 7.5ZM13.297 9.75a.75.75 0 0 0-.987-1.125l-3 2.25a.75.75 0 0 0-.174.457v3.393a.75.75 0 0 0 .75.75h2.25a.75.75 0 0 0 .75-.75v-2.25h1.5a.75.75 0 0 0 0-1.5h-1.5Z" clip-rule="evenodd" />
</svg>`;

const FAQItem: React.FC<FAQItemProps> = ({ faq, isExpanded, onToggle, onEdit, onDelete }) => {
  if (!faq) {
    console.error("FAQItem received an undefined or null faq prop. Skipping render.");
    return null;
  }

  const renderFaqAnswer = (answerContent: string) => {
    let contentForDisplay = answerContent;

    const documentContentForAIRegex = /<div style="display:none;">\s*\*\*\*Conteúdo do Documento para IA \(NÃO EDITE\):\*\*\*[\s\S]*?\*\*\*FIM DO CONTEÚDO DO DOCUMENTO PARA IA\*\*\*<\/div>\s*/g;
    contentForDisplay = contentForDisplay.replace(documentContentForAIRegex, '');

    if (!contentForDisplay || contentForDisplay.trim() === '<p><br></p>' || contentForDisplay.trim() === '<p></p>' || contentForDisplay.trim() === '') {
      return <p className="text-slate-500 italic">Nenhuma resposta textual fornecida.</p>;
    }

    const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(contentForDisplay);

    if (looksLikeHtml) {
      const cleanHtml = DOMPurify.sanitize(contentForDisplay, {
        USE_PROFILES: { html: true },
        ADD_ATTR: ['target', 'rel', 'download', 'alt', 'src', 'width', 'height']
      });
      return <div dangerouslySetInnerHTML={{ __html: cleanHtml }} />;
    } else {
      return <ReactMarkdown components={{ a: LinkRenderer }} remarkPlugins={[remarkGfm]}>{contentForDisplay}</ReactMarkdown>;
    }
  };

  const renderAttachments = (attachments?: FAQAttachment[]) => {
    const documentAttachments = attachments?.filter(att => att.type === 'document');

    if (!documentAttachments || documentAttachments.length === 0) {
      return null;
    }

    return (
      <div className="flex flex-wrap gap-2 mt-4 justify-center">
        {documentAttachments.map((att) => (
          <div key={att.url} className="faq-document-card bg-gray-100 p-3 rounded-lg border border-gray-200 flex items-center space-x-3 shadow-md flex-grow-0">
            <a href={att.url} target="_blank" rel="noopener noreferrer" className="quill-document-link text-blue-700 hover:text-blue-900 focus:outline-none truncate">
              {/* CORREÇÃO AQUI: Renderize o SVG usando dangerouslySetInnerHTML */}
              <span dangerouslySetInnerHTML={{ __html: PDF_ICON_SVG_ITEM }} />
              <span className="quill-document-filename">{att.name}</span>
            </a>
          </div>
        ))}
      </div>
    );
  };


  return (
    <div className="border border-slate-200 rounded-lg shadow-sm transition-all duration-300 ease-in-out hover:shadow-md">
      <button
        onClick={onToggle}
        className="w-full flex justify-between items-center p-4 text-left text-slate-700 hover:bg-slate-500 focus:outline-none"
        aria-expanded={isExpanded}
      >
        <span className="font-medium text-base">{faq.question}</span>

        <div className="flex items-center space-x-2">
          {!faq.attachments || faq.attachments.filter(att => att.type === 'document').length === 0 ? (
            <NoImageIcon className="w-5 h-5 text-slate-400" aria-label="Sem anexos visuais de documento" />
          ) : null}
          {isExpanded ? <ChevronUpIcon className="w-5 h-5 text-orange-600" /> : <ChevronDownIcon className="w-5 h-5 text-slate-500" />}
        </div>
      </button>

      {isExpanded && (
        <div className="p-4 border-t border-slate-200 bg-slate-50">
          <div className="flex items-start justify-between">
            <div className="prose text-slate-600 leading-relaxed pr-4 flex-grow">
              {renderFaqAnswer(faq.answer)}
              {renderAttachments(faq.attachments)}
            </div>
            <div className="flex-shrink-0 flex space-x-2 mt-1">
              <button
                onClick={() => onEdit(faq)}
                className="p-2 rounded-md bg-orange-500 text-white hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors"
                aria-label={`Editar FAQ: ${faq.question}`}
              >
                <PencilIcon className="w-5 h-5" />
              </button>
              <button
                onClick={() => onDelete(faq.id)}
                className="p-2 rounded-md bg-red-500 text-white hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
                aria-label={`Excluir FAQ: ${faq.question}`}
              >
                <TrashIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FAQItem;