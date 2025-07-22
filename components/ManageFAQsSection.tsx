// // assistente-de-ti/components/ManageFAQsSection.tsx
// import React, { useState, useEffect, useRef, useMemo } from 'react';
// import { FAQ, FAQAttachment } from '../types'; // VVVV Importar FAQAttachment VVVV
// import LoadingSpinner from './LoadingSpinner';

// import ReactQuill from 'react-quill';
// import 'react-quill/dist/quill.snow.css';

// interface ManageFAQsSectionProps {
//   onAddFAQ: (newFaqData: Omit<FAQ, 'id'>) => Promise<FAQ>;
//   faqToEdit?: FAQ | null;
//   onSaveEditedFAQ: (updatedFaqData: FAQ) => Promise<void>;
//   onCancel: () => void;
// }

// const ManageFAQsSection: React.FC<ManageFAQsSectionProps> = ({ onAddFAQ, faqToEdit, onSaveEditedFAQ, onCancel }) => {
//   const [question, setQuestion] = useState('');
//   const [answer, setAnswer] = useState('');
//   const [category, setCategory] = useState('');
//   const [error, setError] = useState<string | null>(null);
//   const [successMessage, setSuccessMessage] = useState<string | null>(null);
//   const [isSubmitting, setIsSubmitting] = useState(false);

//   const [selectedAssetFile, setSelectedAssetFile] = useState<File | null>(null); // Apenas para o input de arquivo atual
//   const [isUploading, setIsUploading] = useState(false);
//   const [uploadedAssetText, setUploadedAssetText] = useState<string | null>(null); // Texto extraído para IA

//   // VVVV ALTERAÇÃO CRÍTICA AQUI: Usar um array para os anexos VVVV
//   const [attachments, setAttachments] = useState<FAQAttachment[]>([]);
//   // ^^^^ ALTERAÇÃO CRÍTICA ^^^^

//   const fileInputRef = useRef<HTMLInputElement>(null);

//   useEffect(() => {
//     if (faqToEdit) {
//       setQuestion(faqToEdit.question);
//       setAnswer(faqToEdit.answer);
//       setCategory(faqToEdit.category);
//       setUploadedAssetText(faqToEdit.documentText || null); // Manter para o texto da IA
//       // VVVV NOVO: Carregar 'attachments' existentes (o FAQ agora tem attachments, não documentUrl etc.) VVVV
//       setAttachments(faqToEdit.attachments || []);
//       // ^^^^ NOVO ^^^^
//     } else {
//       setQuestion('');
//       setAnswer('');
//       setCategory('');
//       setUploadedAssetText(null);
//       setAttachments([]); // Limpar ao criar novo FAQ
//     }
//     setError(null);
//     setSuccessMessage(null);
//     setSelectedAssetFile(null); // Limpar arquivo selecionado no input
//     if (fileInputRef.current) {
//       fileInputRef.current.value = '';
//     }
//   }, [faqToEdit]);

//   const mdeOptions = useMemo(() => ({
//     spellChecker: false,
//     placeholder: "Descreva a solução com formatação, imagens e links usando Markdown...",
//     toolbar: [
//       "bold", "italic", "heading", "|",
//       "quote", "unordered-list", "ordered-list", "|",
//       "link", "image", "|",
//       "guide"
//     ] as any[],
//     status: false,
//   }), []);

//   const handleAssetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     if (e.target.files && e.target.files[0]) {
//       setSelectedAssetFile(e.target.files[0]);
//       // Não resetamos attachments aqui, apenas o selectedAssetFile
//     } else {
//       setSelectedAssetFile(null);
//     }
//   };

//   const handleAssetUpload = async () => {
//     if (!selectedAssetFile) {
//       setError('Por favor, selecione um arquivo (imagem ou documento) para fazer o upload.');
//       return;
//     }

//     setIsUploading(true);
//     setError(null);
//     setSuccessMessage(null);

//     const formData = new FormData();
//     formData.append('file', selectedAssetFile);

//     try {
//       const response = await fetch('/api/upload-asset', {
//         method: 'POST',
//         body: formData,
//       });

//       if (!response.ok) {
//         const errorData = await response.json();
//         throw new Error(errorData.message || 'Falha no upload do arquivo.');
//       }

//       const data = await response.json();
//       const newUrl = data.fileUrl;
//       const newExtractedText = data.extractedText;

//       const filename = selectedAssetFile.name;
//       const fileExtension = filename.split('.').pop()?.toUpperCase() || 'ARQ';
//       const fileType: 'image' | 'document' = selectedAssetFile.type.startsWith('image/') ? 'image' : 'document';

//       // VVVV ALTERAÇÃO AQUI: Adicionar o novo anexo ao array de anexos VVVV
//       const newAttachment: FAQAttachment = {
//         url: newUrl,
//         name: filename,
//         extension: fileExtension,
//         type: fileType,
//       };
//       setAttachments(prev => [...prev, newAttachment]);
//       // ^^^^ FIM DA ALTERAÇÃO ^^^^

//       // VVVV ATUALIZAÇÃO: Se for documento, adicione o texto para IA ao campo documentText VVVV
//       if (newExtractedText) {
//         // Acumula o texto de todos os documentos para a IA
//         setUploadedAssetText(prev => (prev ? prev + '\n\n' : '') + `\n<div style="display:none;">\n***Conteúdo do Documento para IA (NÃO EDITE):***\n${newExtractedText}\n***FIM DO CONTEÚDO DO DOCUMENTO PARA IA***\n</div>\n`);
//         setSuccessMessage('Documento enviado e texto extraído com sucesso! Ele será anexado ao FAQ e usado pela IA.');
//       } else {
//         // Se for imagem, podemos sugerir ao usuário que a insira no corpo da resposta
//         setSuccessMessage('Imagem enviada com sucesso! Você pode colá-la na Resposta se desejar: ' + newUrl);
//         // Opcional: Inserir a imagem diretamente no Quill ao fazer upload de imagem.
//         // const editor = quillRef.current.getEditor();
//         // editor.insertEmbed(editor.getSelection().index, 'image', newUrl);
//       }
//       // ^^^^ FIM DA ATUALIZAÇÃO ^^^^

//       // Limpar o input de arquivo e o selectedAssetFile após o upload
//       setSelectedAssetFile(null);
//       if (fileInputRef.current) {
//         fileInputRef.current.value = '';
//       }

//     } catch (err) {
//       const errorMessage = err instanceof Error ? err.message : "Erro desconhecido ao enviar arquivo.";
//       setError(`Erro no upload: ${errorMessage}`);
//     } finally {
//       setIsUploading(false);
//     }
//   };

//   // VVVV NOVO: Função para remover um anexo do array VVVV
//   const handleRemoveAttachment = (urlToRemove: string) => {
//     setAttachments(prev => prev.filter(att => att.url !== urlToRemove));
//     // Opcional: Se o texto da IA for removido aqui, precisaria de uma lógica mais complexa
//     // para remover apenas o texto da IA associado a este documento específico.
//   };
//   // ^^^^ NOVO ^^^^

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
//       // VVVV ALTERAÇÃO AQUI: Salvar o array 'attachments' VVVV
//       const faqDataToSave: Omit<FAQ, 'id'> = {
//         question,
//         answer, // A resposta do Quill (pode ter texto IA oculto ou imagens)
//         category,
//         attachments, // Passa o array completo de anexos
//         documentText: uploadedAssetText || undefined, // Texto da IA (acúmulo de todos os docs)
//       };
//       // ^^^^ FIM DA ALTERAÇÃO ^^^^

//       console.log('Dados do FAQ a serem salvos (frontend):', faqDataToSave);

//       if (faqToEdit) {
//         await onSaveEditedFAQ({ ...faqDataToSave, id: faqToEdit.id });
//         setSuccessMessage('FAQ atualizado com sucesso!');
//       } else {
//         await onAddFAQ(faqDataToSave);
//         setQuestion('');
//         setAnswer('');
//         setCategory('');
//         setUploadedAssetText(null);
//         setAttachments([]); // Limpar anexos após adicionar novo FAQ
//         setSuccessMessage('FAQ adicionado com sucesso!');
//       }
//       setTimeout(() => setSuccessMessage(null), 3000);
//     } catch (err) {
//       const errorMessage = err instanceof Error ? err.message : "Erro desconhecido.";
//       setError(`Falha ao processar FAQ: ${errorMessage}`);
//       setTimeout(() => setError(null), 5000);
//     } finally {
//       setIsSubmitting(false);
//     }
//   };

//   const formTitle = faqToEdit ? `Editar FAQ (ID: ${faqToEdit.id})` : 'Adicionar Novo FAQ';

//   return (
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
//           <ReactQuill
//             theme="snow"
//             value={answer}
//             onChange={setAnswer}
//             modules={{
//               toolbar: [
//                 [{ 'header': [1, 2, false] }],
//                 ['bold', 'italic', 'underline', 'strike', 'blockquote'],
//                 [{ 'list': 'ordered' }, { 'list': 'bullet' }],
//                 ['link', 'image'],
//                 ['clean']
//               ],
//             }}
//             formats={[
//               'header', 'bold', 'italic', 'underline', 'strike', 'blockquote',
//               'list', 'bullet', 'link', 'image'
//             ]}
//             placeholder="Descreva a solução com formatação rica..."
//             readOnly={isSubmitting || isUploading}
//             className="w-full h-48 mb-10"
//           />
//         </div>
//         <div className="border-t border-slate-200 pt-6 mt-6 space-y-4">
//           <h3 className="text-lg font-semibold text-slate-800">Anexar Imagem ou Documento</h3>

