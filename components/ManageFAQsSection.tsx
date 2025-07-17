
// import React, { useState, useEffect, useRef } from 'react';
// import { FAQ } from '../types';
// import LoadingSpinner from './LoadingSpinner';

// // Importações para o editor SimpleMDE
// import SimpleMDE from 'react-simplemde-editor';
// import 'easymde/dist/easymde.min.css';

// interface ManageFAQsSectionProps {
//   onAddFAQ: (newFaqData: Omit<FAQ, 'id'>) => Promise<FAQ>;
//   faqToEdit?: FAQ | null;
//   onSaveEditedFAQ: (updatedFaqData: FAQ) => Promise<void>; // <--- CORRIGIDO: Agora aceita o tipo FAQ completo
//   onCancel: () => void;
// }

// const ManageFAQsSection: React.FC<ManageFAQsSectionProps> = ({ onAddFAQ, faqToEdit, onSaveEditedFAQ, onCancel }) => {
//   const [question, setQuestion] = useState('');
//   const [answer, setAnswer] = useState('');
//   const [category, setCategory] = useState('');
//   const [error, setError] = useState<string | null>(null);
//   const [successMessage, setSuccessMessage] = useState<string | null>(null);
//   const [isSubmitting, setIsSubmitting] = useState(false);

//   const [selectedAssetFile, setSelectedAssetFile] = useState<File | null>(null); // Renomeado
//   const [isUploading, setIsUploading] = useState(false); // Renomeado
//   const [uploadedAssetUrl, setUploadedAssetUrl] = useState<string | null>(null); // Renomeado
//   const [uploadedAssetText, setUploadedAssetText] = useState<string | null>(null);
//   const fileInputRef = useRef<HTMLInputElement>(null);

//   useEffect(() => {
//     if (faqToEdit) {
//       setQuestion(faqToEdit.question);
//       setAnswer(faqToEdit.answer);
//       setCategory(faqToEdit.category);
//     } else {
//       setQuestion('');
//       setAnswer('');
//       setCategory('');
//     }
//     setError(null);
//     setSuccessMessage(null);
//     setUploadedAssetUrl(null);
//     setUploadedAssetText(null);
//     if (fileInputRef.current) {
//       fileInputRef.current.value = '';
//     }
//   }, [faqToEdit]);

//   const handleAssetChange = (e: React.ChangeEvent<HTMLInputElement>) => { // Renomeado
//     if (e.target.files && e.target.files[0]) {
//       setSelectedAssetFile(e.target.files[0]); // Usar novo estado
//       setUploadedAssetUrl(null);
//       setUploadedAssetText(null);
//     } else {
//       setSelectedAssetFile(null);
//     }
//   };

//   const handleAssetUpload = async () => { // Renomeado
//     if (!selectedAssetFile) { // Usar novo estado
//       setError('Por favor, selecione um arquivo (imagem ou documento) para fazer o upload.');
//       return;
//     }

//     setIsUploading(true); // Usar novo estado
//     setError(null);
//     setSuccessMessage(null);

//     const formData = new FormData();
//     formData.append('file', selectedAssetFile); // 'file' é o nome do campo esperado no Multer do backend

//     try {
//       // Mudar a rota para a nova /api/upload-asset
//       const response = await fetch('/api/upload-asset', {
//         method: 'POST',
//         body: formData,
//       });

//       if (!response.ok) {
//         const errorData = await response.json();
//         throw new Error(errorData.message || 'Falha no upload do arquivo.');
//       }

//       const data = await response.json();
//       setUploadedAssetUrl(data.fileUrl); // 'fileUrl' vem do backend
//       setUploadedAssetText(data.extractedText); // 'extractedText' vem do backend (será null para imagens)

//       let confirmationMessage = 'Arquivo enviado com sucesso!';
//       let textToAppend = '';

