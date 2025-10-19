import React, { useState, FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext'; // Importa o hook de autenticação
import { useNavigate, useLocation } from 'react-router-dom'; // Para redirecionamento
import LoadingSpinner from '../LoadingSpinner';

const LoginPage: React.FC = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useAuth(); // Pega a função de login do contexto
    const navigate = useNavigate();
    const location = useLocation();

    // Tenta pegar a URL de origem para redirecionar após o login
    // Se não houver estado 'from' (acesso direto à página de login), redireciona para /faqs
    const from = location.state?.from?.pathname || '/faqs';

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null); // Limpa erros anteriores
        setIsLoading(true);

        if (!username.trim() || !password.trim()) {
            setError('Por favor, preencha o usuário e a senha.');
            setIsLoading(false);
            return;
        }

        try {
            // Chama a função login do AuthContext
            await login(username.trim(), password);
            // Login bem-sucedido, redireciona para a página de origem ou /faqs
            console.log(`Login successful, redirecting to: ${from}`); // Log para depuração
            navigate(from, { replace: true }); // 'replace: true' evita que a página de login fique no histórico
        } catch (err) {
            // Pega o erro lançado pelo authService/AuthProvider
            const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido durante o login.';
            setError(errorMessage);
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-lg border border-slate-200"> {/* Adicionado borda */}
                <div>
                    {/* Pode adicionar um logo aqui se quiser */}
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                        Acessar Painel
                    </h2>
                </div>
                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    {/* Campo oculto para lembrar, se necessário */}
                    <input type="hidden" name="remember" defaultValue="true" />
                    <div className="rounded-md shadow-sm -space-y-px">
                        {/* Campo Usuário */}
                        <div>
                            <label htmlFor="username-input" className="sr-only">
                                Usuário
                            </label>
                            <input
                                id="username-input"
                                name="username"
                                type="text"
                                autoComplete="username"
                                required
                                className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-orange-500 focus:border-orange-500 focus:z-10 sm:text-sm" // Aumentado py
                                placeholder="Usuário"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                disabled={isLoading}
                            />
                        </div>
                        {/* Campo Senha */}
                        <div>
                            <label htmlFor="password-input" className="sr-only">
                                Senha
                            </label>
                            <input
                                id="password-input"
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                required
                                className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-orange-500 focus:border-orange-500 focus:z-10 sm:text-sm" // Aumentado py
                                placeholder="Senha"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={isLoading}
                            />
                        </div>
                    </div>

                    {/* Exibição de Erro */}
                    {error && (
                        <div className="rounded-md bg-red-50 p-4 mt-4"> {/* Adicionado mt-4 */}
                            <div className="flex">
                                {/* Ícone de erro (opcional) */}
                                <div className="ml-3">
                                    <p className="text-sm font-medium text-red-800">{error}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Botão de Envio */}
                    <div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150" // Aumentado py
                        >
                            {isLoading ? (
                                <LoadingSpinner size="sm" color="text-white" />
                            ) : (
                                'Entrar'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default LoginPage;