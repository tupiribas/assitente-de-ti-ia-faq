// assistente-de-ti/components/FAQSection.tsx

import React, { useState, useMemo } from 'react';
import { FAQ } from '../types';
import FAQItem from './FAQItem';
import { SearchIcon } from './Icons';
// ManageFAQsSection não é mais importado aqui, pois não é mais um modal interno.

interface FAQSectionProps {
  faqs: FAQ[];
  onEditFAQ: (faq: FAQ) => void;
  onDeleteFAQ: (id: string) => void;
  // onAddFAQ não é mais necessário aqui
}

const FAQSection: React.FC<FAQSectionProps> = ({ faqs, onEditFAQ, onDeleteFAQ }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // editingFaq e as funções de handleSaveEditedFAQ/handleCancelEdit são removidos

  const filteredFAQs = useMemo(() => {
    if (!searchTerm) {
      return faqs;
    }
    return faqs.filter(
      (faq) =>
        faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
        faq.answer.toLowerCase().includes(searchTerm.toLowerCase()) ||
        faq.category.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, faqs]);

  const faqsByCategory = useMemo(() => {
    return filteredFAQs.reduce((acc, faq) => {
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

  // Funções de clique em Editar/Excluir permanecem as mesmas, mas as props virão do App.tsx
  const handleEditClick = (faq: FAQ) => {
    onEditFAQ(faq); // Chama a prop que agora fará a navegação
  };

  const handleDeleteClick = (id: string) => {
    if (window.confirm("Tem certeza que deseja excluir este FAQ?")) {
      onDeleteFAQ(id); // Chama a prop
    }
  };


  return (
    <div className="bg-white p-6 sm:p-8 rounded-lg shadow-xl">
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
            <h3 className="text-xl font-semibold text-blue-700 mb-4 border-b-2 border-blue-200 pb-2">{category}</h3>
            <div className="space-y-3">
              {categoryFaqs.map((faq) => (
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

      {/* O modal de edição (ManageFAQsSection) foi removido daqui e será renderizado por uma rota separada em App.tsx */}
    </div>
  );
};

export default FAQSection;