//       if (data.extractedText) {
//         confirmationMessage += ' Documento enviado e texto extraído com sucesso! O documento será anexado a este FAQ.';
//         textToAppend = `\n\n[Clique para ver/baixar o documento: ${selectedAssetFile.name}](${data.fileUrl})\n`; // Linha corrigida
//         // NÃO adicionamos mais o extractedText diretamente ao `answer` aqui para o usuário final
//         // Ele será salvo separadamente nos dados do FAQ.
//       } else {
//         confirmationMessage += ' Imagem enviada com sucesso! URL copiada. Cole a URL no campo Resposta para usar no FAQ.';
//         textToAppend = `\n\n![Descrição da Imagem](${data.fileUrl})\n`; // Link para a imagem
//       }

//       setSuccessMessage(confirmationMessage);
//       setAnswer(prevAnswer => prevAnswer + textToAppend); // Adiciona a URL/texto ao campo de resposta

//     } catch (err) {
//       const errorMessage = err instanceof Error ? err.message : "Erro desconhecido ao enviar arquivo.";
//       setError(`Erro no upload: ${errorMessage}`);
//     } finally {
//       setIsUploading(false); // Usar novo estado
//       setSelectedAssetFile(null); // Usar novo estado
//       if (fileInputRef.current) {
//         fileInputRef.current.value = '';
//       }
//     }
//   };


//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setError(null);
//     setSuccessMessage(null);
//     setIsSubmitting(true);

//     if (!question.trim() || !answer.trim() || !category.trim()) {
//       setError('Todos os campos (Pergunta, Resposta e Categoria) são obrigatórios.');
//       setIsSubmitting(false);
//       return;
//     }

//     try {
//       // Crie o objeto de dados do FAQ com os novos campos
//       const faqDataToSave = {
//         question,
//         answer,
//         category,
//         documentUrl: uploadedAssetUrl || undefined,
//         documentText: uploadedAssetText || undefined,
//       };

//       if (faqToEdit) { // Se for modo de edição
//         await onSaveEditedFAQ({ ...faqDataToSave, id: faqToEdit.id });
//         setSuccessMessage('FAQ atualizado com sucesso!');
//       } else { // Se for modo de criação
//         await onAddFAQ(faqDataToSave);
//         setQuestion('');
//         setAnswer('');
//         setCategory('');
//         setUploadedAssetUrl(null); // Limpa após salvar
//         setUploadedAssetText(null); // Limpa após salvar
//         setSuccessMessage('FAQ adicionado com sucesso!');
//       }
//       setTimeout(() => setSuccessMessage(null), 3000);
//     } catch (err) {
//       const errorMessage = err instanceof Error ? err.message : "Erro desconhecido ao processar FAQ.";
//       setError(`Falha ao processar FAQ: ${errorMessage}`);
//       setTimeout(() => setError(null), 5000);
//     } finally {
//       setIsSubmitting(false);
//     }
//   };

//   const formTitle = faqToEdit ? `Editar FAQ (ID: ${faqToEdit.id})` : 'Adicionar Novo FAQ';

//   return (
//     // Ajuste no padding para telas menores: p-4 (padrão) sm:p-8 (maior)
//     <div className="bg-white p-4 sm:p-8 rounded-lg shadow-xl container mx-auto max-w-2xl">
//       <h2 className="text-3xl font-bold text-slate-800 mb-6 text-center">{formTitle}</h2>

//       <form onSubmit={handleSubmit} className="space-y-6">
//         <div>
//           <label htmlFor="faq-question" className="block text-sm font-medium text-slate-700 mb-1">
//             Pergunta (Título)
//           </label>
//           <input
//             type="text"
//             id="faq-question"
//             value={question}
//             onChange={(e) => setQuestion(e.target.value)}
//             className="w-full p-3 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-shadow"
//             placeholder="Ex: Como resolvo problemas de conexão Wi-Fi?"
//             aria-required="true"
//             disabled={isSubmitting || isUploading}
//           />
//         </div>

