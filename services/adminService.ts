import { User } from '../types'; // Importa a interface User (certifique-se que o caminho está correto, ex: '@/types' ou '../types')

const API_ADMIN_BASE_URL = '/api/admin'; // Base URL para as rotas de admin no backend

// Interface para os dados necessários para criar um novo usuário
interface NewUserData {
    username: string;
    password: string;
    role: 'admin' | 'editor';
}

const adminService = {
    /**
     * Busca a lista de todos os usuários cadastrados.
     * Requer que o usuário logado seja um administrador.
     * @returns Uma Promise que resolve com um array de objetos User.
     */
    getUsers: async (): Promise<User[]> => {
        try {
            const response = await fetch(`${API_ADMIN_BASE_URL}/users`, {
                credentials: 'include', // Envia o cookie de sessão para autenticação
            });

            const data = await response.json(); // Tenta ler o corpo da resposta

            if (!response.ok) {
                // Se a resposta não for OK, lança um erro com a mensagem do backend ou status
                throw new Error(data.message || `Erro HTTP ao buscar usuários: ${response.status} ${response.statusText}`);
            }
            // Retorna os dados dos usuários (que devem corresponder à interface User)
            return data as User[];
        } catch (error) {
            console.error("Erro no serviço adminService.getUsers:", error);
            throw error; // Re-lança o erro para ser tratado pelo componente que chamou
        }
    },

    /**
     * Cria um novo usuário no sistema.
     * Requer que o usuário logado seja um administrador.
     * @param userData - Objeto contendo username, password e role do novo usuário.
     * @returns Uma Promise que resolve com o objeto User do usuário recém-criado.
     */
    createUser: async (userData: NewUserData): Promise<User> => {
        try {
            const response = await fetch(`${API_ADMIN_BASE_URL}/users`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json', // Indica que estamos enviando JSON
                },
                body: JSON.stringify(userData), // Converte os dados para JSON
                credentials: 'include', // Envia o cookie de sessão
            });

            const data = await response.json(); // Tenta ler o corpo da resposta

            if (!response.ok) {
                throw new Error(data.message || `Erro HTTP ao criar usuário: ${response.status} ${response.statusText}`);
            }
            // Retorna os dados do usuário criado (incluindo ID e createdAt gerados pelo backend)
            return data as User;
        } catch (error) {
            console.error("Erro no serviço adminService.createUser:", error);
            throw error;
        }
    },

    /**
     * Exclui um usuário do sistema pelo seu ID.
     * Requer que o usuário logado seja um administrador.
     * @param userId - O ID (UUID) do usuário a ser excluído.
     * @returns Uma Promise que resolve quando a exclusão é bem-sucedida.
     */
    deleteUser: async (userId: string): Promise<void> => {
        try {
            const response = await fetch(`${API_ADMIN_BASE_URL}/users/${userId}`, {
                method: 'DELETE',
                credentials: 'include', // Envia o cookie de sessão
            });

            // Status 204 (No Content) é a resposta esperada para um DELETE bem-sucedido
            if (!response.ok && response.status !== 204) {
                // Tenta ler o corpo do erro como texto, pois pode não ser JSON
                const errorBody = await response.text();
                let errorMessage = `Erro HTTP ao excluir usuário: ${response.status}`;
                try {
                    // Tenta parsear como JSON, caso o backend envie um erro estruturado
                    const jsonError = JSON.parse(errorBody);
                    errorMessage += ` - ${jsonError.message || response.statusText}`;
                } catch {
                    // Se não for JSON, usa o texto puro
                    errorMessage += ` - ${errorBody || response.statusText}`;
                }
                throw new Error(errorMessage);
            }
            // Se chegou aqui, a exclusão foi bem-sucedida (status 200 ou 204)
        } catch (error) {
            console.error(`Erro no serviço adminService.deleteUser (ID: ${userId}):`, error);
            throw error;
        }
    },

    /**
     * Busca o prompt de sistema atual da IA.
     * Requer que o usuário logado seja um administrador.
     * @returns Uma Promise que resolve com o texto do prompt atual.
     */
    getSystemPrompt: async (): Promise<string> => {
        try {
            const response = await fetch(`${API_ADMIN_BASE_URL}/system-prompt`, {
                credentials: 'include', // Envia o cookie de sessão
            });
            const data = await response.json(); // Tenta ler como JSON

            if (!response.ok) {
                throw new Error(data.message || `Erro HTTP ao buscar prompt: ${response.status} ${response.statusText}`);
            }
            // Verifica se a propriedade 'prompt' existe na resposta
            if (typeof data.prompt !== 'string') {
                throw new Error("Resposta da API inválida: propriedade 'prompt' não encontrada ou não é uma string.");
            }
            return data.prompt;
        } catch (error) {
            console.error("Erro no serviço adminService.getSystemPrompt:", error);
            throw error;
        }
    },

    /**
     * Atualiza o prompt de sistema da IA.
     * Requer que o usuário logado seja um administrador.
     * @param prompt - O novo texto do prompt de sistema.
     * @returns Uma Promise que resolve com o texto do prompt atualizado (confirmado pelo backend).
     */
    updateSystemPrompt: async (prompt: string): Promise<string> => {
        try {
            const response = await fetch(`${API_ADMIN_BASE_URL}/system-prompt`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json', // Indica envio de JSON
                },
                body: JSON.stringify({ prompt }), // Envia o novo prompt no corpo
                credentials: 'include', // Envia o cookie de sessão
            });
            const data = await response.json(); // Tenta ler como JSON

            if (!response.ok) {
                throw new Error(data.message || `Erro HTTP ao atualizar prompt: ${response.status} ${response.statusText}`);
            }
            // Verifica se a propriedade 'prompt' existe na resposta
            if (typeof data.prompt !== 'string') {
                throw new Error("Resposta da API inválida após atualização: propriedade 'prompt' não encontrada.");
            }
            return data.prompt; // Retorna o prompt atualizado confirmado pelo backend
        } catch (error) {
            console.error("Erro no serviço adminService.updateSystemPrompt:", error);
            throw error;
        }
    },
};

export { adminService }; // Exporta o objeto do serviço