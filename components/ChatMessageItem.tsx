import React from 'react';
import { ChatMessage } from '../types';
import { UserCircleIcon, CpuChipIcon } from './Icons';
import ReactMarkdown from 'react-markdown';
import { LinkRenderer } from './utils/markdownRenderers';
import DOMPurify from 'dompurify';
import remarkGfm from 'remark-gfm';

interface ChatMessageItemProps {
  message: ChatMessage;
}

// SVG do ícone de PDF (reutilizado do FAQItem.tsx para consistência visual)
const PDF_ICON_SVG_ITEM = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="inline-block w-5 h-5 align-middle mr-1.5 text-red-600">
  <path fill-rule="evenodd" d="M19.5 7.5V4.5H4.5A.75.75 0 0 0 3.75 5.25v14.5A.75.75 0 0 0 4.5 20.5h15a.75.75 0 0 0 .75-.75V8.25A.75.75 0 0 0 19.5 7.5ZM13.297 9.75a.75.75 0 0 0-.987-1.125l-3 2.25a.75.75 0 0 0-.174.457v3.393a.75.75 0 0 0 .75.75h2.25a.75.75 0 0 0 .75-.75v-2.25h1.5a.75.75 0 0 0 0-1.5h-1.5Z" clip-rule="evenodd" />
</svg>`;

// SVG do ícone de documento genérico (para .docx, .txt, etc.)
const DOCUMENT_ICON_SVG_ITEM = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="inline-block w-5 h-5 align-middle mr-1.5 text-slate-600">
  <path fillRule="evenodd" d="M11.54 22.351l.07.035c.104.052.215.087.33.103.015.004.03.007.045.008a.75.75 0 00.352-.004l.05-.02.017-.008.002-.001a.75.75 0 00.1-.043c.095-.06.183-.127.265-.205L19.5 15.25V9.25L10.25 2.25H5.25A2.25 2.25 0 003 4.5v15.75A2.25 2.25 0 005.25 22.5h6.29Z" clipRule="evenodd" />
  <path fillRule="evenodd" d="M12.25 15.25V5.5h4.167L12.25 2.25v13Z" clipRule="evenodd" />
</svg>`;


const ChatMessageItem: React.FC<ChatMessageItemProps> = ({ message }) => {
  const isUser = message.sender === 'user';

  const renderMessageContent = (messageText: string) => {
    const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(messageText);

    if (looksLikeHtml) {
      const cleanHtml = DOMPurify.sanitize(messageText, {
        USE_PROFILES: { html: true },
        ADD_ATTR: ['target', 'rel', 'download']
      });
      return <div dangerouslySetInnerHTML={{ __html: cleanHtml }} />;
    } else {
      return <ReactMarkdown components={{ a: LinkRenderer }} remarkPlugins={[remarkGfm]}>{messageText}</ReactMarkdown>;
    }
  };

  // NOVO: Lógica para renderizar previews de arquivos
  const renderFilePreview = (fileUrl: string) => {
    if (!fileUrl) return null;

    const fileExtension = fileUrl.split('.').pop()?.toLowerCase();
    const fileName = fileUrl.split('/').pop();
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(fileExtension || '');
    const isPdf = fileExtension === 'pdf';
    const isVideo = ['mp4', 'webm', 'ogg'].includes(fileExtension || ''); // Incluindo para futura referência, embora removidos do upload

    if (isImage) {
      return (
        <div className="mb-2 max-w-full overflow-hidden rounded-md border border-slate-200">
          <img src={fileUrl} alt="Pré-visualização da imagem" className="max-w-full h-auto object-contain" />
        </div>
      );
    } else if (isPdf || isVideo) { // Para PDF e Vídeo
      return (
        <div className="mb-2 max-w-full rounded-md border border-slate-200 bg-white p-2 flex items-center space-x-2">
          <span dangerouslySetInnerHTML={{ __html: isPdf ? PDF_ICON_SVG_ITEM : DOCUMENT_ICON_SVG_ITEM }} /> {/* Usar DOCUMENT_ICON_SVG_ITEM para vídeo por enquanto */}
          <a href={fileUrl} target="_blank" rel="noopener noreferrer" download className="text-blue-600 hover:underline flex-1 truncate">
            {fileName}
          </a>
        </div>
      );
    } else { // Para outros tipos de documentos (docx, txt)
      return (
        <div className="mb-2 max-w-full rounded-md border border-slate-200 bg-white p-2 flex items-center space-x-2">
          <span dangerouslySetInnerHTML={{ __html: DOCUMENT_ICON_SVG_ITEM }} />
          <a href={fileUrl} target="_blank" rel="noopener noreferrer" download className="text-blue-600 hover:underline flex-1 truncate">
            {fileName}
          </a>
        </div>
      );
    }
  };


  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`flex items-end max-w-xs md:max-w-md lg:max-w-lg ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {isUser ? (
          <UserCircleIcon className={`w-8 h-8 rounded-full ${isUser ? 'ml-2 text-orange-500' : 'mr-2 text-slate-500'}`} />
        ) : (
          <CpuChipIcon className={`w-8 h-8 rounded-full ${isUser ? 'ml-2 text-orange-500' : 'mr-2 text-slate-500'}`} />
        )}
        <div
          className={`px-4 py-3 rounded-xl shadow ${isUser ? 'bg-orange-500 text-white rounded-br-none' : 'bg-slate-200 text-slate-800 rounded-bl-none'
            }`}
        >
          {/* Usar a nova função de renderização de preview */}
          {renderFilePreview(message.imagePreviewUrl)}

          <div className="prose prose-sm max-w-none text-sm">
            {renderMessageContent(message.text)}
          </div>
          <p className={`text-xs mt-1 ${isUser ? 'text-orange-200 text-right' : 'text-slate-500 text-left'}`}>
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ChatMessageItem;