//         <div>
//           <label htmlFor="faq-answer" className="block text-sm font-medium text-slate-700 mb-1">
//             Resposta (Solução)
//           </label>
//           <SimpleMDE
//             id="faq-answer" // Mantenha o ID para acessibilidade
//             value={answer}
//             onChange={setAnswer} // O SimpleMDE passará o conteúdo Markdown como string
//             options={{
//               // Configurações opcionais para o editor
//               spellChecker: false, // Desabilita o corretor ortográfico nativo do navegador
//               placeholder: "Descreva a solução com formatação, imagens e links usando Markdown...",
//               // Você pode personalizar a toolbar aqui
//               toolbar: [
//                 "bold", "italic", "heading", "|",
//                 "quote", "unordered-list", "ordered-list", "|",
//                 "link", "image", "|",
//                 "guide"
//               ],
//               status: false, // Oculta a barra de status inferior
//             }}
//             className="w-full border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-shadow"
//           // Ajuste de altura e estilo pode ser necessário via CSS adicional ou via options
//           // No EasyMDE, 'height' pode ser definido em pixels ou porcentagem nas opções ou via CSS
//           />
//         </div>
//         {/* Seção de Upload de Ativos (Imagens e Documentos) */}
//         <div className="border-t border-slate-200 pt-6 mt-6 space-y-4">
//           <h3 className="text-lg font-semibold text-slate-800">Anexar Imagem ou Documento</h3>

//           {/* NOVO: Div para o botão de escolha de arquivo e nome do arquivo selecionado */}
//           <div className="flex items-center space-x-3">
//             {/* Botão customizado para "Escolher ficheiro" */}
//             <label htmlFor="file-upload-input"
//               className="cursor-pointer bg-orange-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
//               // Desabilita o label se o formulário estiver sendo submetido ou o upload estiver em andamento
//               style={{ pointerEvents: (isSubmitting || isUploading) ? 'none' : 'auto', opacity: (isSubmitting || isUploading) ? 0.5 : 1 }}
//             >
//               Escolher ficheiro
//             </label>
//             {/* Input de arquivo real - ESCONDIDO */}
//             <input
//               id="file-upload-input" // ID para conectar com o label
//               type="file"
//               accept="image/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
//               onChange={handleAssetChange}
//               ref={fileInputRef}
//               className="hidden" // Classe para esconder o input nativo
//               disabled={isSubmitting || isUploading} // Manter disabled para consistência
//             />
//             {/* Exibe o nome do arquivo selecionado */}
//             {selectedAssetFile ? (
//               <span className="text-slate-700 text-sm font-medium truncate max-w-[calc(100%-150px)]"> {/* truncate para nomes longos */}
//                 {selectedAssetFile.name}
//               </span>
//             ) : (
//               <span className="text-slate-500 text-sm">Nenhum ficheiro selecionado</span>
//             )}
//           </div>

//           {/* Botão de "Fazer Upload do Arquivo" (este continua separado) */}
//           <button
//             type="button"
//             onClick={handleAssetUpload}
//             className="w-full bg-orange-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 ease-in-out flex items-center justify-center"
//             disabled={!selectedAssetFile || isSubmitting || isUploading}
//           >
//             {isUploading ? <LoadingSpinner size="sm" color="text-white" /> : 'Fazer Upload do Arquivo'}
//           </button>

//           {/* Mensagem de URL do arquivo e sugestão Markdown */}
//           {uploadedAssetUrl && (
//             <p className="text-sm text-orange-600 bg-orange-50 p-3 rounded-md break-all">
//               URL do Arquivo: <a href={uploadedAssetUrl} target="_blank" rel="noopener noreferrer" className="underline">{uploadedAssetUrl}</a>
//               <br />
//               **Sugestão Markdown:** `[Link para o Arquivo](${uploadedAssetUrl})`
//             </p>
//           )}
//         </div>
//         {/* FIM: Seção de Upload de Ativos */}


//         <div>
//           <label htmlFor="faq-category" className="block text-sm font-medium text-slate-700 mb-1">
//             Categoria
//           </label>
//           <input
//             type="text"
//             id="faq-category"
//             value={category}
//             onChange={(e) => setCategory(e.target.value)}
//             className="w-full p-3 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-shadow"
//             placeholder="Ex: Conectividade, Software, Hardware"
//             aria-required="true"
//             disabled={isSubmitting || isUploading}
//           />
//         </div>

