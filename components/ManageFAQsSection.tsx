import React, { useState, useEffect, useRef } from 'react';
import { FAQ, FAQAttachment } from '../types';
import LoadingSpinner from './LoadingSpinner';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

interface ManageFAQsSectionProps {
  onAddFAQ: (formData: FormData) => Promise<FAQ>;
  faqToEdit?: FAQ | null;
  onSaveEditedFAQ: (formData: FormData, faqId: string) => Promise<void>;
  onCancel: () => void;
}

const ManageFAQsSection: React.FC<ManageFAQsSectionProps> = ({ onAddFAQ, faqToEdit, onSaveEditedFAQ, onCancel }) => {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [category, setCategory] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedAssetFile, setSelectedAssetFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedAssetText, setUploadedAssetText] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<FAQAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const quillRef = useRef<ReactQuill>(null);

  useEffect(() => {
    if (faqToEdit) {
      setQuestion(faqToEdit.question);
      setAnswer(faqToEdit.answer);
      setCategory(faqToEdit.category);
      setAttachments(faqToEdit.attachments?.filter(att => att.type === 'document') || []);
      setUploadedAssetText(faqToEdit.documentText || null);
    } else {
      setQuestion('');
      setAnswer('');
      setCategory('');
      setAttachments([]);
      setUploadedAssetText(null);
    }
    setError(null);
    setSuccessMessage(null);
    setSelectedAssetFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [faqToEdit]);

  const handleAssetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedAssetFile(e.target.files[0]);
    } else {
      setSelectedAssetFile(null);
    }
  };

  const handleAssetUpload = async () => {
    if (!selectedAssetFile) {
      setError('Por favor, selecione um arquivo (imagem ou documento) para fazer o upload.');
      return;
    }
    setIsUploading(true);
    setError(null);
    setSuccessMessage(null);
    const formData = new FormData();
    formData.append('file', selectedAssetFile);
    try {
      const response = await fetch('/api/upload-asset', { method: 'POST', body: formData });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Falha no upload do arquivo.');
      }
      const data = await response.json();
      const newUrl = data.fileUrl;
      const newExtractedText = data.extractedText;
      const filename = selectedAssetFile.name;
      const fileType: 'image' | 'document' = selectedAssetFile.type.startsWith('image/') ? 'image' : 'document';
      if (fileType === 'image') {
        if (quillRef.current) {
          const editor = quillRef.current.getEditor();
          const range = editor.getSelection();
          const index = range ? range.index : editor.getLength();
          editor.insertEmbed(index, 'image', newUrl);
          editor.setSelection(index + 1, 0);
          setSuccessMessage('Imagem enviada e inserida no corpo da resposta!');
        } else {
          setAnswer(prevAnswer => prevAnswer + `<p><img src="${newUrl}" alt="${filename}"/></p>`);
          setSuccessMessage('Imagem enviada com sucesso! Insira-a manualmente no editor.');
        }
      } else {
        const newAttachment: FAQAttachment = {
          url: newUrl,
          name: filename,
          extension: filename.split('.').pop()?.toUpperCase() || 'ARQ',
          type: fileType,
        };
        setAttachments(prev => [...prev, newAttachment]);
        if (newExtractedText) {
          setUploadedAssetText(prev => (prev ? prev + '\n\n' : '') + `\n<div style="display:none;">\n***Conteúdo do Documento para IA (NÃO EDITE):***\n${newExtractedText}\n***FIM DO CONTEÚDO DO DOCUMENTO PARA IA***\n</div>\n`);
          setSuccessMessage('Documento enviado e texto extraído com sucesso! Ele será anexado ao FAQ e usado pela IA.');
        } else {
          setSuccessMessage('Documento enviado com sucesso! Ele será anexado ao FAQ.');
        }
      }
      setSelectedAssetFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Erro desconhecido ao enviar arquivo.";
      setError(`Erro no upload: ${errorMessage}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveAttachment = (urlToRemove: string) => {
    setAttachments(prev => prev.filter(att => att.url !== urlToRemove));
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
      const formData = new FormData();
      if (faqToEdit?.id) {
        formData.append('id', faqToEdit.id);
      }
      formData.append('question', question);
      formData.append('answer', answer);
      formData.append('category', category);
      formData.append('documentText', uploadedAssetText || '');
      formData.append('_attachmentsData', JSON.stringify(attachments));
      if (faqToEdit) {
        await onSaveEditedFAQ(formData, faqToEdit.id);
        setSuccessMessage('FAQ atualizado com sucesso!');
      } else {
        await onAddFAQ(formData);
        setQuestion('');
        setAnswer('');
        setCategory('');
        setUploadedAssetText(null);
        setAttachments([]);
        setSuccessMessage('FAQ adicionado com sucesso!');
      }
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Erro desconhecido.";
      setError(`Falha ao processar FAQ: ${errorMessage}`);
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formTitle = faqToEdit ? `Editar FAQ (ID: ${faqToEdit.id})` : 'Adicionar Novo FAQ';

  return (
    <div className="bg-white rounded-lg shadow-xl flex-grow flex flex-col overflow-hidden">
      <div className="p-4 sm:p-8 flex-shrink-0">
        <h2 className="text-3xl font-bold text-slate-800 text-center">{formTitle}</h2>
      </div>

      <form id="manage-faq-form" onSubmit={handleSubmit} className="flex-grow overflow-y-auto px-4 sm:px-8 space-y-6">
        <div>
          <label htmlFor="faq-question" className="block text-sm font-medium text-slate-700 mb-1">
            Pergunta (Título)
          </label>
          <input type="text" id="faq-question" value={question} onChange={(e) => setQuestion(e.target.value)} className="w-full p-3 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-shadow" placeholder="Ex: Como resolvo problemas de conexão Wi-Fi?" aria-required="true" disabled={isSubmitting || isUploading} />
        </div>

        <div>
          <label htmlFor="faq-answer" className="block text-sm font-medium text-slate-700 mb-1">
            Resposta (Solução)
          </label>
          {/* ALTERAÇÕES AQUI: Removido 'h-80', adicionado 'min-h-[200px]' e 'resize-y' */}
          <ReactQuill ref={quillRef} theme="snow" value={answer} onChange={setAnswer} modules={{ toolbar: [[{ 'header': [1, 2, false] }], ['bold', 'italic', 'underline', 'strike', 'blockquote'], [{ 'list': 'ordered' }, { 'list': 'bullet' }], ['link', 'image'], ['clean']] }} formats={['header', 'bold', 'italic', 'underline', 'strike', 'blockquote', 'list', 'bullet', 'link', 'image']} placeholder="Descreva a solução com formatação rica..." readOnly={isSubmitting || isUploading} className="w-full min-h-[200px] resize-y mb-10" />
        </div>

        <div className="border-t border-slate-200 pt-6 mt-6 space-y-4">
          <h3 className="text-lg font-semibold text-slate-800">Anexar Imagem ou Documento</h3>
          {attachments.map((att) => (
            <div key={att.url} className="faq-document-card bg-gray-100 p-3 rounded-lg border border-gray-200 flex items-center space-x-3 my-2 shadow-sm">
              <span className="bg-red-500 text-white font-bold px-2 py-1 rounded-md text-xs flex-shrink-0">{att.extension}</span>
              <a href={att.url} target="_blank" rel="noopener noreferrer" className="flex-1 text-blue-700 hover:text-blue-900 focus:outline-none truncate">{att.name}</a>
              <button type="button" onClick={() => handleRemoveAttachment(att.url)} className="text-red-500 hover:text-red-700 font-bold ml-2" title="Remover anexo">&times;</button>
            </div>
          ))}
          <div className="flex items-center space-x-3">
            <label htmlFor="file-upload-input" className="cursor-pointer bg-orange-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed" style={{ pointerEvents: (isSubmitting || isUploading) ? 'none' : 'auto', opacity: (isSubmitting || isUploading) ? 0.5 : 1 }}>Escolher ficheiro</label>
            <input id="file-upload-input" type="file" accept="image/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={handleAssetChange} ref={fileInputRef} className="hidden" disabled={isSubmitting || isUploading} />
            {selectedAssetFile ? (<span className="text-slate-700 text-sm font-medium truncate max-w-[calc(100%-150px)]">{selectedAssetFile.name}</span>) : (<span className="text-slate-500 text-sm">Nenhum ficheiro selecionado</span>)}
          </div>
          {selectedAssetFile && (<button type="button" onClick={handleAssetUpload} className="w-full bg-orange-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 ease-in-out flex items-center justify-center" disabled={isSubmitting || isUploading}>{isUploading ? <LoadingSpinner size="sm" color="text-white" /> : 'Fazer Upload do Arquivo'}</button>)}
        </div>

        {error && (<p className="text-sm text-red-600 bg-red-100 p-3 rounded-md text-center" role="alert">{error}</p>)}
        {successMessage && (<p className="text-sm text-green-600 bg-green-100 p-3 rounded-md text-center" role="status">{successMessage}</p>)}

        <div>
          <label htmlFor="faq-category" className="block text-sm font-medium text-slate-700 mb-1">
            Categoria
          </label>
          <input type="text" id="faq-category" value={category} onChange={(e) => setCategory(e.target.value)} className="w-full p-3 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-shadow" placeholder="Ex: Conectividade, Software, Hardware" aria-required="true" disabled={isSubmitting || isUploading} />
        </div>
      </form>

      <div className="flex-shrink-0 border-t border-slate-200 bg-white p-4" style={{ height: '100px' }}>
        <div className="flex justify-end items-center h-full space-x-4">
          {onCancel && (
            <button type="button" onClick={onCancel} className="px-8 py-3 font-semibold bg-slate-200 text-slate-800 rounded-lg hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled={isSubmitting || isUploading}>
              Cancelar
            </button>
          )}
          <button
            type="submit"
            form="manage-faq-form"
            className="px-8 py-3 font-semibold text-white bg-orange-600 rounded-lg hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled={isSubmitting || isUploading}
          >
            {isSubmitting ? (faqToEdit ? 'Salvando...' : 'Adicionando...') : (faqToEdit ? 'Salvar Edição' : 'Adicionar FAQ')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManageFAQsSection;