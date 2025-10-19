import React, { createContext, useState, useContext, useEffect, useCallback, ReactNode } from 'react';
import { User } from '../types'; // Importa a interface User
import { authService } from '../services/authService'; // Importa o serviço
import LoadingSpinner from '../components/LoadingSpinner'; // Importa o spinner

// Define a forma do contexto
interface AuthContextType {
    user: User | null;
    isLoading: boolean; // Indica se está verificando o status inicial
    login: (username: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    checkAuth: () => Promise<void>; // Função para revalidar
}

// Cria o contexto com um valor padrão inicial (ou undefined)
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Define o Provedor do Contexto
interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true); // Começa carregando

    // Função para verificar o status da sessão (ao carregar ou manualmente)
    const checkAuth = useCallback(async () => {
        // console.log("AuthProvider: Verificando status de autenticação..."); // Log para depuração
        setIsLoading(true);
        try {
            const { loggedIn, user: sessionUser } = await authService.checkAuthStatus();
            // console.log("AuthProvider: Status recebido:", { loggedIn, sessionUser }); // Log para depuração
            setUser(loggedIn ? sessionUser : null);
        } catch (error) {
            console.error("AuthProvider: Erro ao verificar autenticação:", error);
            setUser(null); // Garante que o usuário seja null em caso de erro
        } finally {
            setIsLoading(false);
            // console.log("AuthProvider: Verificação concluída."); // Log para depuração
        }
    }, []);

    // Verifica o status da sessão quando o componente monta pela primeira vez
    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    // Função de Login
    const login = async (username: string, password: string) => {
        try {
            const loggedInUser = await authService.login(username, password);
            setUser(loggedInUser); // Atualiza o estado global do usuário
        } catch (error) {
            console.error("AuthProvider: Falha no login:", error);
            setUser(null); // Garante que o usuário é null se o login falhar
            throw error; // Re-lança para o componente de login tratar (ex: mostrar mensagem)
        }
    };

    // Função de Logout
    const logout = async () => {
        try {
            await authService.logout();
            setUser(null); // Limpa o estado global do usuário
        } catch (error) {
            console.error("AuthProvider: Falha no logout:", error);
            // Mesmo se o logout falhar no backend, tentamos limpar o estado local
            setUser(null);
            throw error; // Re-lança para tratamento opcional
        }
    };

    // Valor a ser fornecido pelo contexto
    const value = {
        user,
        isLoading,
        login,
        logout,
        checkAuth // Expõe a função para revalidação manual se necessário
    };

    // Enquanto verifica o status inicial, pode mostrar um loading global
    if (isLoading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <LoadingSpinner size="lg" />
                <p className="ml-4 text-slate-600">Verificando autenticação...</p>
            </div>
        );
    }

    // Fornece o contexto para os componentes filhos
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Hook customizado para usar o contexto facilmente
export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth deve ser usado dentro de um AuthProvider');
    }
    return context;
};