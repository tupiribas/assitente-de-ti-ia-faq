const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { GoogleGenAI } = require('@google/genai');
const multer = require('multer');

// Importar do diretório de build após compilação.
// Este caminho é consistente para desenvolvimento e produção.
const { GEMINI_MODEL_NAME, AI_SYSTEM_INSTRUCTION } = require('./build/constants');

// Certifique-se de que a API_KEY está disponível como uma variável de ambiente no servidor Fly.io
const GEMINI_API_KEY_SERVER = process.env.GEMINI_API_KEY;

// Inicializa o cliente GoogleGenAI globalmente (isso está correto)
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY_SERVER });

const app = express();
const PORT = process.env.PORT || 3001;

const FAQS_FILE = path.join('/app/data', 'faqs.json'); // FAQ File está no volume persistente
const frontendBuildPath = path.join(__dirname, '..', 'public');

// CORRIGIDO: Diretório para uploads de imagens e documentos.
// AGORA DENTRO DO VOLUME PERSISTENTE '/app/data' para garantir que as imagens não sejam perdidas.
const UPLOADS_DIR = path.join('/app/data', 'uploads');
const UPLOADS_SERVE_PATH = '/uploads'; // Caminho público para acessar as imagens

// Configuração do Multer para armazenamento
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        // Garante que o diretório de uploads exista no volume persistente
        await fs.mkdir(UPLOADS_DIR, { recursive: true }).catch(console.error);
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileExtension = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + fileExtension);
    }
});
const upload = multer({ storage: storage });

// Middlewares
app.use(cors());
app.use(express.json());

// CORRIGIDO: Servir arquivos estáticos do diretório de uploads ANTES das rotas.
// Isso garante que as imagens carregadas sejam acessíveis via URL /uploads/...
app.use(UPLOADS_SERVE_PATH, express.static(UPLOADS_DIR));

// Servir arquivos estáticos do frontend (geralmente vai para ./public)
app.use(express.static(frontendBuildPath));


// Rota para upload de imagens
app.post('/api/upload-image', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'Nenhum arquivo enviado.' });
    }
    // Retorna a URL pública da imagem. O caminho público é UPLOADS_SERVE_PATH.
    const imageUrl = `${UPLOADS_SERVE_PATH}/${req.file.filename}`;
    res.status(200).json({ imageUrl: imageUrl });
});

// NOVO: Rota DELETE para remover uma imagem pelo nome do arquivo
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

// Função para verificar se a hora atual está dentro do horário de funcionamento
const isServiceTime = () => {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();

    // Horário de Salvador (GMT-3)
    const isMorning = (hour >= 7 && hour < 12);
    const isAfternoon = (hour > 13 || (hour === 13 && minute >= 11)) && hour < 18;

    return isMorning || isAfternoon;
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
    const { question, answer, category } = req.body;
    if (!question || !answer || !category) {
        return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
    }

    try {
        const faqs = await loadFaqs();
        const newFaq = { id: uuidv4(), question, answer, category };
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
    const { question, answer, category } = req.body;

    if (!question || !answer || !category) {
        return res.status(400).json({ message: 'Todos os campos (Pergunta, Resposta e Categoria) são obrigatórios para atualização.' });
    }

    try {
        let faqs = await loadFaqs();
        const faqIndex = faqs.findIndex(faq => faq.id === id);

        if (faqIndex === -1) {
            return res.status(404).json({ message: `FAQ com ID ${id} não encontrado.` });
        }

        faqs[faqIndex] = { id, question, answer, category };

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
app.post('/api/ai-chat', async (req, res) => {
    // 1. Verificação de Horário
    if (!isServiceTime()) {
        return res.status(403).json({ message: "Serviço de Assistente de IA indisponível fora do horário de funcionamento (7h-12h e 13h11-18h, horário de Salvador)." });
    }

    // 2. Verificação de Rate Limiting (Básico)
    const clientIp = req.ip; // Obtém o IP do cliente
    const currentCount = requestCounts.get(clientIp) || 0;

    if (currentCount >= MAX_REQUESTS_PER_HOUR) {
        return res.status(429).json({ message: `Limite de requisições de IA atingido (${MAX_REQUESTS_PER_HOUR} por hora). Tente novamente mais tarde.` });
    }
    requestCounts.set(clientIp, currentCount + 1);
    console.log(`Requisição de IA de ${clientIp}. Total: ${currentCount + 1}`);


    // 3. Chamar a API Gemini
    try {
        const { message, history, relevantFAQsContext } = req.body; // Recebe a mensagem e o histórico do frontend

        if (!message) {
            return res.status(400).json({ message: "Mensagem é obrigatória." });
        }

        // CORREÇÃO AQUI: Obter o modelo e iniciar o chat PARA CADA REQUISIÇÃO
        // (Isso já estava no código anterior que te dei, mas reconfirmo aqui a forma correta)
        const model = ai.getGenerativeModel(GEMINI_MODEL_NAME); // Correct usage: pass model name as string

        const chatSession = model.startChat({ // Start chat session from the model
            history: history, // Usa o histórico passado pelo frontend
            generationConfig: {
                temperature: 0.9,
                topK: 1,
                topP: 1,
                maxOutputTokens: 2048,
            },
            systemInstruction: AI_SYSTEM_INSTRUCTION, // Usa as instruções do constants.ts
        });

        const promptForAI = relevantFAQsContext ? relevantFAQsContext + message : message;

        const result = await chatSession.sendMessage({ message: promptForAI });
        const aiResponseText = result.text;

        res.json({ response: aiResponseText }); // Retorna a resposta da IA para o frontend
    } catch (error) {
        console.error("Erro ao chamar API Gemini via proxy:", error);
        if (error.message && error.message.includes('API key not valid')) {
            return res.status(500).json({ message: "Erro de autenticação da API Gemini. Verifique a chave." });
        }
        res.status(500).json({ message: "Erro ao processar sua solicitação de IA." });
    }
});


// Rota curinga para servir o index.html para todas as outras rotas do frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(frontendBuildPath, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Servidor FAQ rodando na porta ${PORT}`);
    console.log(`Diretório de uploads: ${UPLOADS_DIR}`);
});