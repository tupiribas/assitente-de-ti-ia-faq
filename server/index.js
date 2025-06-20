// Carrega variáveis de ambiente do .env.local
// Esta linha deve ser a primeira para garantir que as variáveis de ambiente sejam carregadas antes de qualquer outra coisa.
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env.local') });

const express = require('express');
const fs = require('fs').promises; // Usar fs.promises para async/await
const path = require('path');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
// CORRIGIDO: Usar a importação correta para a nova biblioteca @google/generative-ai
const { GoogleGenerativeAI } = require('@google/generative-ai');
const multer = require('multer'); // Importa o Multer para lidar com upload de arquivos
const pdf = require('pdf-parse'); // Para PDFs
const mammoth = require('mammoth'); // Para DOCX
const util = require('util'); // Utilitário para promisify

// Importar do diretório de build após compilação.
// CORRIGIDO: Caminho da importação para 'constants'
const { GEMINI_MODEL_NAME, AI_SYSTEM_INSTRUCTION } = require('./build/constants');

// Certifique-se de que a API_KEY está disponível como uma variável de ambiente no servidor Fly.io
// Prefira carregar do process.env.GEMINI_API_KEY. Se não estiver definido, use um valor padrão ou lance um erro.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// VERIFICAÇÃO CRÍTICA da API Key
if (!GEMINI_API_KEY || GEMINI_API_KEY.length === 0) {
    console.error("ERRO CRÍTICO: GEMINI_API_KEY não está definida ou está vazia na variável de ambiente.");
    console.error("Por favor, defina a variável de ambiente GEMINI_API_KEY:");
    console.error("  - Localmente: Crie um arquivo .env.local na raiz do projeto com GEMINI_API_KEY=\"SUA_CHAVE\"");
    console.error("  - No Fly.io: Execute flyctl secrets set GEMINI_API_KEY=\"SUA_CHAVE\"");
    // Não encerre o processo aqui se você quiser que as rotas de FAQ continuem funcionando,
    // mas o assistente de IA falhará. Para desenvolvimento, é útil encerrar para depuração.
    // process.exit(1); // Pode ser reativado para garantir que a chave esteja presente.
}

// Inicializa o cliente GoogleGenerativeAI globalmente
const ai = new GoogleGenerativeAI(GEMINI_API_KEY);


const app = express();
const PORT = process.env.PORT || 3001;

const FAQS_FILE = path.join('/app/data', 'faqs.json');
const frontendBuildPath = path.join(__dirname, '..', 'public');

// CORRIGIDO: Diretório para uploads de imagens e documentos.
const UPLOADS_DIR = path.join('/app/data', 'uploads');
const UPLOADS_SERVE_PATH = '/uploads';

// Configuração do Multer para armazenamento de imagens de FAQ (persistente em disco)
const storageFAQAssets = multer.diskStorage({
    destination: async (req, file, cb) => {
        await fs.mkdir(UPLOADS_DIR, { recursive: true }).catch(console.error);
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileExtension = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + fileExtension);
    }
});

// NOVO: Função para filtrar tipos de arquivo permitidos
const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp', // Imagens
        'application/pdf', // PDFs
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
        'text/plain' // TXT
    ];
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true); // Aceita o arquivo
    } else {
        cb(new Error('Tipo de arquivo não permitido. Apenas imagens (JPG, PNG, GIF, WEBP), PDF, DOCX e TXT são suportados.'), false);
    }
};

const uploadFAQAsset = multer({
    storage: storageFAQAssets,
    fileFilter: fileFilter, // Aplica o filtro
    limits: { fileSize: 10 * 1024 * 1024 } // Limite de 10MB por arquivo (ajuste conforme necessário)
});

// Configuração do Multer para lidar com imagens no chat (armazenamento temporário em memória)
const storageChatImage = multer.memoryStorage();
const uploadChatImage = multer({
    storage: storageChatImage,
    limits: { fileSize: 10 * 1024 * 1024 } // Define um limite de 10MB por arquivo (ajuste se necessário)
});


// Middlewares
app.use(cors());
app.use(express.json());

// CORRIGIDO: Servir arquivos estáticos do diretório de uploads ANTES das rotas.
app.use(UPLOADS_SERVE_PATH, express.static(UPLOADS_DIR));

// Servir arquivos estáticos do frontend (geralmente vai para ./public)
app.use(express.static(frontendBuildPath));