//           {/* VVVV NOVO: Lista de anexos existentes VVVV */}
//           {attachments.map((att, index) => (
//             <div key={att.url} className="faq-document-card bg-gray-100 p-3 rounded-lg border border-gray-200 flex items-center space-x-3 my-2 shadow-sm">
//               {att.type === 'document' ? (
//                 <span className="bg-red-500 text-white font-bold px-2 py-1 rounded-md text-xs">{att.extension}</span>
//               ) : (
//                 <img src={att.url} alt="pré-visualização" className="w-8 h-8 object-cover rounded-md" />
//               )}
//               <a href={att.url} target="_blank" rel="noopener noreferrer" className="flex-1 text-blue-700 hover:text-blue-900 focus:outline-none truncate">
//                 {att.name}
//               </a>
//               <button
//                 type="button"
//                 onClick={() => handleRemoveAttachment(att.url)}
//                 className="text-red-500 hover:text-red-700 font-bold ml-2"
//                 title="Remover anexo"
//               >
//                 &times;
//               </button>
//             </div>
//           ))}
//           {/* ^^^^ FIM DA LISTA DE ANEXOS ^^^^ */}

//           {/* Input para adicionar novo anexo (agora sem condição de uploadedAssetUrl) */}
//           <div className="flex items-center space-x-3">
//             <label htmlFor="file-upload-input"
//               className="cursor-pointer bg-orange-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
//               style={{ pointerEvents: (isSubmitting || isUploading) ? 'none' : 'auto', opacity: (isSubmitting || isUploading) ? 0.5 : 1 }}
//             >
//               Escolher ficheiro
//             </label>
//             <input
//               id="file-upload-input"
//               type="file"
//               accept="image/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
//               onChange={handleAssetChange}
//               ref={fileInputRef}
//               className="hidden"
//               disabled={isSubmitting || isUploading}
//             />
//             {selectedAssetFile ? (
//               <span className="text-slate-700 text-sm font-medium truncate max-w-[calc(100%-150px)]">
//                   {selectedAssetFile.name}
//               </span>
//             ) : (
//               <span className="text-slate-500 text-sm">Nenhum ficheiro selecionado</span>
//             )}
//           </div>

//           {/* O botão "Fazer Upload do Arquivo" só aparece se um arquivo estiver selecionado */}
//           {selectedAssetFile && (
//             <button
//               type="button"
//               onClick={handleAssetUpload}
//               className="w-full bg-orange-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 ease-in-out flex items-center justify-center"
//               disabled={isSubmitting || isUploading}
//             >
//               {isUploading ? <LoadingSpinner size="sm" color="text-white" /> : 'Fazer Upload do Arquivo'}
//             </button>
//           )}
//         </div>

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

//         <div className="flex flex-col space-y-3 sm:flex-row sm:space-x-3 sm:space-y-0">
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

//Segunda parte que deu certo com arquivo de imagem.
// import React, { useState, useEffect, useRef, useMemo } from 'react';
// import { FAQ } from '../types';
// import LoadingSpinner from './LoadingSpinner';

// import ReactQuill from 'react-quill';
// import 'react-quill/dist/quill.snow.css';

// interface ManageFAQsSectionProps {
//   onAddFAQ: (newFaqData: Omit<FAQ, 'id'>) => Promise<FAQ>;
//   faqToEdit?: FAQ | null;
//   onSaveEditedFAQ: (updatedFaqData: FAQ) => Promise<void>;
//   onCancel: () => void;
// }

// const PDF_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="inline-block w-5 h-5 align-middle mr-1.5 text-red-600">
//   <path fill-rule="evenodd" d="M19.5 7.5V4.5H4.5A.75.75 0 0 0 3.75 5.25v14.5A.75.75 0 0 0 4.5 20.5h15a.75.75 0 0 0 .75-.75V8.25A.75.75 0 0 0 19.5 7.5ZM13.297 9.75a.75.75 0 0 0-.987-1.125l-3 2.25a.75.75 0 0 0-.174.457v3.393a.75.75 0 0 0 .75.75h2.25a.75.75 0 0 0 .75-.75v-2.25h1.5a.75.75 0 0 0 0-1.5h-1.5Z" clip-rule="evenodd" />
// </svg>`; // SVG de um ícone de PDF para uso inline

// const ManageFAQsSection: React.FC<ManageFAQsSectionProps> = ({ onAddFAQ, faqToEdit, onSaveEditedFAQ, onCancel }) => {
//   const [question, setQuestion] = useState('');
//   const [answer, setAnswer] = useState('');
//   const [category, setCategory] = useState('');
//   const [error, setError] = useState<string | null>(null);
//   const [successMessage, setSuccessMessage] = useState<string | null>(null);
//   const [isSubmitting, setIsSubmitting] = useState(false);

