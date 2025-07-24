import React, { useState } from 'react';
import { PaperAirplaneIcon, PaperclipIcon } from './Icons'; // Certifique-se que PaperclipIcon está importado

interface ChatInputProps {
  onSendMessage: (text: string, imageFile?: File | null) => void;
  isLoading: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, isLoading }) => {
  const [inputText, setInputText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => { // Tornar handleSubmit async
    e.preventDefault();
    if ((inputText.trim() || selectedFile) && !isLoading) {
      onSendMessage(inputText, selectedFile); // Passa selectedFile
      setInputText('');
      setSelectedFile(null);
      setFilePreviewUrl(null); // Limpa a pré-visualização após envio
      const fileInput = document.getElementById('file-upload') as HTMLInputElement; // ID atualizado
      if (fileInput) fileInput.value = '';
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      // Cria URL para pré-visualização, independentemente do tipo de arquivo
      setFilePreviewUrl(URL.createObjectURL(file));
    } else {
      setSelectedFile(null);
      setFilePreviewUrl(null);
    }
  };

  // Função para remover o arquivo do servidor antes de enviar a mensagem do chat
  const handleRemoveFileBeforeSend = async () => {
    if (!filePreviewUrl || !selectedFile) return;

    const filename = selectedFile.name; // Usamos o nome original do arquivo ou o nome do servidor se já tivermos
    const fileUrlToDelete = filePreviewUrl; // A URL de preview pode ser a base para a URL real

    // Extrai o nome real do arquivo se a URL for do tipo /uploads/nome-do-arquivo
    const uploadedFilenameMatch = filePreviewUrl.match(/\/uploads\/(.+)$/);
    const filenameOnServer = uploadedFilenameMatch ? uploadedFilenameMatch[1] : null;

    if (!filenameOnServer) {
      console.warn("Não foi possível determinar o nome do arquivo no servidor para exclusão.");
      setSelectedFile(null);
      setFilePreviewUrl(null);
      return;
    }

    try {
      // Envia a requisição DELETE para o servidor
      const response = await fetch(`/api/uploads/${filenameOnServer}`, { method: 'DELETE' });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        console.error(`Falha ao remover arquivo ${filenameOnServer} do servidor: ${errorData.message}`);
        // Mesmo se falhar no servidor, remove do frontend para a UX
      } else {
        console.log(`Arquivo ${filenameOnServer} removido com sucesso do servidor.`);
      }
    } catch (err) {
      console.error(`Erro ao tentar remover arquivo ${filenameOnServer}:`, err);
    } finally {
      // Sempre limpa o estado do frontend, independentemente do sucesso do DELETE
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
          id="file-upload" // ID atualizado
          type="file"
          // MODIFICADO: Removemos 'video/*' para não permitir vídeos
          accept="image/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          onChange={handleFileChange} // Chama handleFileChange
          className="hidden"
          disabled={isLoading}
        />
      </label>

      {/* Exibir pré-visualização do arquivo e botão para remover */}
      {filePreviewUrl && (
        <div className="relative mr-2 flex items-center p-1 border border-slate-200 rounded-md bg-slate-50">
          {selectedFile?.type.startsWith('image/') ? (
            <img src={filePreviewUrl} alt="Pré-visualização" className="h-10 w-10 object-cover rounded-sm" />
          ) : (
            // Ícone genérico para não-imagens (PDF, Doc, TXT, Vídeo)
            <div className="h-10 w-10 flex items-center justify-center bg-blue-100 text-blue-700 rounded-sm font-bold text-xs">
              {/* MODIFICADO: Não mostrar 'VID' para vídeos, pois não são permitidos */}
              {selectedFile?.name.split('.').pop()?.toUpperCase() || 'FILE'}
            </div>
          )}
          <span className="ml-2 text-sm text-slate-700 truncate max-w-[120px]">{selectedFile?.name}</span>
          <button
            type="button"
            onClick={handleRemoveFileBeforeSend} // Chama a nova função de remoção
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