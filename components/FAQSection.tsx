import React, { useState, useMemo } from 'react';
import { FAQ } from '../types';
import FAQItem from './FAQItem';
import { SearchIcon } from './Icons';
import { useAuth } from './contexts/AuthContext'; // Importa useAuth

interface FAQSectionProps {
  faqs: FAQ[];
  onEditFAQ: (faq: FAQ) => void;
  onDeleteFAQ: (id: string) => void;
  // Prop 'canManage' foi removida daqui, será obtida do contexto
}

const FAQSection: React.FC<FAQSectionProps> = ({ faqs, onEditFAQ, onDeleteFAQ }) => {
  const { user } = useAuth(); // Pega o usuário do contexto
  // Calcula a permissão baseado no usuário logado
  const canManage = !!user && (user.role === 'admin' || user.role === 'editor');

  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filtra FAQs válidos e que correspondem à busca
  const filteredFAQs = useMemo(() => {
    const safeFaqs = Array.isArray(faqs) ? faqs.filter(Boolean) : [];
    let resultFaqs;
    const lowerSearchTerm = searchTerm.toLowerCase();

    if (!lowerSearchTerm) {
      // Filtra apenas por estrutura válida se não houver busca
      resultFaqs = safeFaqs.filter(faq =>
        typeof faq === 'object' && faq !== null &&
        typeof faq.id === 'string' &&
        typeof faq.question === 'string' &&
        typeof faq.answer === 'string' &&
        typeof faq.category === 'string'
      );
    } else {
      // Filtra por estrutura válida E pelo termo de busca
      resultFaqs = safeFaqs.filter(faq => {
        if (
          typeof faq !== 'object' || faq === null ||
          typeof faq.id !== 'string' ||
          typeof faq.question !== 'string' ||
          typeof faq.answer !== 'string' ||
          typeof faq.category !== 'string'
        ) {
          return false; // Ignora FAQs malformados
        }
        // Verifica se o termo de busca está presente na pergunta, resposta ou categoria
        return (
          faq.question.toLowerCase().includes(lowerSearchTerm) ||
          faq.answer.toLowerCase().includes(lowerSearchTerm) ||
          faq.category.toLowerCase().includes(lowerSearchTerm) ||
          (faq.documentText && faq.documentText.toLowerCase().includes(lowerSearchTerm)) // Inclui busca no texto do documento
        );
      }
      );
    }
    return resultFaqs;
  }, [searchTerm, faqs]);

  // Agrupa os FAQs filtrados por categoria
  const faqsByCategory = useMemo(() => {
    const result = filteredFAQs.reduce((acc, faq) => {
      const categoryKey = faq.category || 'Sem Categoria'; // Usa 'Sem Categoria' se não houver
      if (!acc[categoryKey]) {
        acc[categoryKey] = [];
      }
      acc[categoryKey].push(faq);
      return acc;
    }, {} as Record<string, FAQ[]>);
    return result;
  }, [filteredFAQs]);

  // Função para alternar a expansão de um FAQ
  const toggleFAQ = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // Handler para clique no botão Editar (com verificação de permissão)
  const handleEditClick = (faq: FAQ) => {
    if (canManage) {
      onEditFAQ(faq);
    } else {
      console.warn("Tentativa de edição sem permissão.");
      alert("Você não tem permissão para editar FAQs.");
    }
  };

  // Handler para clique no botão Excluir (com verificação de permissão e confirmação)
  const handleDeleteClick = (id: string) => {
    if (canManage) {
      if (window.confirm("Tem certeza que deseja excluir este FAQ?")) {
        onDeleteFAQ(id);
      }
    } else {
      console.warn("Tentativa de exclusão sem permissão.");
      alert("Você não tem permissão para excluir FAQs.");
    }
  };

  return (
    <div className="bg-white p-6 sm:p-8 rounded-lg shadow-xl container mx-auto max-w-4xl">
      <h2 className="text-3xl font-bold text-slate-800 mb-6 text-center">Perguntas Frequentes (FAQ)</h2>

      {/* Input de Busca */}
      <div className="mb-8 relative">
        <input
          type="text"
          placeholder="Buscar nos FAQs..."
          className="w-full p-3 pl-10 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-shadow"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          aria-label="Buscar nos FAQs"
        />
        <SearchIcon className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none" />
      </div>

      {/* Lista de FAQs por Categoria */}
      {Object.keys(faqsByCategory).length > 0 ? (
        Object.entries(faqsByCategory).sort(([catA], [catB]) => catA.localeCompare(catB)).map(([category, categoryFaqs]) => ( // Ordena categorias alfabeticamente
          <div key={category} className="mb-8">
            <h3 className="text-xl font-semibold text-orange-700 mb-4 border-b-2 border-orange-200 pb-2">{category}</h3>
            <div className="space-y-3">
              {categoryFaqs.map((faq) => ( // Garante que faq existe (já filtrado antes)
                <FAQItem
                  key={faq.id}
                  faq={faq}
                  isExpanded={expandedId === faq.id}
                  onToggle={() => toggleFAQ(faq.id)}
                  onEdit={handleEditClick} // Passa o handler que já verifica permissão
                  onDelete={handleDeleteClick} // Passa o handler que já verifica permissão
                  canManage={canManage} // Passa a permissão calculada para o FAQItem
                />
              ))}
            </div>
          </div>
        ))
      ) : (
        // Mensagem se não houver FAQs ou resultados de busca
        <p className="text-slate-600 text-center py-4">
          {searchTerm ? "Nenhum FAQ encontrado para sua busca." : "Nenhum FAQ disponível no momento."}
        </p>
      )}
    </div>
  );
};

export default FAQSection;