//   const [selectedAssetFile, setSelectedAssetFile] = useState<File | null>(null);
//   const [isUploading, setIsUploading] = useState(false);
//   const [uploadedAssetUrl, setUploadedAssetUrl] = useState<string | null>(null);
//   const [uploadedAssetText, setUploadedAssetText] = useState<string | null>(null);
//   const fileInputRef = useRef<HTMLInputElement>(null);
//   const quillRef = useRef<ReactQuill>(null); // Ref para o ReactQuill

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

//   const mdeOptions = useMemo(() => ({
//     spellChecker: false,
//     placeholder: "Descreva a solução com formatação, imagens e links usando Markdown...",
//     toolbar: [
//       "bold", "italic", "heading", "|",
//       "quote", "unordered-list", "ordered-list", "|",
//       "link", "image", "|",
//       "guide"
//     ] as any[],
//     status: false,
//   }), []);

//   const handleAssetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     if (e.target.files && e.target.files[0]) {
//       setSelectedAssetFile(e.target.files[0]);
//       setUploadedAssetUrl(null);
//       setUploadedAssetText(null);
//     } else {
//       setSelectedAssetFile(null);
//     }
//   };

//   const handleAssetUpload = async () => {
//     if (!selectedAssetFile) {
//       setError('Por favor, selecione um arquivo (imagem ou documento) para fazer o upload.');
//       return;
//     }

//     setIsUploading(true);
//     setError(null);
//     setSuccessMessage(null);

//     const formData = new FormData();
//     formData.append('file', selectedAssetFile);

//     try {
//       const response = await fetch('/api/upload-asset', {
//         method: 'POST',
//         body: formData,
//       });

//       if (!response.ok) {
//         const errorData = await response.json();
//         throw new Error(errorData.message || 'Falha no upload do arquivo.');
//       }

//       const data = await response.json();
//       const fileUrl = data.fileUrl; // URL do arquivo retornado
//       const extractedText = data.extractedText; // Texto extraído do documento

//       setUploadedAssetUrl(fileUrl);
//       setUploadedAssetText(extractedText);

//       if (quillRef.current) {
//         const editor = quillRef.current.getEditor();
//         const range = editor.getSelection();
//         const index = range ? range.index : editor.getLength();

//         if (fileUrl.match(/\.(jpeg|jpg|png|gif|webp|svg)$/i)) { // É uma imagem
//           editor.insertEmbed(index, 'image', fileUrl);
//           editor.setSelection(index + 1);
//           setSuccessMessage('Imagem enviada e inserida no editor!');
//         } else { // É um documento (PDF, DOCX, TXT)
//           const filename = selectedAssetFile.name;
//           // Constrói o HTML para o box do PDF
//           const docHtml = `
//             <p class="quill-document-attachment">
//               <a href="${fileUrl}" target="_blank" rel="noopener noreferrer" class="quill-document-link">
//                 ${PDF_ICON_SVG}
//                 <span class="quill-document-filename">${filename}</span>
//               </a>
//             </p>
//           `;
//           editor.clipboard.dangerouslyPasteHTML(index, docHtml);
//           // O Quill se auto-ajusta ao conteúdo, mas mover o cursor após o parágrafo pode ser útil.
//            editor.setSelection(index + docHtml.length, 0);
//           setSuccessMessage('Arquivo enviado e link inserido no editor!');
//         }
//       } else {
//         // Fallback: Se o Quill ref não estiver disponível (não deve acontecer), adicione ao texto
//         let textToAppend = '';
//         if (extractedText) {
//           textToAppend = `\n\n[Clique para ver/baixar o documento: ${selectedAssetFile.name}](${fileUrl})\n`;
//         } else {
//           textToAppend = `\n\n![Descrição da Imagem](${fileUrl})\n`;
//         }
//         setAnswer(prevAnswer => prevAnswer + textToAppend);
//         setSuccessMessage('Arquivo enviado com sucesso! Insira-o manualmente no editor.');
//       }

//     } catch (err) {
//       const errorMessage = err instanceof Error ? err.message : "Erro desconhecido ao enviar arquivo.";
//       setError(`Erro no upload: ${errorMessage}`);
//     } finally {
//       setIsUploading(false);
//       setSelectedAssetFile(null);
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
//       const faqDataToSave = {
//         question,
//         answer,
//         category,
//         documentUrl: uploadedAssetUrl || undefined,
//         documentText: uploadedAssetText || undefined,
//       };

