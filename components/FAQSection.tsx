// assistente-de-ti/components/FAQSection.tsx

import React, { useState, useMemo } from 'react';
import { FAQ } from '../types';
import FAQItem from './FAQItem';
import { SearchIcon } from './Icons';
import ManageFAQsSection from './ManageFAQsSection'; // NOVO: Importar ManageFAQsSection para o modal de edição

interface FAQSectionProps {
  faqs: FAQ[];
  // NOVO: Props para as funções de CRUD que virão do App.tsx
  onEditFAQ: (faq: FAQ) => void;
  onDeleteFAQ: (id: string) => void;
  // NOVO: Prop para a função de adicionar (ManageFAQsSection precisa dela no modo de edição)
  onAddFAQ: (newFaqData: Omit<FAQ, 'id'>) => Promise<FAQ>;
}

const FAQSection: React.FC<FAQSectionProps> = ({ faqs, onEditFAQ, onDeleteFAQ, onAddFAQ }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // NOVO: Estado para controlar o FAQ que está sendo editado
  const [editingFaq, setEditingFaq] = useState<FAQ | null>(null);

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

  // NOVO: Função para lidar com o clique em Editar
  const handleEditClick = (faq: FAQ) => {
    setEditingFaq(faq); // Define o FAQ que será editado
  };

  // NOVO: Função para lidar com o clique em Excluir
  const handleDeleteClick = (id: string) => {
    if (window.confirm("Tem certeza que deseja excluir este FAQ?")) {
      onDeleteFAQ(id); // Chama a função onDeleteFAQ passada via props
    }
  };

  // NOVO: Função para lidar com o salvamento de um FAQ editado
  const handleSaveEditedFAQ = async (updatedFaqData: Omit<FAQ, 'id'>) => {
    if (editingFaq) {
      // Chama a função onEditFAQ do App.tsx
      await onEditFAQ({ ...updatedFaqData, id: editingFaq.id });
      setEditingFaq(null); // Fecha o modal de edição
      setExpandedId(null); // Colapsa o item após edição
    }
  };

  // NOVO: Função para cancelar a edição
  const handleCancelEdit = () => {
    setEditingFaq(null);
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
                  onEdit={handleEditClick}   // NOVO: Passando a função handleEditClick
                  onDelete={handleDeleteClick} // NOVO: Passando a função handleDeleteClick
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

      {/* NOVO: Modal de Edição (usando ManageFAQsSection) */}
      {editingFaq && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="relative bg-white p-6 sm:p-8 rounded-lg shadow-xl max-w-2xl w-full">
            <h2 className="text-3xl font-bold text-slate-800 mb-6 text-center">Editar FAQ</h2>
            {/* O ManageFAQsSection será adaptado para o modo de edição */}
            {/* Ele precisará de um prop para indicar que está em modo de edição e para pré-preencher os campos */}
            <ManageFAQsSection
              faqToEdit={editingFaq} // NOVO: Passa o FAQ a ser editado
              onSaveEditedFAQ={handleSaveEditedFAQ} // NOVO: Função para salvar a edição
              onCancel={handleCancelEdit} // NOVO: Função para cancelar
              onAddFAQ={onAddFAQ} // onAddFAQ é mantido porque ManageFAQsSection ainda tem essa prop
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default FAQSection;