// NOVO: Rota para upload de imagens e documentos
app.post('/api/upload-asset', uploadFAQAsset.single('file'), async (req, res) => { // 'file' é o nome do campo no formulário
    if (!req.file) {
        return res.status(400).json({ message: 'Nenhum arquivo enviado.' });
    }

    const fileUrl = `${UPLOADS_SERVE_PATH}/${req.file.filename}`;
    let extractedText = null;

    try {
        if (req.file.mimetype === 'application/pdf') {
            extractedText = await extractTextFromPdf(req.file.path);
        } else if (req.file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            extractedText = await extractTextFromDocx(req.file.path);
        } else if (req.file.mimetype === 'text/plain') {
            extractedText = await extractTextFromTxt(req.file.path);
        }
        // Para imagens, extractedText permanece null, o que é o comportamento desejado.
        // O `imageURL` é a URL direta para o arquivo.
        // O `fileUrl` será a URL do documento se for um documento.

        res.status(200).json({
            fileUrl: fileUrl, // URL do arquivo original (imagem ou documento)
            extractedText: extractedText // Texto extraído (null para imagens)
        });

    } catch (error) {
        console.error(`Erro no processamento do arquivo ${req.file.filename}:`, error);
        // Tenta remover o arquivo se a extração falhar para evitar lixo
        try {
            await fs.unlink(req.file.path);
        } catch (unlinkError) {
            console.error(`Erro ao remover arquivo parcial ${req.file.filename}:`, unlinkError);
        }
        res.status(500).json({ message: `Erro ao processar o arquivo: ${error.message}` });
    }
});

// Rota DELETE para remover uma imagem de FAQ pelo nome do arquivo
app.delete('/api/uploads/:filename', async (req, res) => {
    const { filename } = req.params;
    const filePath = path.join(UPLOADS_DIR, filename);

    try {
        await fs.access(filePath); // Verifica se o arquivo existe
        await fs.unlink(filePath); // Remove o arquivo
        console.log(`Arquivo ${filename} removido do servidor.`);
        res.status(200).json({ message: `Arquivo ${filename} removido com sucesso.` });
    } catch (error) {
        if (error.code === 'ENOENT') {
            return res.status(404).json({ message: `Arquivo ${filename} não encontrado.` });
        }
        console.error(`Erro ao remover arquivo ${filename}:`, error);
        res.status(500).json({ message: `Erro ao remover arquivo ${filename}: ${error.message}` });
    }
});


// Função para carregar FAQs do arquivo
const loadFaqs = async () => {
    try {
        await fs.access(FAQS_FILE);
        const data = await fs.readFile(FAQS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('Arquivo faqs.json não encontrado. Inicializando com FAQs vazios.');
            return [];
        }
        console.error('Erro ao ler FAQs do arquivo:', error);
        return [];
    }
};

// Função para salvar FAQs no arquivo
const saveFaqs = async (faqs) => {
    try {
        await fs.mkdir(path.dirname(FAQS_FILE), { recursive: true });
        await fs.writeFile(FAQS_FILE, JSON.stringify(faqs, null, 2), 'utf8');
        console.log('FAQs salvos com sucesso.');
    } catch (error) {
        console.error('Erro ao salvar FAQs no arquivo:', error);
        throw new Error('Falha ao salvar FAQs.');
    }
};
// Função para extrair texto de um PDF
async function extractTextFromPdf(filePath) {
    try {
        const dataBuffer = await fs.readFile(filePath);
        const data = await pdf(dataBuffer);
        // NOVO: Limpeza básica do texto
        let cleanedText = data.text.replace(/[\uFFFD]/g, ''); // Remove o caractere de substituição (diamantes)
        cleanedText = cleanedText.replace(/\s+/g, ' ').trim(); // Normaliza múltiplos espaços e quebras de linha
        return cleanedText;
    } catch (error) {
        console.error(`Erro ao extrair texto do PDF ${filePath}:`, error);
        throw new Error('Falha ao extrair texto do PDF.');
    }
}

// Função para extrair texto de um DOCX
async function extractTextFromDocx(filePath) {
    try {
        const result = await mammoth.extractRawText({ path: filePath });
        // NOVO: Limpeza básica do texto
        let cleanedText = result.value.replace(/[\uFFFD]/g, ''); // Remove o caractere de substituição (diamantes)
        cleanedText = cleanedText.replace(/\s+/g, ' ').trim(); // Normaliza múltiplos espaços e quebras de linha
        return cleanedText;
    } catch (error) {
        console.error(`Erro ao extrair texto do DOCX ${filePath}:`, error);
        throw new Error('Falha ao extrair texto do DOCX.');
    }
}

// Função para extrair texto de um TXT
async function extractTextFromTxt(filePath) {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        // NOVO: Limpeza básica do texto
        let cleanedText = data.replace(/[\uFFFD]/g, ''); // Remove o caractere de substituição (diamantes)
        cleanedText = cleanedText.replace(/\s+/g, ' ').trim(); // Normaliza múltiplos espaços e quebras de linha
        return cleanedText;
    } catch (error) {
        console.error(`Erro ao extrair texto do TXT ${filePath}:`, error);
        throw new Error('Falha ao extrair texto do TXT.');
    }
}

