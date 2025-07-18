import React from 'react';
import { ChatMessage } from '../types';
import { UserCircleIcon, CpuChipIcon } from './Icons';
import ReactMarkdown from 'react-markdown';
import { LinkRenderer } from './utils/markdownRenderers'; // <--- IMPORTAÇÃO CORRETA AGORA
import DOMPurify from 'dompurify';
import remarkGfm from 'remark-gfm';

interface ChatMessageItemProps {
  message: ChatMessage;
}

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
          {message.imagePreviewUrl && (
            <div className="mb-2 max-w-full overflow-hidden rounded-md">
              <img src={message.imagePreviewUrl} alt="Pré-visualização da imagem" className="max-w-full h-auto object-contain" />
            </div>
          )}
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