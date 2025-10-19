import React from 'react';
import { useNavigate, NavLink } from 'react-router-dom'; // Importa NavLink para estilo ativo
import { useAuth } from './contexts/AuthContext'; // Importa o hook de autenticação
// Certifique-se de que estes ícones foram adicionados ao seu components/Icons.tsx
import { LightBulbIcon, SpeechBubbleIcon, PlusCircleIcon, UserGroupIcon, LoginIcon, LogoutIcon } from './Icons';

const Header: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth(); // Pega o usuário e a função logout do contexto

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login'); // Redireciona para login após logout
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
      // Opcional: Mostrar uma mensagem de erro para o usuário
      alert(`Erro ao sair: ${error instanceof Error ? error.message : "Erro desconhecido"}`);
    }
  };

  // Define as classes para NavLink, incluindo o estilo quando ativo
  const navLinkClasses = ({ isActive }: { isActive: boolean }) =>
    `flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors duration-150 ease-in-out ${isActive
      ? 'bg-orange-100 text-orange-700 font-semibold' // Estilo para link ativo
      : 'text-slate-700 hover:bg-orange-50 hover:text-orange-600' // Estilo para link inativo
    }`;


  return (
    <header className="bg-white shadow-md sticky top-0 z-50"> {/* Adiciona sticky e z-index */}
      <div className="container mx-auto px-4 py-4 flex flex-col sm:flex-row justify-between items-center">
        {/* Logo/Título Clicável */}
        <div className="flex items-center text-xl sm:text-2xl font-bold text-orange-700 mb-4 sm:mb-0 cursor-pointer" onClick={() => navigate('/')}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 mr-2 text-orange-600">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75v6.75m0 0l-3-3m3 3l3-3m-8.25 6a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.039 0 4.5 4.5 0 01-1.41 8.775H5.25z" />
          </svg>
          Assistente de TI IA & FAQ
        </div>

        {/* Navegação e Botões de Ação */}
        <nav className="flex items-center flex-wrap justify-center sm:justify-end space-x-2 sm:space-x-4"> {/* Adiciona flex-wrap */}
          {/* NavLink para estilo ativo */}
          <NavLink to="/faqs" className={navLinkClasses} aria-label="Perguntas Frequentes">
            <LightBulbIcon className="w-5 h-5 mr-1.5" />
            FAQs
          </NavLink>
          <NavLink to="/ai-assistant" className={navLinkClasses} aria-label="Assistente de Inteligência Artificial">
            <SpeechBubbleIcon className="w-5 h-5 mr-1.5" />
            Assistente IA
          </NavLink>

          {/* Botões visíveis apenas se logado como editor ou admin */}
          {user && (user.role === 'admin' || user.role === 'editor') && (
            <NavLink to="/manage-faq/new" className={navLinkClasses} aria-label="Criar Novo FAQ">
              <PlusCircleIcon className="w-5 h-5 mr-1.5" />
              Criar FAQ
            </NavLink>
          )}

          {/* Link para Admin visível apenas para admins */}
          {user && user.role === 'admin' && (
            <NavLink to="/admin/users" className={navLinkClasses} aria-label="Gerenciar Usuários">
              <UserGroupIcon className="w-5 h-5 mr-1.5" /> {/* Ícone para gerenciar usuários */}
              Admin
            </NavLink>
          )}

          {/* Botão Login ou Logout */}
          {user ? (
            <button
              onClick={handleLogout}
              className="flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors duration-150 ease-in-out text-slate-700 hover:bg-red-100 hover:text-red-700"
              aria-label="Sair"
            >
              <LogoutIcon className="w-5 h-5 mr-1.5" />
              Sair ({user.username}) {/* Mostra nome do usuário */}
            </button>
          ) : (
            <NavLink to="/login" className={navLinkClasses} aria-label="Entrar">
              <LoginIcon className="w-5 h-5 mr-1.5" />
              Entrar
            </NavLink>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Header;