// Função para verificar se a hora atual está dentro do horário de funcionamento
const isServiceTime = () => {
    // Para testar, retorne true para desabilitar a verificação de horário.
    return true; // Temporariamente para depuração
    // const now = new Date();
    // const hour = now.getHours();
    // const minute = now.getMinutes();
    // // Horário de Salvador (GMT-3)
    // const isMorning = (hour >= 7 && hour < 12);
    // const isAfternoon = (hour > 13 || (hour === 13 && minute >= 11)) && hour < 18;
    // return isMorning || isAfternoon;
};

// Exemplo de Rate Limiting Básico em Memória
const requestCounts = new Map();
const MAX_REQUESTS_PER_HOUR = 50;
const RESET_INTERVAL_MS = 60 * 60 * 1000;

setInterval(() => {
    requestCounts.clear();
    console.log("Contadores de requisições de IA resetados.");
}, RESET_INTERVAL_MS);


// Rota GET para obter todos os FAQs
app.get('/api/faqs', async (req, res) => {
    try {
        const faqs = await loadFaqs();
        res.json(faqs);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao carregar FAQs.' });
    }
});

// Rota POST para adicionar um novo FAQ
app.post('/api/faqs', async (req, res) => {
    const { question, answer, category, documentUrl, documentText } = req.body; // NOVO: Obtenha documentUrl e documentText
    if (!question || !answer || !category) {
        return res.status(400).json({ message: 'Todos os campos (Pergunta, Resposta, Categoria) são obrigatórios.' });
    }

    try {
        const faqs = await loadFaqs();
        const newFaq = { id: uuidv4(), question, answer, category, documentUrl, documentText }; // NOVO: Inclua documentUrl e documentText
        faqs.unshift(newFaq);
        await saveFaqs(faqs);
        res.status(201).json(newFaq);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao adicionar FAQ.' });
    }
});

// Rota PUT para atualizar um FAQ existente
app.put('/api/faqs/:id', async (req, res) => {
    const { id } = req.params;
    const { question, answer, category, documentUrl, documentText } = req.body; // NOVO: Obtenha documentUrl e documentText

    if (!question || !answer || !category) {
        return res.status(400).json({ message: 'Todos os campos (Pergunta, Resposta e Categoria) são obrigatórios para atualização.' });
    }

    try {
        let faqs = await loadFaqs();
        const faqIndex = faqs.findIndex(faq => faq.id === id);

        if (faqIndex === -1) {
            return res.status(404).json({ message: `FAQ com ID ${id} não encontrado.` });
        }

        // NOVO: Inclua documentUrl e documentText na atualização
        faqs[faqIndex] = { id, question, answer, category, documentUrl, documentText };

        await saveFaqs(faqs);
        res.status(200).json(faqs[faqIndex]);
    } catch (error) {
        console.error(`Erro ao atualizar FAQ com ID ${id}:`, error);
        res.status(500).json({ message: 'Erro ao atualizar FAQ.' });
    }
});

// Rota DELETE para excluir FAQs por categoria
app.delete('/api/faqs/category/:categoryName', async (req, res) => {
    const { categoryName } = req.params;

    try {
        let faqs = await loadFaqs();
        const initialLength = faqs.length;
        faqs = faqs.filter(faq => faq.category.toLowerCase() !== categoryName.toLowerCase());

        if (faqs.length === initialLength) {
            return res.status(404).json({ message: `Nenhuma FAQ encontrada para a categoria '${categoryName}'.` });
        }

        await saveFaqs(faqs);
        res.status(200).json({ message: `Todas as FAQs da categoria '${categoryName}' foram excluídas com sucesso.` });
    } catch (error) {
        console.error(`Erro ao excluir FAQs da categoria '${categoryName}':`, error);
        res.status(500).json({ message: 'Erro ao excluir FAQs por categoria.' });
    }
});

// Rota DELETE para excluir um FAQ existente
app.delete('/api/faqs/:id', async (req, res) => {
    const { id } = req.params;

    try {
        let faqs = await loadFaqs();
        const initialLength = faqs.length;
        faqs = faqs.filter(faq => faq.id !== id);

        if (faqs.length === initialLength) {
            return res.status(404).json({ message: `FAQ com ID ${id} não encontrado.` });
        }

        await saveFaqs(faqs);
        res.status(204).send();
    } catch (error) {
        console.error(`Erro ao excluir FAQ com ID ${id}:`, error);
        res.status(500).json({ message: 'Erro ao excluir FAQ.' });
    }
});

