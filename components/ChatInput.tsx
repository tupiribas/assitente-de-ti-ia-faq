// Em components/ChatInput.tsx

import React, { useState } from 'react';
import { PaperAirplaneIcon, PaperclipIcon } from './Icons'; // Certifique-se que PaperclipIcon está importado

interface ChatInputProps {
  onSendMessage: (text: string, imageFile?: File | null) => void;
  isLoading: boolean;
}

// SVG do ícone de PDF (reutilizado para consistência)
const PDF_ICON_SVG_ITEM = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="inline-block w-5 h-5 align-middle mr-1.5 text-red-600">
  <path fill-rule="evenodd" d="M19.5 7.5V4.5H4.5A.75.75 0 0 0 3.75 5.25v14.5A.75.75 0 0 0 4.5 20.5h15a.75.75 0 0 0 .75-.75V8.25A.75.75 0 0 0 19.5 7.5ZM13.297 9.75a.75.75 0 0 0-.987-1.125l-3 2.25a.75.75 0 0 0-.174.457v3.393a.75.75 0 0 0 .75.75h2.25a.75.75 0 0 0 .75-.75v-2.25h1.5a.75.75 0 0 0 0-1.5h-1.5Z" clip-rule="evenodd" />
</svg>`;

// SVG do ícone de documento genérico (reutilizado para consistência)
const DOCUMENT_ICON_SVG_ITEM = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="inline-block w-5 h-5 align-middle mr-1.5 text-slate-600">
  <path fillRule="evenodd" d="M11.54 22.351l.07.035c.104.052.215.087.33.103.015.004.03.007.045.008a.75.75 0 00.352-.004l.05-.02.017-.008.002-.001a.75.75 0 00.1-.043c.095-.06.183-.127.265-.205L19.5 15.25V9.25L10.25 2.25H5.25A2.25 2.25 0 003 4.5v15.75A2.25 2.25 0 005.25 22.5h6.29Z" clipRule="evenodd" />
  <path fillRule="evenodd" d="M12.25 15.25V5.5h4.167L12.25 2.25v13Z" clipRule="evenodd" />
</svg>`;


const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, isLoading }) => {
  const [inputText, setInputText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((inputText.trim() || selectedFile) && !isLoading) {
      onSendMessage(inputText, selectedFile);
      setInputText('');
      setSelectedFile(null);
      setFilePreviewUrl(null);
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setFilePreviewUrl(URL.createObjectURL(file));
    } else {
      setSelectedFile(null);
      setFilePreviewUrl(null);
    }
  };

  const handleRemoveFileBeforeSend = async () => {
    if (!filePreviewUrl || !selectedFile) return;

    const filename = selectedFile.name;
    const uploadedFilenameMatch = filePreviewUrl.match(/\/uploads\/(.+)$/);
    const filenameOnServer = uploadedFilenameMatch ? uploadedFilenameMatch[1] : null;

    if (!filenameOnServer) {
      console.warn("Não foi possível determinar o nome do arquivo no servidor para exclusão.");
      setSelectedFile(null);
      setFilePreviewUrl(null);
      return;
    }

    try {
      const response = await fetch(`/api/uploads/${filenameOnServer}`, { method: 'DELETE' });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        console.error(`Falha ao remover arquivo ${filenameOnServer} do servidor: ${errorData.message}`);
      } else {
        console.log(`Arquivo ${filenameOnServer} removido com sucesso do servidor.`);
      }
    } catch (err) {
      console.error(`Erro ao tentar remover arquivo ${filenameOnServer}:`, err);
    } finally {
      setSelectedFile(null);
      setFilePreviewUrl(null);
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    }
  };


  return (
    <form onSubmit={handleSubmit} className="flex items-center p-2 border-t border-slate-100 bg-white rounded-b-lg">
      <label htmlFor="file-upload" className="cursor-pointer p-2 rounded-lg hover:bg-slate-100 transition-colors">
        <PaperclipIcon className="w-6 h-6 text-slate-500" />
        <input
          id="file-upload"
          type="file"
          accept="image/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          onChange={handleFileChange}
          className="hidden"
          disabled={isLoading}
        />
      </label>

      {filePreviewUrl && (
        <div className="relative mr-2 flex items-center p-1 border border-slate-200 rounded-md bg-slate-50">
          {selectedFile?.type.startsWith('image/') ? (
            <img src={filePreviewUrl} alt="Pré-visualização" className="h-10 w-10 object-cover rounded-sm" />
          ) : (
            // NOVO: Exibir ícone de PDF ou Documento Genérico para o preview no input
            <div className="h-10 w-10 flex items-center justify-center rounded-sm font-bold text-xs">
              {selectedFile?.type === 'application/pdf' ? (
                <span dangerouslySetInnerHTML={{ __html: PDF_ICON_SVG_ITEM }} />
              ) : (
                <span dangerouslySetInnerHTML={{ __html: DOCUMENT_ICON_SVG_ITEM }} />
              )}
            </div>
          )}
          <span className="ml-2 text-sm text-slate-700 truncate max-w-[120px]">{selectedFile?.name}</span>
          <button
            type="button"
            onClick={handleRemoveFileBeforeSend}
            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full h-5 w-5 flex items-center justify-center text-xs focus:outline-none"
            aria-label="Remover arquivo selecionado"
          >
            &times;
          </button>
        </div>
      )}

      <textarea
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
          }
        }}
        placeholder="Digite sua pergunta aqui..."
        className="flex-grow p-3 border border-slate-200 rounded-lg shadow-inner focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 mr-2 min-h-[44px] max-h-[120px] resize-none"
        rows={1}
        disabled={isLoading}
      />
      <button
        type="submit"
        disabled={isLoading || (!inputText.trim() && !selectedFile)}
        className="bg-orange-600 text-white p-3 rounded-lg hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? (
          <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : (
          <PaperAirplaneIcon className="w-5 h-5" />
        )}
      </button>
    </form>
  );
};

export default ChatInput;