//       if (faqToEdit) {
//         await onSaveEditedFAQ({ ...faqDataToSave, id: faqToEdit.id });
//         setSuccessMessage('FAQ atualizado com sucesso!');
//       } else {
//         await onAddFAQ(faqDataToSave);
//         setQuestion('');
//         setAnswer('');
//         setCategory('');
//         setUploadedAssetUrl(null);
//         setUploadedAssetText(null);
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
//           <ReactQuill
//             ref={quillRef}
//             theme="snow"
//             value={answer}
//             onChange={setAnswer}
//             modules={{
//               toolbar: [
//                 [{ 'header': [1, 2, false] }],
//                 ['bold', 'italic', 'underline', 'strike', 'blockquote'],
//                 [{ 'list': 'ordered' }, { 'list': 'bullet' }],
//                 ['link', 'image'],
//                 ['clean']
//               ],
//             }}
//             formats={[
//               'header', 'bold', 'italic', 'underline', 'strike', 'blockquote',
//               'list', 'bullet', 'link', 'image'
//             ]}
//             placeholder="Descreva a solução com formatação rica..."
//             readOnly={isSubmitting || isUploading}
//             className="w-full h-48 mb-10"
//           />
//         </div>
//         <div className="border-t border-slate-200 pt-6 mt-6 space-y-4">
//           <h3 className="text-lg font-semibold text-slate-800">Anexar Imagem ou Documento</h3>

//           <div className="flex items-center space-x-3">
//             <label htmlFor="file-upload-input"
//               className="cursor-pointer bg-orange-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
//               style={{ pointerEvents: (isSubmitting || isUploading) ? 'none' : 'auto', opacity: (isSubmitting || isUploading) ? 0.5 : 1 }}
//             >
//               Escolher ficheiro
//             </label>
//             <input
//               id="file-upload-input"
//               type="file"
//               accept="image/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
//               onChange={handleAssetChange}
//               ref={fileInputRef}
//               className="hidden"
//               disabled={isSubmitting || isUploading}
//             />
//             {selectedAssetFile ? (
//               <span className="text-slate-700 text-sm font-medium truncate max-w-[calc(100%-150px)]">
//                 {selectedAssetFile.name}
//               </span>
//             ) : (
//               <span className="text-slate-500 text-sm">Nenhum ficheiro selecionado</span>
//             )}
//           </div>

//           <button
//             type="button"
//             onClick={handleAssetUpload}
//             className="w-full bg-orange-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 ease-in-out flex items-center justify-center"
//             disabled={!selectedAssetFile || isSubmitting || isUploading}
//           >
//             {isUploading ? <LoadingSpinner size="sm" color="text-white" /> : 'Fazer Upload do Arquivo'}
//           </button>

//           {uploadedAssetUrl && (
//             <p className="text-sm text-orange-600 bg-orange-50 p-3 rounded-md break-all">
//               URL do Arquivo: <a href={uploadedAssetUrl} target="_blank" rel="noopener noreferrer" className="underline">{uploadedAssetUrl}</a>
//               <br />
//               **Sugestão Markdown:** `[Link para o Arquivo](${uploadedAssetUrl})`
//             </p>
//           )}
//         </div>

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

//         <div className="flex flex-col space-y-3 sm:flex-row sm:space-x-3 sm:space-y-0">
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






// import React, { useState, useEffect, useRef, useMemo } from 'react';
// import { FAQ, FAQAttachment } from '../types';
// import LoadingSpinner from './LoadingSpinner';

// import ReactQuill from 'react-quill';
// import 'react-quill/dist/quill.snow.css';

// interface ManageFAQsSectionProps {
//   onAddFAQ: (newFaqData: Omit<FAQ, 'id'>) => Promise<FAQ>;
//   faqToEdit?: FAQ | null;
//   onSaveEditedFAQ: (updatedFaqData: FAQ) => Promise<void>;
//   onCancel: () => void;
// }

// const ManageFAQsSection: React.FC<ManageFAQsSectionProps> = ({ onAddFAQ, faqToEdit, onSaveEditedFAQ, onCancel }) => {
//   const [question, setQuestion] = useState('');
//   const [answer, setAnswer] = useState('');
//   const [category, setCategory] = useState('');
//   const [error, setError] = useState<string | null>(null);
//   const [successMessage, setSuccessMessage] = useState<string | null>(null);
//   const [isSubmitting, setIsSubmitting] = useState(false);

//   const [selectedAssetFile, setSelectedAssetFile] = useState<File | null>(null);
//   const [isUploading, setIsUploading] = useState(false);
//   const [uploadedAssetText, setUploadedAssetText] = useState<string | null>(null); // Texto extraído para IA (apenas para documentos)

//   // O array attachments agora armazenará APENAS anexos do tipo 'document' (PDF, DOCX, TXT)
//   const [attachments, setAttachments] = useState<FAQAttachment[]>([]);

//   const fileInputRef = useRef<HTMLInputElement>(null);
//   const quillRef = useRef<ReactQuill>(null); // Ref para o ReactQuill (essencial para inserir imagens)

//   useEffect(() => {
//     if (faqToEdit) {
//       setQuestion(faqToEdit.question);
//       setAnswer(faqToEdit.answer);
//       setCategory(faqToEdit.category);
//       setUploadedAssetText(faqToEdit.documentText || null);