// Rota PUT para renomear uma categoria
app.put('/api/faqs/category/rename', async (req, res) => {
    const { oldCategoryName, newCategoryName } = req.body;

    if (!oldCategoryName || !newCategoryName) {
        return res.status(400).json({ message: 'Os campos oldCategoryName e newCategoryName são obrigatórios.' });
    }
    if (oldCategoryName.toLowerCase() === newCategoryName.toLowerCase()) {
        return res.status(400).json({ message: 'O novo nome da categoria deve ser diferente do antigo.' });
    }

    try {
        let faqs = await loadFaqs();
        let updatedCount = 0;

        const updatedFaqs = faqs.map(faq => {
            if (faq.category.toLowerCase() === oldCategoryName.toLowerCase()) {
                updatedCount++;
                return { ...faq, category: newCategoryName };
            }
            return faq;
        });

        if (updatedCount === 0) {
            return res.status(404).json({ message: `Nenhuma FAQ encontrada para a categoria '${oldCategoryName}'.` });
        }

        await saveFaqs(updatedFaqs);
        res.status(200).json({ message: `${updatedCount} FAQs da categoria '${oldCategoryName}' foram renomeados para '${newCategoryName}'.` });
    } catch (error) {
        console.error(`Erro ao renomear categoria de '${oldCategoryName}' para '${newCategoryName}':`, error);
        res.status(500).json({ message: 'Erro ao renomear categoria.' });
    }
});


// Rota de proxy para o Assistente de IA com controle de acesso
// Adicionado `uploadChatImage.single('image')` para lidar com upload de imagens no chat
app.post('/api/ai-chat', uploadChatImage.single('image'), async (req, res) => {
    // ... verificações de horário e rate limiting ...

    const { message, history, relevantFAQsContext } = req.body;
    const imageFile = req.file;

    // MODIFICADO: Garante que history seja sempre uma string JSON válida antes de parsear
    let formattedHistory = [];
    try {
        if (typeof history === 'string' && history.trim() !== '') {
            formattedHistory = JSON.parse(history).map((msg) => ({
                role: msg.sender === 'user' ? 'user' : 'model',
                parts: [{ text: msg.text }]
            }));
        } else {
            formattedHistory = []; // Se history não for uma string ou estiver vazio, inicializa como array vazio
        }

        const contentParts = [];

        // MODIFICADO: Adiciona o relevantFAQsContext ANTES da mensagem do usuário
        // Isso garante que o contexto seja processado primeiro pelo modelo.
        if (relevantFAQsContext) {
            contentParts.push({ text: relevantFAQsContext });
        }

        // Adiciona a mensagem do usuário
        if (message) {
            contentParts.push({ text: message });
        }

        // Se houver imagem, adiciona-a como parte 'inlineData'
        if (imageFile) {
            if (!imageFile.buffer || imageFile.buffer.length === 0) {
                console.error("Erro: Buffer da imagem está vazio ou inválido!");
                return res.status(400).json({ message: "Arquivo de imagem enviado está vazio ou corrompido." });
            }

            const imageBase64 = imageFile.buffer.toString('base64');

            let normalizedMimeType = imageFile.mimetype;
            if (normalizedMimeType === 'image/jpg') {
                normalizedMimeType = 'image/jpeg';
            }

            contentParts.push({
                inlineData: {
                    data: imageBase64,
                    mimeType: normalizedMimeType,
                },
            });
        }

        if (contentParts.length === 0) {
            return res.status(400).json({ message: "Conteúdo da requisição de IA vazio." });
        }

        console.log("Server - Final Content Parts for Gemini:", JSON.stringify(contentParts).substring(0, 500) + (JSON.stringify(contentParts).length > 500 ? '...' : ''));

        const model = ai.getGenerativeModel({
            model: GEMINI_MODEL_NAME,
            systemInstruction: { parts: [{ text: AI_SYSTEM_INSTRUCTION }] }, // A instrução está aqui!
        });

        const chatSession = model.startChat({
            history: formattedHistory,
            generationConfig: {
                temperature: 0.9,
                topK: 1,
                topP: 1,
                maxOutputTokens: 2048,
            },
        });

        const result = await chatSession.sendMessage(contentParts);
        const aiResponseText = result.response.text();

        res.json({ response: aiResponseText });
    } catch (error) {
        console.error("Erro ao chamar API Gemini via proxy:", error);
        if (error instanceof Error) {
            if (error.message && error.message.includes('API key not valid')) {
                return res.status(500).json({ message: "Erro de autenticação da API Gemini. Verifique a chave." });
            }
        }
        res.status(500).json({ message: `Erro ao processar sua solicitação de IA: ${error.message || 'Erro desconhecido.'}` });
    }
});


// Rota curinga para servir o index.html para todas as outras rotas do frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(frontendBuildPath, 'index.html'));
});

app.listen(PORT, () => { // Ouve em '0.0.0.0' para ser acessível externamente no Fly.io
    console.log(`Servidor FAQ rodando na porta ${PORT}`);
    console.log(`Diretório de uploads: ${UPLOADS_DIR}`);
});