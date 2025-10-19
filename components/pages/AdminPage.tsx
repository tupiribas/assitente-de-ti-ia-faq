import React, { useState, useEffect, useCallback, FormEvent } from 'react';
import { User } from '../../types'; // Importa a interface User
import { adminService } from '../../services/adminService'; // Importa o novo serviço
import LoadingSpinner from '../LoadingSpinner';
import { PlusCircleIcon, TrashIcon, UserGroupIcon } from '../../components/Icons'; // Importa ícones (use @/components/... se configurou alias)
import { useAuth } from '../contexts/AuthContext'; // Importa useAuth para verificar o usuário atual

const AdminPage: React.FC = () => {
    const { user: currentUser } = useAuth(); // Pega o usuário admin logado
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Estados para o formulário de novo usuário
    const [newUsername, setNewUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newRole, setNewRole] = useState<'editor' | 'admin'>('editor'); // Padrão 'editor'
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Função para buscar usuários
    const fetchUsers = useCallback(async () => {
        // Não seta isLoading true aqui para evitar piscar ao recarregar
        setError(null);
        try {
            const fetchedUsers = await adminService.getUsers();
            setUsers(fetchedUsers);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Erro desconhecido ao carregar usuários.';
            setError(`Falha ao carregar usuários: ${message}`);
            setUsers([]); // Limpa usuários em caso de erro
        } finally {
            setIsLoading(false); // Seta isLoading false apenas na primeira carga ou após erro
        }
    }, []);

    // Busca usuários ao montar o componente
    useEffect(() => {
        setIsLoading(true); // Seta loading true apenas na montagem inicial
        fetchUsers();
    }, [fetchUsers]);

    // Handler para submeter o formulário de novo usuário
    const handleAddUser = async (e: FormEvent) => {
        e.preventDefault();
        setFormError(null);
        setSuccessMessage(null); // Limpa mensagens anteriores

        if (!newUsername.trim() || !newPassword.trim()) {
            setFormError('Nome de usuário e senha são obrigatórios.');
            return;
        }
        if (newPassword.length < 8) {
            setFormError('A senha deve ter no mínimo 8 caracteres.');
            return;
        }

        setIsSubmitting(true);
        try {
            await adminService.createUser({
                username: newUsername.trim(),
                password: newPassword,
                role: newRole,
            });
            setSuccessMessage(`Usuário '${newUsername.trim()}' criado com sucesso!`);
            // Limpa o formulário
            setNewUsername('');
            setNewPassword('');
            setNewRole('editor');
            // Recarrega a lista de usuários
            await fetchUsers();
            // Limpa a mensagem de sucesso após alguns segundos
            setTimeout(() => setSuccessMessage(null), 4000);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Erro desconhecido ao criar usuário.';
            setFormError(`Falha ao criar usuário: ${message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handler para excluir um usuário
    const handleDeleteUser = async (userId: string, username: string) => {
        // Impede a auto-exclusão (embora o backend também valide)
        if (currentUser && currentUser.id === userId) {
            alert("Você não pode excluir a si mesmo.");
            return;
        }

        if (window.confirm(`Tem certeza que deseja excluir o usuário '${username}'? Esta ação não pode ser desfeita.`)) {
            setError(null); // Limpa erro geral antes de tentar excluir
            setSuccessMessage(null);
            try {
                await adminService.deleteUser(userId);
                setSuccessMessage(`Usuário '${username}' excluído com sucesso!`);
                // Recarrega a lista
                await fetchUsers();
                setTimeout(() => setSuccessMessage(null), 4000);
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Erro desconhecido ao excluir usuário.';
                // Mostra erro geral, não no formulário
                setError(`Falha ao excluir usuário '${username}': ${message}`);
                // Limpa erro após alguns segundos
                setTimeout(() => setError(null), 5000);
            }
        }
    };

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="bg-white p-6 sm:p-8 rounded-lg shadow-xl border border-slate-200"> {/* Adicionado borda */}
                {/* Cabeçalho da Página */}
                <div className="flex items-center mb-6 pb-4 border-b border-slate-200">
                    <UserGroupIcon className="w-8 h-8 text-orange-600 mr-3 flex-shrink-0" />
                    <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">Gerenciamento de Usuários</h2>
                </div>

                {/* Mensagem de Erro Geral */}
                {error && (
                    <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-md text-center border border-red-200" role="alert">
                        {error}
                    </div>
                )}
                {/* Mensagem de Sucesso Geral */}
                {successMessage && !formError && ( // Mostra sucesso geral apenas se não houver erro de formulário
                    <div className="mb-4 p-4 bg-green-100 text-green-700 rounded-md text-center border border-green-200" role="status">
                        {successMessage}
                    </div>
                )}

                {/* --- Seção Adicionar Novo Usuário --- */}
                <div className="mb-8 p-6 border border-slate-200 rounded-lg bg-slate-50 shadow-sm">
                    <h3 className="text-xl font-semibold text-slate-700 mb-5 flex items-center">
                        <PlusCircleIcon className="w-6 h-6 mr-2 text-orange-500 flex-shrink-0" />
                        Adicionar Novo Usuário
                    </h3>
                    <form onSubmit={handleAddUser} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end"> {/* items-end para alinhar botão */}
                            {/* Campo Username */}
                            <div>
                                <label htmlFor="new-username" className="block text-sm font-medium text-slate-600 mb-1">
                                    Nome de Usuário
                                </label>
                                <input
                                    type="text"
                                    id="new-username"
                                    value={newUsername}
                                    onChange={(e) => setNewUsername(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-orange-500 focus:border-orange-500 sm:text-sm"
                                    required
                                    disabled={isSubmitting}
                                    autoComplete="off"
                                />
                            </div>
                            {/* Campo Senha */}
                            <div>
                                <label htmlFor="new-password" className="block text-sm font-medium text-slate-600 mb-1">
                                    Senha (mín. 8 caracteres)
                                </label>
                                <input
                                    type="password"
                                    id="new-password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-orange-500 focus:border-orange-500 sm:text-sm"
                                    required
                                    minLength={8}
                                    disabled={isSubmitting}
                                    autoComplete="new-password"
                                />
                            </div>
                            {/* Campo Role */}
                            <div>
                                <label htmlFor="new-role" className="block text-sm font-medium text-slate-600 mb-1">
                                    Papel (Role)
                                </label>
                                <select
                                    id="new-role"
                                    value={newRole}
                                    onChange={(e) => setNewRole(e.target.value as 'editor' | 'admin')}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-orange-500 focus:border-orange-500 bg-white sm:text-sm"
                                    required
                                    disabled={isSubmitting}
                                >
                                    <option value="editor">Editor</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>
                        </div>
                        {/* Mensagem de Erro do Formulário */}
                        {formError && (
                            <p className="text-sm text-red-600 text-center mt-2">{formError}</p>
                        )}
                        {/* Mensagem de Sucesso (específica do form, sobrescreve a geral se houver) */}
                        {successMessage && (
                            <p className="text-sm text-green-600 text-center mt-2">{successMessage}</p>
                        )}
                        {/* Botão Adicionar */}
                        <div className="text-right pt-2"> {/* Adicionado pt-2 */}
                            <button
                                type="submit"
                                className="inline-flex justify-center items-center px-6 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed min-w-[150px]" // Aumentado min-w
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? <LoadingSpinner size="sm" color="text-white" /> : 'Adicionar Usuário'}
                            </button>
                        </div>
                    </form>
                </div>
                {/* --- FIM Seção Adicionar --- */}

                {/* --- Seção Lista de Usuários --- */}
                <h3 className="text-xl font-semibold text-slate-700 mb-4 mt-8">Usuários Cadastrados</h3>
                {isLoading ? (
                    <div className="text-center py-6">
                        <LoadingSpinner size="md" color="text-orange-600" />
                        <p className="text-slate-500 mt-2 text-sm">Carregando usuários...</p>
                    </div>
                ) : users.length === 0 && !error ? (
                    <p className="text-slate-600 text-center py-4 italic">Nenhum usuário cadastrado (além de você).</p>
                ) : !error && users.length > 0 ? ( // Mostra tabela apenas se não houver erro E houver usuários
                    <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-sm">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Nome de Usuário</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Papel (Role)</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Criado em</th>
                                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                                {users.map((userItem) => (
                                    <tr key={userItem.id} className="hover:bg-slate-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{userItem.username}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                            {/* Badge para Role */}
                                            <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${userItem.role === 'admin' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                                                {userItem.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                            {/* Formata a data se existir */}
                                            {userItem.createdAt ? new Date(userItem.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Data indisponível'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            {/* Botão Excluir */}
                                            <button
                                                onClick={() => handleDeleteUser(userItem.id, userItem.username)}
                                                className="p-1 text-red-600 hover:text-red-800 disabled:text-slate-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 rounded-md transition-colors"
                                                title={`Excluir usuário ${userItem.username}`}
                                                // Desabilita botão se for o usuário admin atual
                                                disabled={currentUser?.id === userItem.id}
                                            >
                                                <TrashIcon className="w-5 h-5" />
                                            </button>
                                            {/* Futuramente: Botão Editar
                      <button className="p-1 text-blue-600 hover:text-blue-900 ml-2 ...">
                          <PencilIcon className="w-5 h-5" />
                      </button>
                      */}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : null /* Se houver erro geral, a mensagem de erro já foi exibida acima */}
                {/* --- FIM Seção Lista --- */}
            </div>
        </div>
    );
};

export default AdminPage;