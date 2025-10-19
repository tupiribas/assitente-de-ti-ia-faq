import React, { createContext, useState, useContext, useEffect, useCallback, ReactNode } from 'react';
import { User } from '../../types'; // Importa a interface User
import { authService } from '../../services/authService'; // Importa o serviço
import LoadingSpinner from '../LoadingSpinner'; // Importa o spinner

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
        // setIsLoading(true); // Removido daqui para evitar piscar o loading em revalidações
        try {
            const { loggedIn, user: sessionUser } = await authService.checkAuthStatus();
            // console.log("AuthProvider: Status recebido:", { loggedIn, sessionUser }); // Log para depuração
            setUser(loggedIn ? sessionUser : null);
        } catch (error) {
            console.error("AuthProvider: Erro ao verificar autenticação:", error);
            setUser(null); // Garante que o usuário seja null em caso de erro
        } finally {
            // Só seta isLoading para false na primeira verificação
            if (isLoading) {
                setIsLoading(false);
            }
            // console.log("AuthProvider: Verificação concluída."); // Log para depuração
        }
    }, [isLoading]); // Adicionado isLoading como dependência para controlar o estado inicial

    // Verifica o status da sessão quando o componente monta pela primeira vez
    useEffect(() => {
        checkAuth();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Executa apenas uma vez na montagem inicial

    // Função de Login
    const login = async (username: string, password: string) => {
        setIsLoading(true); // Mostra loading durante o login
        try {
            const loggedInUser = await authService.login(username, password);
            setUser(loggedInUser); // Atualiza o estado global do usuário
            setIsLoading(false);
        } catch (error) {
            console.error("AuthProvider: Falha no login:", error);
            setUser(null); // Garante que o usuário é null se o login falhar
            setIsLoading(false);
            throw error; // Re-lança para o componente de login tratar (ex: mostrar mensagem)
        }
    };

    // Função de Logout
    const logout = async () => {
        setIsLoading(true); // Mostra loading durante o logout
        try {
            await authService.logout();
            setUser(null); // Limpa o estado global do usuário
            setIsLoading(false);
        } catch (error) {
            console.error("AuthProvider: Falha no logout:", error);
            // Mesmo se o logout falhar no backend, tentamos limpar o estado local
            setUser(null);
            setIsLoading(false);
            throw error; // Re-lança para tratamento opcional
        }
    };

    // Valor a ser fornecido pelo contexto
    const value = {
        user,
        isLoading, // Continua sendo isLoading inicial
        login,
        logout,
        checkAuth
    };

    // Enquanto verifica o status inicial, mostra um loading global
    if (isLoading && !user) { // Mostra loading apenas na carga inicial sem usuário
        return (
            <div className="flex justify-center items-center min-h-screen">
                <LoadingSpinner size="lg" color="text-orange-600" /> {/* Cor ajustada */}
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