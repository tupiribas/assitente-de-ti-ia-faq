import React, { useState, useEffect, useCallback } from 'react';
import { adminService } from '@/services/adminService'; // Use alias @
import LoadingSpinner from '@/components/LoadingSpinner'; // Use alias @
import { PencilIcon, CheckCircleIcon, XCircleIcon } from '@/components/Icons'; // Use alias @

const AdminPromptPage: React.FC = () => {
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const fetchPrompt = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const currentPrompt = await adminService.getSystemPrompt();
            setPrompt(currentPrompt);
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Erro desconhecido.';
            setError(`Falha ao carregar o prompt: ${msg}`);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPrompt();
    }, [fetchPrompt]);

    const handleSave = async () => {
        setIsSaving(true);
        setError(null);
        setSuccessMessage(null);
        try {
            await adminService.updateSystemPrompt(prompt);
            setSuccessMessage('Prompt do sistema atualizado com sucesso!');
            setTimeout(() => setSuccessMessage(null), 4000);
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Erro desconhecido.';
            setError(`Falha ao salvar o prompt: ${msg}`);
            // Recarrega o prompt original em caso de erro para evitar confusão
            fetchPrompt();
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="bg-white p-6 sm:p-8 rounded-lg shadow-xl border border-slate-200">
                <div className="flex items-center mb-6 pb-4 border-b border-slate-200">
                    <PencilIcon className="w-8 h-8 text-orange-600 mr-3 flex-shrink-0" />
                    <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">Editar Prompt do Sistema da IA</h2>
                </div>

                {error && (
                    <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-md border border-red-200 flex items-center" role="alert">
                        <XCircleIcon className="w-5 h-5 mr-2 flex-shrink-0" />
                        {error}
                    </div>
                )}
                {successMessage && (
                    <div className="mb-4 p-4 bg-green-100 text-green-700 rounded-md border border-green-200 flex items-center" role="status">
                        <CheckCircleIcon className="w-5 h-5 mr-2 flex-shrink-0" />
                        {successMessage}
                    </div>
                )}

                {isLoading ? (
                    <div className="text-center py-10">
                        <LoadingSpinner size="md" color="text-orange-600" />
                        <p className="text-slate-500 mt-2 text-sm">A carregar prompt...</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="system-prompt-textarea" className="block text-sm font-medium text-slate-700 mb-1">
                                Instrução do Sistema (Prompt Base):
                            </label>
                            <textarea
                                id="system-prompt-textarea"
                                rows={20} // Ajuste a altura conforme necessário
                                className="w-full p-3 border border-slate-300 rounded-md shadow-sm focus:ring-orange-500 focus:border-orange-500 font-mono text-sm leading-relaxed" // Fonte mono para código/prompt
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                disabled={isSaving}
                                placeholder="Digite aqui a instrução base para o assistente de IA..."
                            />
                            <p className="mt-2 text-xs text-slate-500">
                                Esta é a instrução principal que define o comportamento, a persona e as regras do assistente de IA. Edite com cuidado.
                            </p>
                        </div>
                        <div className="text-right pt-2">
                            <button
                                onClick={handleSave}
                                className="inline-flex justify-center items-center px-6 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed min-w-[150px]"
                                disabled={isSaving || isLoading}
                            >
                                {isSaving ? <LoadingSpinner size="sm" color="text-white" /> : 'Salvar Prompt'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminPromptPage;