// assistente-de-ti/components/ManageFAQsSection.tsx

import React, { useState, useEffect } from 'react';
import { FAQ } from '../types';

interface ManageFAQsSectionProps {
  onAddFAQ: (newFaqData: Omit<FAQ, 'id'>) => Promise<FAQ>; // Para adicionar (modo padrão)
  // NOVOS: Props para o modo de edição
  faqToEdit?: FAQ | null; // O FAQ que está sendo editado (se houver)
  onSaveEditedFAQ?: (updatedFaqData: Omit<FAQ, 'id'>) => Promise<void>; // Função para salvar a edição
  onCancel?: () => void; // Função para cancelar a edição
}

const ManageFAQsSection: React.FC<ManageFAQsSectionProps> = ({ onAddFAQ, faqToEdit, onSaveEditedFAQ, onCancel }) => {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [category, setCategory] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Efeito para pré-preencher os campos quando em modo de edição
  useEffect(() => {
    if (faqToEdit) {
      setQuestion(faqToEdit.question);
      setAnswer(faqToEdit.answer);
      setCategory(faqToEdit.category);
    } else {
      // Limpa os campos se não estiver em modo de edição
      setQuestion('');
      setAnswer('');
      setCategory('');
    }
    setError(null);
    setSuccessMessage(null);
  }, [faqToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    if (!question.trim() || !answer.trim() || !category.trim()) {
      setError('Todos os campos (Pergunta, Resposta e Categoria) são obrigatórios.');
      setIsSubmitting(false);
      return;
    }

    try {
      if (faqToEdit && onSaveEditedFAQ) {
        // Modo de Edição
        await onSaveEditedFAQ({ question, answer, category });
        setSuccessMessage('FAQ atualizado com sucesso!');
      } else {
        // Modo de Adição
        await onAddFAQ({ question, answer, category });
        setQuestion('');
        setAnswer('');
        setCategory('');
        setSuccessMessage('FAQ adicionado com sucesso!');
      }
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Erro desconhecido ao processar FAQ.";
      setError(`Falha ao processar FAQ: ${errorMessage}`);
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  // NOVO: Título dinâmico
  const formTitle = faqToEdit ? `Editar FAQ (ID: ${faqToEdit.id})` : 'Adicionar Novo FAQ';

  return (
    <div className="bg-white p-6 sm:p-8 rounded-lg shadow-xl max-w-2xl mx-auto">
      <h2 className="text-3xl font-bold text-slate-800 mb-6 text-center">{formTitle}</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="faq-question" className="block text-sm font-medium text-slate-700 mb-1">
            Pergunta (Título)
          </label>
          <input
            type="text"
            id="faq-question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="w-full p-3 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
            placeholder="Ex: Como resolvo problemas de conexão Wi-Fi?"
            aria-required="true"
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label htmlFor="faq-answer" className="block text-sm font-medium text-slate-700 mb-1">
            Resposta (Solução)
          </label>
          <textarea
            id="faq-answer"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={5}
            className="w-full p-3 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow resize-y"
            placeholder="Descreva a solução passo a passo..."
            aria-required="true"
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label htmlFor="faq-category" className="block text-sm font-medium text-slate-700 mb-1">
            Categoria
          </label>
          <input
            type="text"
            id="faq-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full p-3 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
            placeholder="Ex: Conectividade, Software, Hardware"
            aria-required="true"
            disabled={isSubmitting}
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-100 p-3 rounded-md text-center" role="alert">
            {error}
          </p>
        )}

        {successMessage && (
          <p className="text-sm text-green-600 bg-green-100 p-3 rounded-md text-center" role="status">
            {successMessage}
          </p>
        )}

        <div className="flex space-x-3">
          {faqToEdit && onCancel && ( // NOVO: Botão de Cancelar no modo de edição
            <button
              type="button"
              onClick={onCancel}
              className="flex-grow bg-slate-400 text-white font-semibold py-3 px-4 rounded-lg hover:bg-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting}
            >
              Cancelar
            </button>
          )}
          <button
            type="submit"
            className="flex-grow bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isSubmitting}
          >
            {isSubmitting ? (faqToEdit ? 'Salvando...' : 'Adicionando...') : (faqToEdit ? 'Salvar Edição' : 'Adicionar FAQ')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ManageFAQsSection;