//         {error && (
//           <p className="text-sm text-red-600 bg-red-100 p-3 rounded-md text-center" role="alert">
//             {error}
//           </p>
//         )}

//         {successMessage && (
//           <p className="text-sm text-green-600 bg-green-100 p-3 rounded-md text-center" role="status">
//             {successMessage}
//           </p>
//         )}

//         {/* Ajuste nos botões para responsividade */}
//         <div className="flex flex-col space-y-3 sm:flex-row sm:space-x-3 sm:space-y-0">
//           {/* O botão Cancelar será exibido se onCancel for fornecido (sempre será por FAQManagePage) */}
//           {onCancel && (
//             <button
//               type="button"
//               onClick={onCancel}
//               className="w-full sm:w-auto bg-slate-400 text-white font-semibold py-3 px-4 rounded-lg hover:bg-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
//               disabled={isSubmitting || isUploading}
//             >
//               Cancelar
//             </button>
//           )}
//           <button
//             type="submit"
//             className="w-full sm:w-auto bg-orange-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
//             disabled={isSubmitting || isUploading}
//           >
//             {isSubmitting ? (faqToEdit ? 'Salvando...' : 'Adicionando...') : (faqToEdit ? 'Salvar Edição' : 'Adicionar FAQ')}
//           </button>
//         </div>
//       </form>
//     </div>
//   );
// };

// export default ManageFAQsSection;
// assistente-de-ti/components/ManageFAQsSection.tsx
// assistente-de-ti/components/ManageFAQsSection.tsx

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FAQ } from '../types';
import LoadingSpinner from './LoadingSpinner';
import SimpleMDE from 'react-simplemde-editor';
import 'easymde/dist/easymde.min.css';

interface ManageFAQsSectionProps {
  onAddFAQ: (newFaqData: Omit<FAQ, 'id'>) => Promise<FAQ>;
  faqToEdit?: FAQ | null;
  onSaveEditedFAQ: (updatedFaqData: FAQ) => Promise<void>;
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
  const [uploadedAssetUrl, setUploadedAssetUrl] = useState<string | null>(null);
  const [uploadedAssetText, setUploadedAssetText] = useState<string | null>(null);
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
    setUploadedAssetUrl(null);
    setUploadedAssetText(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [faqToEdit]);

  const mdeOptions = useMemo(() => ({
    spellChecker: false,
    placeholder: "Descreva a solução com formatação, imagens e links usando Markdown...",
    // CORREÇÃO AQUI: Adicione `as any[]` ao array `toolbar`
    toolbar: [
      "bold", "italic", "heading", "|",
      "quote", "unordered-list", "ordered-list", "|",
      "link", "image", "|",
      "guide"
    ] as any[], // <--- Adicione `as any[]` aqui
    status: false,
  }), []);

  const handleAssetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedAssetFile(e.target.files[0]);
      setUploadedAssetUrl(null);
      setUploadedAssetText(null);
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
      const response = await fetch('/api/upload-asset', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Falha no upload do arquivo.');
      }

      const data = await response.json();
      setUploadedAssetUrl(data.fileUrl);
      setUploadedAssetText(data.extractedText);

      let confirmationMessage = 'Arquivo enviado com sucesso!';
      let textToAppend = '';

      if (data.extractedText) {
        confirmationMessage += ' Documento enviado e texto extraído com sucesso! O documento será anexado a este FAQ.';
        textToAppend = `\n\n[Clique para ver/baixar o documento: ${selectedAssetFile.name}](${data.fileUrl})\n`;
      } else {
        confirmationMessage += ' Imagem enviada com sucesso! URL copiada. Cole a URL no campo Resposta para usar no FAQ.';
        textToAppend = `\n\n![Descrição da Imagem](${data.fileUrl})\n`;
      }

