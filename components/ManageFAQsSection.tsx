import React, { useState, useEffect, useRef } from 'react';
import { FAQ } from '../types';
import LoadingSpinner from './LoadingSpinner';

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

  // NOVO ESTADO: Para gerenciar o upload de imgam
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null); // Ref para resetar o input de arquivo

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
    setUploadedImageUrl(null); // Limpa a URL da imagem ao mudar de modo
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // Reseta o input de arquivo
    }
  }, [faqToEdit]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setUploadedImageUrl(null); // Limpa a URL anterior ao selecionar um novo arquivo
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
    formData.append('image', selectedFile); // 'image' deve corresponder ao campo esperado no Multer (upload.single('image'))

    try {
      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
        // Não defina Content-Type; o navegador faz isso automaticamente com FormData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Falha no upload da imagem.');
      }

      const data = await response.json();
      setUploadedImageUrl(data.imageUrl);
      setSuccessMessage('Imagem enviada com sucesso! Copie a URL para usar no FAQ.');
      // Opcional: Adicionar automaticamente a URL no campo de resposta
      setAnswer(prevAnswer => prevAnswer + `\n\n![Descrição da Imagem](${data.imageUrl})\n`);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Erro desconhecido ao enviar imagem.";
      setError(`Erro no upload: ${errorMessage}`);
    } finally {
      setUploadingImage(false);
      setSelectedFile(null); // Limpa o arquivo selecionado após o upload
      if (fileInputRef.current) {
        fileInputRef.current.value = ''; // Reseta o input de arquivo
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
        {/* NOVO: Seção de Upload de Imagem */}
        <div className="pt-0 mt-0 space-y-4">
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
              <br />
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

        <div className="flex flex-col space-y-3 sm:flex-row sm:space-x-3 sm:space-y-0">
          {faqToEdit && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              // w-full: ocupa 100% da largura em telas pequenas
              // sm:w-auto: largura automática (baseada no conteúdo) em telas 'sm' e maiores
              className="w-full sm:w-auto bg-slate-400 text-white font-semibold py-3 px-4 rounded-lg hover:bg-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting || uploadingImage}
            >
              Cancelar
            </button>
          )}
          <button
            type="submit"
            // w-full: ocupa 100% da largura em telas pequenas
            // sm:w-auto: largura automática (baseada no conteúdo) em telas 'sm' e maiores
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