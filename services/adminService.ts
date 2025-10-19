import { User } from '../types'; // Importa a interface User

const API_ADMIN_BASE_URL = '/api/admin';

// Interface para os dados de criação de usuário (sem o ID e createdAt)
interface NewUserData {
  username: string;
  password: string;
  role: 'admin' | 'editor';
}

const adminService = {
  // Função para buscar todos os usuários (requer admin logado)
  getUsers: async (): Promise<User[]> => {
    try {
      const response = await fetch(`${API_ADMIN_BASE_URL}/users`, {
        credentials: 'include', // Envia o cookie de sessão
      });

      const data = await response.json(); // Lê o corpo mesmo em caso de erro

      if (!response.ok) {
        // Usa a mensagem de erro do backend se disponível, caso contrário usa o status text
        throw new Error(data.message || `Erro HTTP ao buscar usuários: ${response.status} ${response.statusText}`);
      }
      // Adiciona createdAt à interface User se vier da API
      return data as User[];
    } catch (error) {
      console.error("Erro ao buscar usuários:", error);
      throw error; // Re-lança para ser tratado no componente
    }
  },

  // Função para criar um novo usuário (requer admin logado)
  createUser: async (userData: NewUserData): Promise<User> => {
    try {
      const response = await fetch(`${API_ADMIN_BASE_URL}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
        credentials: 'include', // Envia o cookie de sessão
      });

      const data = await response.json(); // Lê o corpo mesmo em caso de erro

      if (!response.ok) {
        throw new Error(data.message || `Erro HTTP ao criar usuário: ${response.status} ${response.statusText}`);
      }
      return data as User; // Retorna o usuário criado (que pode incluir id e createdAt do backend)
    } catch (error) {
      console.error("Erro ao criar usuário:", error);
      throw error; // Re-lança para ser tratado no componente
    }
  },

  // Função para excluir um usuário (requer admin logado)
  deleteUser: async (userId: string): Promise<void> => {
    try {
      const response = await fetch(`${API_ADMIN_BASE_URL}/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include', // Envia o cookie de sessão
      });

      // DELETE bem-sucedido geralmente retorna 204 No Content
      if (!response.ok) {
        // Tenta ler como texto ou JSON se houver corpo de erro
        const errorBody = await response.text();
        let errorMessage = `Erro HTTP ao excluir usuário: ${response.status}`;
        try {
            // Tenta parsear como JSON, se falhar, usa o texto puro
            const jsonError = JSON.parse(errorBody);
            errorMessage += ` - ${jsonError.message || response.statusText}`;
        } catch {
            errorMessage += ` - ${errorBody || response.statusText}`;
        }
        throw new Error(errorMessage);
      }
      // Exclusão bem-sucedida, não retorna nada
    } catch (error) {
      console.error(`Erro ao excluir usuário ${userId}:`, error);
      throw error; // Re-lança para ser tratado no componente
    }
  },
};

export { adminService };