//       // NOVO: Filtra os anexos para carregar apenas documentos
//       setAttachments(faqToEdit.attachments?.filter(att => att.type === 'document') || []);
//     } else {
//       setQuestion('');
//       setAnswer('');
//       setCategory('');
//       setUploadedAssetText(null);
//       setAttachments([]); // Limpar ao criar novo FAQ
//     }
//     setError(null);
//     setSuccessMessage(null);
//     setSelectedAssetFile(null);
//     if (fileInputRef.current) {
//       fileInputRef.current.value = '';
//     }
//   }, [faqToEdit]);

//   const mdeOptions = useMemo(() => ({
//     spellChecker: false,
//     placeholder: "Descreva a solução com formatação, imagens e links...",
//     toolbar: [
//       [{ 'header': [1, 2, false] }],
//       ['bold', 'italic', 'underline', 'strike', 'blockquote'],
//       [{ 'list': 'ordered' }, { 'list': 'bullet' }],
//       ['link', 'image'],
//       ['clean']
//     ],
//   }), []);

//   const handleAssetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     if (e.target.files && e.target.files[0]) {
//       setSelectedAssetFile(e.target.files[0]);
//     } else {
//       setSelectedAssetFile(null);
//     }
//   };

//   const handleAssetUpload = async () => {
//     if (!selectedAssetFile) {
//       setError('Por favor, selecione um arquivo (imagem ou documento) para fazer o upload.');
//       return;
//     }

//     setIsUploading(true);
//     setError(null);
//     setSuccessMessage(null);

//     const formData = new FormData();
//     formData.append('file', selectedAssetFile);

//     try {
//       const response = await fetch('/api/upload-asset', {
//         method: 'POST',
//         body: formData,
//       });

//       if (!response.ok) {
//         const errorData = await response.json();
//         throw new Error(errorData.message || 'Falha no upload do arquivo.');
//       }

//       const data = await response.json();
//       const newUrl = data.fileUrl;
//       const newExtractedText = data.extractedText;

//       const filename = selectedAssetFile.name;
//       const fileType: 'image' | 'document' = selectedAssetFile.type.startsWith('image/') ? 'image' : 'document';

//       if (fileType === 'image') {
//         // VVVV PARA IMAGENS: Insere diretamente no editor VVVV
//         if (quillRef.current) {
//           const editor = quillRef.current.getEditor();
//           const range = editor.getSelection();
//           const index = range ? range.index : editor.getLength();
//           editor.insertEmbed(index, 'image', newUrl); // Insere a imagem inline
//           editor.setSelection(index + 1); // Move o cursor após a imagem
//           setSuccessMessage('Imagem enviada e inserida no corpo da resposta!');
//         } else {
//           // Fallback se Quill ref não estiver disponível
//           setAnswer(prevAnswer => prevAnswer + `<p><img src="${newUrl}" alt="${filename}"/></p>`);
//           setSuccessMessage('Imagem enviada com sucesso! Insira-a manualmente no editor.');
//         }
//       } else { // É um documento (PDF, DOCX, TXT)
//         // VVVV PARA DOCUMENTOS: Adiciona ao array de attachments VVVV
//         const newAttachment: FAQAttachment = {
//           url: newUrl,
//           name: filename,
//           extension: filename.split('.').pop()?.toUpperCase() || 'ARQ', // Garante a extensão
//           type: fileType,
//         };
//         setAttachments(prev => [...prev, newAttachment]); // Adiciona ao array de anexos

//         if (newExtractedText) {
//           // Acumula o texto extraído para a IA (oculto na visualização normal)
//           setUploadedAssetText(prev => (prev ? prev + '\n\n' : '') + `\n<div style="display:none;">\n***Conteúdo do Documento para IA (NÃO EDITE):***\n${newExtractedText}\n***FIM DO CONTEÚDO DO DOCUMENTO PARA IA***\n</div>\n`);
//           setSuccessMessage('Documento enviado e texto extraído com sucesso! Ele será anexado ao FAQ e usado pela IA.');
//         } else {
//           setSuccessMessage('Documento enviado com sucesso! Ele será anexado ao FAQ.');
//         }
//       }

//       // Limpar o input de arquivo e o selectedAssetFile após o upload (comum para ambos os tipos)
//       setSelectedAssetFile(null);
//       if (fileInputRef.current) {
//         fileInputRef.current.value = '';
//       }

//     } catch (err) {
//       const errorMessage = err instanceof Error ? err.message : "Erro desconhecido ao enviar arquivo.";
//       setError(`Erro no upload: ${errorMessage}`);
//     } finally {
//       setIsUploading(false);
//     }
//   };

//   // Função para remover um anexo do array (apenas para documentos)
//   const handleRemoveAttachment = (urlToRemove: string) => {
//     setAttachments(prev => prev.filter(att => att.url !== urlToRemove));
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
//       const faqDataToSave: Omit<FAQ, 'id'> = {
//         question,
//         answer, // O conteúdo do editor (agora com imagens inline, sem links de documentos)
//         category,
//         attachments, // Passa APENAS os anexos do tipo 'document' aqui
//         documentText: uploadedAssetText || undefined, // Texto da IA (acumulado de documentos)
//       };

