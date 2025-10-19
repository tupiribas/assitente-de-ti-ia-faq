import { User } from '../types'; // Importa a interface User

const API_AUTH_BASE_URL = '/api/auth';

interface AuthStatus {
    loggedIn: boolean;
    user: User | null;
}

const authService = {
    // Função para verificar o status atual da sessão
    checkAuthStatus: async (): Promise<AuthStatus> => {
        try {
            const response = await fetch(`${API_AUTH_BASE_URL}/status`, {
                // Importante: 'credentials: "include"' envia cookies (como o de sessão)
                credentials: 'include',
            });
            if (!response.ok) {
                // Se o status falhar (ex: servidor offline), assumimos não logado
                console.error(`Erro ao verificar status de autenticação: ${response.status}`);
                return { loggedIn: false, user: null };
            }
            const data: AuthStatus = await response.json();
            return data;
        } catch (error) {
            console.error("Erro de rede ao verificar status de autenticação:", error);
            return { loggedIn: false, user: null }; // Assume não logado em caso de erro de rede
        }
    },

    // Função para fazer login
    login: async (username: string, password: string): Promise<User> => {
        try {
            const response = await fetch(`${API_AUTH_BASE_URL}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
                credentials: 'include', // Envia cookies se houver, recebe o cookie de sessão
            });

            const data = await response.json(); // Lê o corpo da resposta independentemente do status

            if (!response.ok) {
                // Usa a mensagem de erro do backend se disponível
                throw new Error(data.message || `Erro HTTP: ${response.status}`);
            }
            return data as User; // Retorna os dados do usuário em caso de sucesso
        } catch (error) {
            console.error("Erro ao fazer login:", error);
            throw error; // Re-lança o erro para ser tratado no componente
        }
    },

    // Função para fazer logout
    logout: async (): Promise<void> => {
        try {
            const response = await fetch(`${API_AUTH_BASE_URL}/logout`, {
                method: 'POST',
                credentials: 'include', // Envia o cookie de sessão para o backend invalidá-lo
            });
            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({})); // Tenta ler erro JSON
                throw new Error(errorBody.message || `Erro HTTP ao fazer logout: ${response.status}`);
            }
            // Logout bem-sucedido
        } catch (error) {
            console.error("Erro ao fazer logout:", error);
            throw error; // Re-lança o erro
        }
    },
};

export { authService };