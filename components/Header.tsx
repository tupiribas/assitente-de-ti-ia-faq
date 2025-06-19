import React from 'react';
import { AppView } from '../types';
import { LightBulbIcon, SpeechBubbleIcon, PlusCircleIcon } from './Icons'; // Updated Icons

interface HeaderProps {
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
}

const Header: React.FC<HeaderProps> = ({ currentView, setCurrentView }) => {
  const navButtonClasses = "flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors duration-150 ease-in-out";
  const activeClasses = "bg-blue-600 text-white";
  const inactiveClasses = "text-slate-700 hover:bg-blue-100 hover:text-blue-700";

  return (
    <header className="bg-white shadow-md">
      <div className="container mx-auto px-4 py-4 flex flex-col sm:flex-row justify-between items-center">
        <div className="flex items-center text-2xl font-bold text-blue-700 mb-4 sm:mb-0">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 mr-2 text-blue-600">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75v6.75m0 0l-3-3m3 3l3-3m-8.25 6a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.039 0 4.5 4.5 0 01-1.41 8.775H5.25z" />
          </svg>
          Assistente de TI IA & FAQ
        </div>
        <nav className="flex space-x-2 sm:space-x-4">
          <button
            onClick={() => setCurrentView(AppView.FAQ)}
            className={`${navButtonClasses} ${currentView === AppView.FAQ ? activeClasses : inactiveClasses}`}
            aria-label="Perguntas Frequentes"
          >
            <LightBulbIcon className="w-5 h-5 mr-2" />
            FAQs
          </button>
          <button
            onClick={() => setCurrentView(AppView.AI_ASSISTANT)}
            className={`${navButtonClasses} ${currentView === AppView.AI_ASSISTANT ? activeClasses : inactiveClasses}`}
            aria-label="Assistente de Inteligência Artificial"
          >
            <SpeechBubbleIcon className="w-5 h-5 mr-2" /> {/* Updated Icon */}
            Assistente IA
          </button>
          <button
            onClick={() => setCurrentView(AppView.MANAGE_FAQS)}
            className={`${navButtonClasses} ${currentView === AppView.MANAGE_FAQS ? activeClasses : inactiveClasses}`}
            aria-label="Criar Novo FAQ" // Updated aria-label
          >
            <PlusCircleIcon className="w-5 h-5 mr-2" /> {/* Updated Icon */}
            Criar FAQ {/* Updated Text */}
          </button>
        </nav>
      </div>
    </header>
  );
};

export default Header;