// assistente-de-ti/components/FAQItem.tsx

import React from 'react';
import { FAQ } from '../types';
import { ChevronDownIcon, ChevronUpIcon, PencilIcon, TrashIcon } from './Icons';
import ReactMarkdown from 'react-markdown';

interface FAQItemProps {
  faq: FAQ;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: (faq: FAQ) => void;
  onDelete: (id: string) => void;
}

const FAQItem: React.FC<FAQItemProps> = ({ faq, isExpanded, onToggle, onEdit, onDelete }) => {
  return (
    <div className="border border-slate-200 rounded-lg shadow-sm transition-all duration-300 ease-in-out hover:shadow-md">
      <button
        onClick={onToggle}
        className="w-full flex justify-between items-center p-4 text-left text-slate-700 hover:bg-slate-50 focus:outline-none"
        aria-expanded={isExpanded}
      >
        <span className="font-medium text-base">{faq.question}</span>
        {isExpanded ? <ChevronUpIcon className="w-5 h-5 text-blue-600" /> : <ChevronDownIcon className="w-5 h-5 text-slate-500" />}
      </button>
      {isExpanded && (
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
          {/* <p className="text-slate-600 whitespace-pre-line text-sm leading-relaxed pr-4">{faq.answer}</p> */}
          {/* NOVO: Renderiza o conteúdo do FAQ.answer como Markdown */}
          <div className="prose prose-sm max-w-none text-slate-600 leading-relaxed pr-4"> {/* Adicione 'prose' do Tailwind Typography se configurado, ou estilize manualmente */}
            <ReactMarkdown>
              {faq.answer}
            </ReactMarkdown>
          </div>
          <div className="flex-shrink-0 flex space-x-2">
            <button
              onClick={() => onEdit(faq)}
              className="p-2 rounded-md bg-blue-500 text-white hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
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
      )}
    </div>
  );
};

export default FAQItem;