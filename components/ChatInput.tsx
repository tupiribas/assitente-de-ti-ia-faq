// Em components/ChatInput.tsx

import React, { useState } from 'react';
import { PaperAirplaneIcon } from './Icons';

interface ChatInputProps {
  onSendMessage: (text: string, imageFile?: File | null) => void;
  isLoading: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, isLoading }) => {
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null); // NOVO: Estado para URL de pré-visualização

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((inputText.trim() || selectedImage) && !isLoading) {
      onSendMessage(inputText, selectedImage);
      setInputText('');
      setSelectedImage(null);
      setImagePreviewUrl(null); // Limpa a pré-visualização após envio
      const fileInput = document.getElementById('image-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImage(file);
      setImagePreviewUrl(URL.createObjectURL(file)); // Cria URL para pré-visualização
    } else {
      setSelectedImage(null);
      setImagePreviewUrl(null);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center p-2 border-t border-slate-100 bg-white rounded-b-lg">
      <label htmlFor="image-upload" className="cursor-pointer p-2 rounded-lg hover:bg-slate-100 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-slate-500">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l1.5 1.5.356-.356A4.5 4.5 0 009.557 18h2.292a4.5 4.5 0 004.29-2.203l.111-.133.296-.355A4.5 4.5 0 0021.75 12V8.25m0 0h-3.879a1.125 1.125 0 01-.976-.642L16.3 4.757A1.125 1.125 0 0015.322 4.125H8.773c-.57 0-1.059.387-1.192.924L5.617 7.03c-.392.656-.164 1.447.387 1.776l.128.097H16.5M18 12a2.25 2.25 0 100 4.5 2.25 2.25 0 000-4.5z" />
        </svg>
        <input
          id="image-upload"
          type="file"
          accept="image/*"
          onChange={handleImageChange}
          className="hidden"
          disabled={isLoading}
        />
      </label>

      {/* NOVO: Exibir pré-visualização da imagem e botão para remover */}
      {imagePreviewUrl && (
        <div className="relative mr-2">
          <img src={imagePreviewUrl} alt="Pré-visualização" className="h-16 w-16 object-cover rounded-md border border-slate-200" />
          <button
            type="button"
            onClick={() => { setSelectedImage(null); setImagePreviewUrl(null); if (document.getElementById('image-upload')) (document.getElementById('image-upload') as HTMLInputElement).value = ''; }}
            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full h-5 w-5 flex items-center justify-center text-xs focus:outline-none"
            aria-label="Remover imagem selecionada"
          >
            &times;
          </button>
        </div>
      )}
      {/* Remover o span anterior que só mostrava o nome do arquivo, pois a pré-visualização o substitui. */}
      {/* {selectedImage && (
        <span className="text-sm text-slate-600 mr-2 flex items-center">
          {selectedImage.name}
          <button
            type="button"
            onClick={() => setSelectedImage(null)}
            className="ml-1 text-red-500 hover:text-red-700 focus:outline-none"
            aria-label="Remover imagem selecionada"
          >
            &times;
          </button>
        </span>
      )} */}

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
        disabled={isLoading || (!inputText.trim() && !selectedImage)}
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