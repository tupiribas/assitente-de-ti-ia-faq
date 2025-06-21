// assistente-de-ti/components/FAQItem.tsx

import React from 'react';
import { FAQ } from '../types';
import { ChevronDownIcon, ChevronUpIcon, PencilIcon, TrashIcon } from './Icons';
import ReactMarkdown from 'react-markdown'; // Importado para renderizar Markdown

interface FAQItemProps {
  faq: FAQ;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: (faq: FAQ) => void;
  onDelete: (id: string) => void;
}

// NOVO: Componente renderizador customizado para links em Markdown
const LinkRenderer = (props: any) => {
  // Verifica se o link é para um arquivo que deve ser baixado/visualizado
  // Assumimos que links de documentos/imagens estarão em /uploads
  const isAssetLink = props.href && props.href.startsWith('/uploads/');

  if (isAssetLink) {
    return (
      <a
        href={props.href}
        target="_blank" // Abre em nova aba
        rel="noopener noreferrer" // Segurança para target="_blank"
        download={props.children.toString().includes('documento') || props.children.toString().includes('Documento') ? true : undefined} // Sugere download se o texto do link mencionar 'documento'
        className="text-orange-600 hover:text-orange-800 underline" // Estilo para o link
      >
        {props.children}
      </a>
    );
  }

  // Para outros links que não são de assets (ex: externos), renderiza como padrão
  return <a {...props} className="text-orange-600 hover:text-orange-800 underline">{props.children}</a>;
};


const FAQItem: React.FC<FAQItemProps> = ({ faq, isExpanded, onToggle, onEdit, onDelete }) => {
  return (
    <div className="border border-slate-200 rounded-lg shadow-sm transition-all duration-300 ease-in-out hover:shadow-md">
      <button
        onClick={onToggle}
        className="w-full flex justify-between items-center p-4 text-left text-slate-700 hover:bg-slate-50 focus:outline-none"
        aria-expanded={isExpanded}
      >
        <span className="font-medium text-base">{faq.question}</span>
        {isExpanded ? <ChevronUpIcon className="w-5 h-5 text-orange-600" /> : <ChevronDownIcon className="w-5 h-5 text-slate-500" />}
      </button>
      {isExpanded && (
        <div className="p-4 border-t border-slate-200 bg-slate-50">
          {/* Contêiner flex para alinhamento da resposta e botões */}
          <div className="flex items-start justify-between">
            <div className="prose prose-sm max-w-none text-slate-600 leading-relaxed pr-4 flex-grow">
              {/* MODIFICADO: Passa o componente customizado para renderizar links */}
              <ReactMarkdown components={{ a: LinkRenderer }}>
                {faq.answer}
              </ReactMarkdown>
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