//       console.log('Dados do FAQ a serem salvos (frontend):', faqDataToSave);

//       if (faqToEdit) {
//         await onSaveEditedFAQ({ ...faqDataToSave, id: faqToEdit.id });
//         setSuccessMessage('FAQ atualizado com sucesso!');
//       } else {
//         await onAddFAQ(faqDataToSave);
//         setQuestion('');
//         setAnswer('');
//         setCategory('');
//         setUploadedAssetText(null);
//         setAttachments([]); // Limpar anexos após adicionar novo FAQ
//         setSuccessMessage('FAQ adicionado com sucesso!');
//       }
//       setTimeout(() => setSuccessMessage(null), 3000);
//     } catch (err) {
//       const errorMessage = err instanceof Error ? err.message : "Erro desconhecido.";
//       setError(`Falha ao processar FAQ: ${errorMessage}`);
//       setTimeout(() => setError(null), 5000);
//     } finally {
//       setIsSubmitting(false);
//     }
//   };

//   const formTitle = faqToEdit ? `Editar FAQ (ID: ${faqToEdit.id})` : 'Adicionar Novo FAQ';

//   return (
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
//           <ReactQuill
//             ref={quillRef} // Ref para o ReactQuill
//             theme="snow"
//             value={answer}
//             onChange={setAnswer}
//             modules={{
//               toolbar: [
//                 [{ 'header': [1, 2, false] }],
//                 ['bold', 'italic', 'underline', 'strike', 'blockquote'],
//                 [{ 'list': 'ordered' }, { 'list': 'bullet' }],
//                 ['link', 'image'], // Mantém o botão de imagem do editor para inserir imagens do PC
//                 ['clean']
//               ],
//             }}
//             formats={[
//               'header', 'bold', 'italic', 'underline', 'strike', 'blockquote',
//               'list', 'bullet', 'link', 'image'
//             ]}
//             placeholder="Descreva a solução com formatação rica..."
//             readOnly={isSubmitting || isUploading}
//             className="w-full h-48 mb-10"
//           />
//         </div>
//         <div className="border-t border-slate-200 pt-6 mt-6 space-y-4">
//           <h3 className="text-lg font-semibold text-slate-800">Anexar Imagem ou Documento</h3>

//           {/* NOVO: Lista de anexos do tipo 'document' existentes (PDFs, DOCX, TXT) */}
//           {attachments.map((att) => (
//             <div key={att.url} className="faq-document-card bg-gray-100 p-3 rounded-lg border border-gray-200 flex items-center space-x-3 my-2 shadow-sm">
//               {/* Ícone de extensão para documentos */}
//               <span className="bg-red-500 text-white font-bold px-2 py-1 rounded-md text-xs flex-shrink-0">
//                 {att.extension}
//               </span>
//               <a href={att.url} target="_blank" rel="noopener noreferrer" className="flex-1 text-blue-700 hover:text-blue-900 focus:outline-none truncate">
//                 {att.name}
//               </a>
//               <button
//                 type="button"
//                 onClick={() => handleRemoveAttachment(att.url)}
//                 className="text-red-500 hover:text-red-700 font-bold ml-2"
//                 title="Remover anexo"
//               >
//                 &times;
//               </button>
//             </div>
//           ))}

//           <div className="flex items-center space-x-3">
//             <label htmlFor="file-upload-input"
//               className="cursor-pointer bg-orange-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
//               style={{ pointerEvents: (isSubmitting || isUploading) ? 'none' : 'auto', opacity: (isSubmitting || isUploading) ? 0.5 : 1 }}
//             >
//               Escolher ficheiro
//             </label>
//             <input
//               id="file-upload-input"
//               type="file"
//               // Permite todos os tipos suportados, a lógica de separação é no JS
//               accept="image/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
//               onChange={handleAssetChange}
//               ref={fileInputRef}
//               className="hidden"
//               disabled={isSubmitting || isUploading}
//             />
//             {selectedAssetFile ? (
//               <span className="text-slate-700 text-sm font-medium truncate max-w-[calc(100%-150px)]">
//                 {selectedAssetFile.name}
//               </span>
//             ) : (
//               <span className="text-slate-500 text-sm">Nenhum ficheiro selecionado</span>
//             )}
//           </div>

//           {selectedAssetFile && ( // Botão de upload só aparece se arquivo selecionado
//             <button
//               type="button"
//               onClick={handleAssetUpload}
//               className="w-full bg-orange-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 ease-in-out flex items-center justify-center"
//               disabled={isSubmitting || isUploading}
//             >
//               {isUploading ? <LoadingSpinner size="sm" color="text-white" /> : 'Fazer Upload do Arquivo'}
//             </button>
//           )}
//         </div>

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

//         <div className="flex flex-col space-y-3 sm:flex-row sm:space-x-3 sm:space-y-0">
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










import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FAQ, FAQAttachment } from '../types';
import LoadingSpinner from './LoadingSpinner';

