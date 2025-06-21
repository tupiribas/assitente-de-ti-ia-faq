
import React from 'react';
import { ChatMessage } from '../types'; // Correctly named ChatMessage
import { UserCircleIcon, CpuChipIcon } from './Icons'; // Assuming CpuChipIcon for AI
import ReactMarkdown from 'react-markdown';
import { LinkRenderer } from './FAQItem';

interface ChatMessageItemProps { // Renamed interface for clarity
  message: ChatMessage;
}

const ChatMessageItem: React.FC<ChatMessageItemProps> = ({ message }) => {
  const isUser = message.sender === 'user';

  // // Basic markdown to HTML conversion for bold, italics, and newlines
  // const formatText = (text: string) => {
  //   let html = text;
  //   // Newlines to <br>
  //   html = html.replace(/\n/g, '<br />');
  //   // **bold** to <strong>bold</strong>
  //   html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  //   // *italic* to <em>italic</em>
  //   html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  //   // `code` to <code>code</code>
  //   html = html.replace(/`(.*?)`/g, '<code class="bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded text-sm">$1</code>');

  //   // For lists (simple conversion: lines starting with '-' or '*' or '1.' become list items)
  //   html = html.replace(/^(\s*[-*]|\s*\d+\.)\s+(.*?)(\<br \/\>|$)/gm, (match, p1, p2) => {
  //     return `<li class="ml-4">${p2.trim()}</li>`;
  //   });
  //   // Wrap groups of <li> in <ul> or <ol> - this is a simplification
  //   if (html.includes('<li')) {
  //     html = `<ul>${html}</ul>`.replace(/<\/ul>\s*<ul>/g, ''); // Crude joining of lists
  //   }

  //   return { __html: html };
  // };


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
          <div className="prose prose-sm max-w-none text-sm">
            {/* MODIFICADO: Usa ReactMarkdown para renderizar o texto da mensagem */}
            <ReactMarkdown components={{ a: LinkRenderer }}>
              {message.text}
            </ReactMarkdown>
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
