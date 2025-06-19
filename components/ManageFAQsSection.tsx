// assistente-de-ti/components/ManageFAQsSection.tsx

import React, { useState, useEffect, useRef } from 'react';
import { FAQ } from '../types';
import LoadingSpinner from './LoadingSpinner';

interface ManageFAQsSectionProps {
  onAddFAQ: (newFaqData: Omit<FAQ, 'id'>) => Promise<FAQ>;
  faqToEdit?: FAQ | null; // Continua opcional pois é null para nova criação
  onSaveEditedFAQ: (updatedFaqData: Omit<FAQ, 'id'>) => Promise<void>; // Agora é obrigatório
  onCancel: () => void; // Agora é obrigatório
}

const ManageFAQsSection: React.FC<ManageFAQsSectionProps> = ({ onAddFAQ, faqToEdit, onSaveEditedFAQ, onCancel }) => {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [category, setCategory] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (faqToEdit) {
      setQuestion(faqToEdit.question);
      setAnswer(faqToEdit.answer);
      setCategory(faqToEdit.category);
    } else {
      setQuestion('');
      setAnswer('');
      setCategory('');
    }
    setError(null);
    setSuccessMessage(null);
    setUploadedImageUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [faqToEdit]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setUploadedImageUrl(null);
    } else {
      setSelectedFile(null);
    }
  };

  const handleImageUpload = async () => {
    if (!selectedFile) {
      setError('Por favor, selecione um arquivo de imagem para fazer o upload.');
      return;
    }

    setUploadingImage(true);
    setError(null);
    setSuccessMessage(null);

    const formData = new FormData();
    formData.append('image', selectedFile);

    try {
      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Falha no upload da imagem.');
      }

      const data = await response.json();
      setUploadedImageUrl(data.imageUrl);
      setSuccessMessage('Imagem enviada com sucesso! Copie a URL para usar no FAQ.');
      setAnswer(prevAnswer => prevAnswer + `\n\n![Descrição da Imagem](${data.imageUrl})\n`);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Erro desconhecido ao enviar imagem.";
      setError(`Erro no upload: ${errorMessage}`);
    } finally {
      setUploadingImage(false);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };


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
      if (faqToEdit) { // Se for modo de edição
        await onSaveEditedFAQ({ question, answer, category }); // Chama a prop para salvar edição
        setSuccessMessage('FAQ atualizado com sucesso!');
      } else { // Se for modo de criação
        await onAddFAQ({ question, answer, category }); // Chama a prop para adicionar
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

  const formTitle = faqToEdit ? `Editar FAQ (ID: ${faqToEdit.id})` : 'Adicionar Novo FAQ';

  return (
    // Ajuste no padding para telas menores: p-4 (padrão) sm:p-8 (maior)
    <div className="bg-white p-4 sm:p-8 rounded-lg shadow-xl max-w-2xl mx-auto">
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
            disabled={isSubmitting || uploadingImage}
          />
        </div>

        <div>
          <label htmlFor="faq-answer" className="block text-sm font-medium text-slate-700 mb-1">
            Resposta (Solução) - Suporta Markdown para imagens: `![alt text](URL_DA_IMAGEM)`
          </label>
          <textarea
            id="faq-answer"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={5}
            className="w-full p-3 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow resize-y"
            placeholder="Descreva a solução passo a passo ou cole a URL da imagem aqui com Markdown."
            aria-required="true"
            disabled={isSubmitting || uploadingImage}
          />
        </div>

        {/* Seção de Upload de Imagem */}
        <div className="border-t border-slate-200 pt-6 mt-6 space-y-4">
          <h3 className="text-lg font-semibold text-slate-800">Anexar Imagem</h3>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            ref={fileInputRef}
            className="block w-full text-sm text-slate-500
                       file:mr-4 file:py-2 file:px-4
                       file:rounded-full file:border-0
                       file:text-sm file:font-semibold
                       file:bg-blue-50 file:text-blue-700
                       hover:file:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isSubmitting || uploadingImage}
          />
          <button
            type="button"
            onClick={handleImageUpload}
            className="w-full bg-green-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 ease-in-out flex items-center justify-center"
            disabled={!selectedFile || isSubmitting || uploadingImage}
          >
            {uploadingImage ? <LoadingSpinner size="sm" color="text-white" /> : 'Fazer Upload da Imagem'}
          </button>
          {uploadedImageUrl && (
            <p className="text-sm text-blue-600 bg-blue-50 p-3 rounded-md break-all">
              URL da Imagem: <a href={uploadedImageUrl} target="_blank" rel="noopener noreferrer" className="underline">{uploadedImageUrl}</a>
              <br/>
              **Sugestão Markdown:** `![Alt Text da Imagem]({uploadedImageUrl})`
            </p>
          )}
        </div>
        {/* FIM: Seção de Upload de Imagem */}


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
            disabled={isSubmitting || uploadingImage}
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

        {/* Ajuste nos botões para responsividade */}
        <div className="flex flex-col space-y-3 sm:flex-row sm:space-x-3 sm:space-y-0">
          {/* O botão Cancelar será exibido se onCancel for fornecido (sempre será por FAQManagePage) */}
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="w-full sm:w-auto bg-slate-400 text-white font-semibold py-3 px-4 rounded-lg hover:bg-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting || uploadingImage}
            >
              Cancelar
            </button>
          )}
          <button
            type="submit"
            className="w-full sm:w-auto bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isSubmitting || uploadingImage}
          >
            {isSubmitting ? (faqToEdit ? 'Salvando...' : 'Adicionando...') : (faqToEdit ? 'Salvar Edição' : 'Adicionar FAQ')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ManageFAQsSection;