import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

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
  const [uploadedAssetText, setUploadedAssetText] = useState<string | null>(null);

  const [attachments, setAttachments] = useState<FAQAttachment[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const quillRef = useRef<ReactQuill>(null);

  const isInitialLoadRef = useRef(true);
  const prevFaqIdRef = useRef<string | null>(null);


  useEffect(() => {
    if (faqToEdit) {
      setQuestion(faqToEdit.question);
      setAnswer(faqToEdit.answer);
      setCategory(faqToEdit.category);
      setUploadedAssetText(faqToEdit.documentText || null);

      if (faqToEdit.id !== prevFaqIdRef.current || isInitialLoadRef.current) {
        setAttachments(faqToEdit.attachments?.filter(att => att.type === 'document') || []);
        prevFaqIdRef.current = faqToEdit.id;
        isInitialLoadRef.current = false;
      }

    } else { // Criando novo FAQ
      setQuestion('');
      setAnswer('');
      setCategory('');
      setUploadedAssetText(null);
      setAttachments([]);
      prevFaqIdRef.current = null;
      isInitialLoadRef.current = true;
    }
    setError(null);
    setSuccessMessage(null);
    setSelectedAssetFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [faqToEdit]);

  const mdeOptions = useMemo(() => ({
    spellChecker: false,
    placeholder: "Descreva a solução com formatação, imagens e links...",
    toolbar: [
      [{ 'header': [1, 2, false] }],
      ['bold', 'italic', 'underline', 'strike', 'blockquote'],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      ['link', 'image'],
      ['clean']
    ],
  }), []);

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
      const response = await fetch('/api/upload-asset', {
        method: 'POST',
        body: formData,
      });

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
          editor.setSelection(index + 1, 0); // Correção do TypeScript
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
      // O ID já está sendo adicionado ao formData se faqToEdit.id existir
      if (faqToEdit?.id) {
        formData.append('id', faqToEdit.id);
      }
      formData.append('question', question);
      formData.append('answer', answer);
      formData.append('category', category);
      formData.append('documentText', uploadedAssetText || '');
      formData.append('_attachmentsData', JSON.stringify(attachments)); // Campo para forçar o envio

      console.log('Dados do FAQ a serem salvos (frontend - FormData):', Object.fromEntries(formData.entries()));

      if (faqToEdit) { // Se for modo de edição
        // VVVV CORREÇÃO AQUI: Passar o ID do FAQ como segundo argumento VVVV
        await onSaveEditedFAQ(formData as any, faqToEdit.id); // 'faqToEdit.id' é o ID do FAQ existente
        // ^^^^ FIM DA CORREÇÃO ^^^^
        setSuccessMessage('FAQ atualizado com sucesso!');
      } else { // Se for modo de criação
        await onAddFAQ(formData as any);
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
          <ReactQuill
            ref={quillRef}
            theme="snow"
            value={answer}
            onChange={setAnswer}
            modules={{
              toolbar: [
                [{ 'header': [1, 2, false] }],
                ['bold', 'italic', 'underline', 'strike', 'blockquote'],
                [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                ['link', 'image'],
                ['clean']
              ],
            }}
            formats={[
              'header', 'bold', 'italic', 'underline', 'strike', 'blockquote',
              'list', 'bullet', 'link', 'image'
            ]}
            placeholder="Descreva a solução com formatação rica..."
            readOnly={isSubmitting || isUploading}
            className="w-full h-48 mb-10"
          />
        </div>
        <div className="border-t border-slate-200 pt-6 mt-6 space-y-4">
          <h3 className="text-lg font-semibold text-slate-800">Anexar Imagem ou Documento</h3>

          {/* Lista de anexos do tipo 'document' existentes (PDFs, DOCX, TXT) */}
          {attachments.map((att) => (
            <div key={att.url} className="faq-document-card bg-gray-100 p-3 rounded-lg border border-gray-200 flex items-center space-x-3 my-2 shadow-sm">
              <span className="bg-red-500 text-white font-bold px-2 py-1 rounded-md text-xs flex-shrink-0">
                {att.extension}
              </span>
              <a href={att.url} target="_blank" rel="noopener noreferrer" className="flex-1 text-blue-700 hover:text-blue-900 focus:outline-none truncate">
                {att.name}
              </a>
              <button
                type="button"
                onClick={() => handleRemoveAttachment(att.url)}
                className="text-red-500 hover:text-red-700 font-bold ml-2"
                title="Remover anexo"
              >
                &times;
              </button>
            </div>
          ))}

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

          {selectedAssetFile && (
            <button
              type="button"
              onClick={handleAssetUpload}
              className="w-full bg-orange-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 ease-in-out flex items-center justify-center"
              disabled={isSubmitting || isUploading}
            >
              {isUploading ? <LoadingSpinner size="sm" color="text-white" /> : 'Fazer Upload do Arquivo'}
            </button>
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