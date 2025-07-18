// assistente-de-ti/components/FAQSection.tsx

import React, { useState, useMemo } from 'react';
import { FAQ } from '../types';
import FAQItem from './FAQItem';
import { SearchIcon } from './Icons';

interface FAQSectionProps {
  faqs: FAQ[];
  onEditFAQ: (faq: FAQ) => void;
  onDeleteFAQ: (id: string) => void;
}

const FAQSection: React.FC<FAQSectionProps> = ({ faqs, onEditFAQ, onDeleteFAQ }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredFAQs = useMemo(() => {
    if (!searchTerm) {
      // VVVV INÍCIO DA CORREÇÃO VVVV
      return faqs.filter(faq => faq && typeof faq.question === 'string' && typeof faq.answer === 'string' && typeof faq.category === 'string'); // Garante que o FAQ é um objeto válido
      // ^^^^ FIM DA CORREÇÃO ^^^^
    }
    return faqs.filter(
      (faq) => {
        // VVVV INÍCIO DA CORREÇÃO VVVV
        if (!faq || typeof faq.question !== 'string' || typeof faq.answer !== 'string' || typeof faq.category !== 'string') {
          return false; // Ignora FAQs malformados na filtragem
        }
        // ^^^^ FIM DA CORREÇÃO ^^^^
        return (
          faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
          faq.answer.toLowerCase().includes(searchTerm.toLowerCase()) ||
          faq.category.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }
    );
  }, [searchTerm, faqs]);

  const faqsByCategory = useMemo(() => {
    return filteredFAQs.reduce((acc, faq) => {
      // VVVV INÍCIO DA CORREÇÃO VVVV
      if (!faq) { // Filtra qualquer FAQ nulo/indefinido que possa ter passado
        return acc;
      }
      // ^^^^ FIM DA CORREÇÃO ^^^^
      if (!acc[faq.category]) {
        acc[faq.category] = [];
      }
      acc[faq.category].push(faq);
      return acc;
    }, {} as Record<string, FAQ[]>);
  }, [filteredFAQs]);

  const toggleFAQ = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleEditClick = (faq: FAQ) => {
    onEditFAQ(faq);
  };

  const handleDeleteClick = (id: string) => {
    if (window.confirm("Tem certeza que deseja excluir este FAQ?")) {
      onDeleteFAQ(id);
    }
  };

  return (
    <div className="bg-white p-6 sm:p-8 rounded-lg shadow-xl container mx-auto max-w-4xl">
      <h2 className="text-3xl font-bold text-slate-800 mb-6 text-center">Perguntas Frequentes (FAQ)</h2>

      <div className="mb-8 relative">
        <input
          type="text"
          placeholder="Buscar nos FAQs..."
          className="w-full p-3 pl-10 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          aria-label="Buscar nos FAQs"
        />
        <SearchIcon className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
      </div>

      {Object.keys(faqsByCategory).length > 0 ? (
        Object.entries(faqsByCategory).map(([category, categoryFaqs]) => (
          <div key={category} className="mb-8">
            <h3 className="text-xl font-semibold text-orange-700 mb-4 border-b-2 border-orange-200 pb-2">{category}</h3>
            <div className="space-y-3">
              {/* VVVV INÍCIO DA CORREÇÃO VVVV */}
              {categoryFaqs.filter(faq => faq).map((faq) => ( // Filtra items null/undefined antes de mapear
                // ^^^^ FIM DA CORREÇÃO ^^^^
                <FAQItem
                  key={faq.id}
                  faq={faq}
                  isExpanded={expandedId === faq.id}
                  onToggle={() => toggleFAQ(faq.id)}
                  onEdit={handleEditClick}
                  onDelete={handleDeleteClick}
                />
              ))}
            </div>
          </div>
        ))
      ) : (
        <p className="text-slate-600 text-center py-4">
          {searchTerm ? "Nenhum FAQ encontrado para sua busca." : "Nenhum FAQ disponível no momento."}
        </p>
      )}
    </div>
  );
};

export default FAQSection;