      setSuccessMessage(confirmationMessage);
      setAnswer(prevAnswer => prevAnswer + textToAppend);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Erro desconhecido ao enviar arquivo.";
      setError(`Erro no upload: ${errorMessage}`);
    } finally {
      setIsUploading(false);
      setSelectedAssetFile(null);
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
      const faqDataToSave = {
        question,
        answer,
        category,
        documentUrl: uploadedAssetUrl || undefined,
        documentText: uploadedAssetText || undefined,
      };

      if (faqToEdit) {
        await onSaveEditedFAQ({ ...faqDataToSave, id: faqToEdit.id });
        setSuccessMessage('FAQ atualizado com sucesso!');
      } else {
        await onAddFAQ(faqDataToSave);
        setQuestion('');
        setAnswer('');
        setCategory('');
        setUploadedAssetUrl(null);
        setUploadedAssetText(null);
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
    <div className="bg-white p-4 sm:p-8 rounded-lg shadow-xl container mx-auto max-w-2xl">
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
            className="w-full p-3 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-shadow"
            placeholder="Ex: Como resolvo problemas de conexão Wi-Fi?"
            aria-required="true"
            disabled={isSubmitting || isUploading}
          />
        </div>

        <div>
          <label htmlFor="faq-answer" className="block text-sm font-medium text-slate-700 mb-1">
            Resposta (Solução)
          </label>
          <SimpleMDE
            id="faq-answer"
            value={answer}
            onChange={setAnswer}
            options={mdeOptions}
            className="w-full border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-shadow" /></div>

        <div className="border-t border-slate-200 pt-6 mt-6 space-y-4">
          <h3 className="text-lg font-semibold text-slate-800">Anexar Imagem ou Documento</h3>

          <div className="flex items-center space-x-3">
            <label htmlFor="file-upload-input"
              className="cursor-pointer bg-orange-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ pointerEvents: (isSubmitting || isUploading) ? 'none' : 'auto', opacity: (isSubmitting || isUploading) ? 0.5 : 1 }}
            >
              Escolher ficheiro
            </label>
            <input
              id="file-upload-input"
              type="file"
              accept="image/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              onChange={handleAssetChange}
              ref={fileInputRef}
              className="hidden"
              disabled={isSubmitting || isUploading}
            />
            {selectedAssetFile ? (
              <span className="text-slate-700 text-sm font-medium truncate max-w-[calc(100%-150px)]">
                {selectedAssetFile.name}
              </span>
            ) : (
              <span className="text-slate-500 text-sm">Nenhum ficheiro selecionado</span>
            )}
          </div>

          <button
            type="button"
            onClick={handleAssetUpload}
            className="w-full bg-orange-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 ease-in-out flex items-center justify-center"
            disabled={!selectedAssetFile || isSubmitting || isUploading}
          >
            {isUploading ? <LoadingSpinner size="sm" color="text-white" /> : 'Fazer Upload do Arquivo'}
          </button>

          {uploadedAssetUrl && (
            <p className="text-sm text-orange-600 bg-orange-50 p-3 rounded-md break-all">
              URL do Arquivo: <a href={uploadedAssetUrl} target="_blank" rel="noopener noreferrer" className="underline">{uploadedAssetUrl}</a>
              <br />
              **Sugestão Markdown:** `[Link para o Arquivo](${uploadedAssetUrl})`
            </p>
          )}
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
            className="w-full p-3 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-shadow"
            placeholder="Ex: Conectividade, Software, Hardware"
            aria-required="true"
            disabled={isSubmitting || isUploading}
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
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="w-full sm:w-auto bg-slate-400 text-white font-semibold py-3 px-4 rounded-lg hover:bg-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting || isUploading}
            >
              Cancelar
            </button>
          )}
          <button
            type="submit"
            className="w-full sm:w-auto bg-orange-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isSubmitting || isUploading}
          >
            {isSubmitting ? (faqToEdit ? 'Salvando...' : 'Adicionando...') : (faqToEdit ? 'Salvar Edição' : 'Adicionar FAQ')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ManageFAQsSection;