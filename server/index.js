require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env.local') });

const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid'); // Revertido para 'uuid' padrão pois @lukeed/uuid não estava em package.json
const { GoogleGenerativeAI } = require('@google/generative-ai');
const multer = require('multer');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const util = require('util');

const { GEMINI_MODEL_NAME, AI_SYSTEM_INSTRUCTION } = require('./build/constants');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY || GEMINI_API_KEY.length === 0) {
    console.error("ERRO CRÍTICO: GEMINI_API_KEY não está definida ou está vazia na variável de ambiente.");
    console.error("Por favor, defina a variável de ambiente GEMINI_API_KEY:");
    console.error("  - Localmente: Crie um arquivo .env.local na raiz do projeto com GEMINI_API_KEY=\"SUA_CHAVE\"");
    console.error("  - No Fly.io: Execute flyctl secrets set GEMINI_API_KEY=\"SUA_CHAVE\"");
}

const ai = new GoogleGenerativeAI(GEMINI_API_KEY);

const app = express();
const PORT = process.env.PORT || 3001;

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const DATA_BASE_DIR = IS_PRODUCTION ? '/app/data' : path.join(__dirname, '..', 'data');
const UPLOADS_DIR = IS_PRODUCTION ? path.join('/app/data', 'uploads') : path.join(__dirname, '..', 'public', 'uploads');

const FAQS_FILE = path.join(DATA_BASE_DIR, 'faqs.json');
const LOG_FILE = path.join(DATA_BASE_DIR, 'faq_activity.log');
const CHAT_LOG_FILE = path.join(DATA_BASE_DIR, 'ai_chat_log.log');
const UPLOADS_SERVE_PATH = '/uploads';

const frontendBuildPath = path.join(__dirname, '..', 'public');

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

const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
    ];
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Tipo de arquivo não permitido. Apenas imagens (JPG, PNG, GIF, WEBP), PDF, DOCX e TXT são suportados.'), false);
    }
};

const uploadFAQAsset = multer({
    storage: storageFAQAssets,
    fileFilter: fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 }
});

const storageChatImage = multer.memoryStorage();
const uploadChatImage = multer({
    storage: storageChatImage,
    limits: { fileSize: 10 * 1024 * 1024 }
});

app.use(cors());
app.set('trust proxy', true);

app.use(UPLOADS_SERVE_PATH, express.static(UPLOADS_DIR));
app.use(express.static(frontendBuildPath));

const logActivity = async (action, faqId, details, ip, userAgent, userId = 'anonymous') => {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [USER_ID: ${userId}] [IP: ${ip}] [USER_AGENT: ${userAgent}] ACTION: ${action} FAQ_ID: ${faqId} DETAILS: ${JSON.stringify(details)}\n`;
    try {
        await fs.mkdir(path.dirname(LOG_FILE), { recursive: true }).catch(console.error);
        await fs.appendFile(LOG_FILE, logEntry, 'utf8');
        console.log(`Atividade logada: ${action} - ${faqId}`);
    } catch (error) {
        console.error('Erro ao escrever no arquivo de log:', error);
    }
};

const logAIChatInteraction = async (userQuestion, aiResponse, detailLevel, ip, userAgent, userId = 'anonymous') => {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [USER_ID: ${userId}] [IP: ${ip}] [USER_AGENT: ${userAgent}] QUESTION_DETAIL_LEVEL: ${detailLevel || 'N/A'} QUESTION: ${userQuestion} AI_RESPONSE_START: ${aiResponse.substring(0, 200)}...\n`;
    try {
        await fs.mkdir(path.dirname(CHAT_LOG_FILE), { recursive: true }).catch(console.error);
        await fs.appendFile(CHAT_LOG_FILE, logEntry, 'utf8');
        console.log(`Interação de chat da IA logada. Nível de detalhe: ${detailLevel}`);
    } catch (error) {
        console.error('Erro ao escrever no arquivo de log de chat da IA:', error);
    }
};

app.post('/api/upload-asset', uploadFAQAsset.single('file'), async (req, res) => {
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

        res.status(200).json({
            fileUrl: fileUrl,
            extractedText: extractedText
        });

    } catch (error) {
        console.error(`Erro no processamento do arquivo ${req.file.filename}:`, error);
        try {
            await fs.unlink(req.file.path);
        } catch (unlinkError) {
            console.error(`Erro ao remover arquivo parcial ${req.file.filename}:`, unlinkError);
        }
        res.status(500).json({ message: `Erro ao processar o arquivo: ${error.message}` });
    }
});

app.delete('/api/uploads/:filename', async (req, res) => {
    const { filename } = req.params;
    const filePath = path.join(UPLOADS_DIR, filename);

    try {
        await fs.access(filePath); // Verifica se o arquivo existe
        await fs.unlink(filePath); // Exclui o arquivo
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

const saveFaqs = async (faqs) => {
    try {
        await fs.mkdir(path.dirname(FAQS_FILE), { recursive: true }).catch(console.error);
        await fs.writeFile(FAQS_FILE, JSON.stringify(faqs, null, 2), 'utf8');
        console.log('FAQs salvos com sucesso.');
    } catch (error) {
        console.error('Erro ao salvar FAQs no arquivo:', error);
        throw new Error('Falha ao salvar FAQs.');
    }
};

async function extractTextFromPdf(filePath) {
    try {
        const dataBuffer = await fs.readFile(filePath);
        const data = await pdf(dataBuffer);
        let cleanedText = data.text.replace(/[\uFFFD]/g, '');
        cleanedText = cleanedText.replace(/\s+/g, ' ').trim();
        return cleanedText;
    } catch (error) {
        console.error(`Erro ao extrair texto do PDF ${filePath}:`, error);
        throw new Error('Falha ao extrair texto do PDF.');
    }
}

const saveChatAssetToDisk = async (fileBuffer, originalname, mimetype) => {
    return new Promise(async (resolve, reject) => {
        try {
            await fs.mkdir(UPLOADS_DIR, { recursive: true }).catch(console.error);
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const fileExtension = path.extname(originalname);
            const filename = `chat-asset-${uniqueSuffix}${fileExtension}`;
            const filePath = path.join(UPLOADS_DIR, filename);

            await fs.writeFile(filePath, fileBuffer);
            resolve({ fileUrl: `${UPLOADS_SERVE_PATH}/${filename}`, filename: filename });
        } catch (error) {
            reject(error);
        }
    });
};

async function extractTextFromDocx(filePath) {
    try {
        const result = await mammoth.extractRawText({ path: filePath });
        let cleanedText = result.value.replace(/[\uFFFD]/g, '');
        cleanedText = cleanedText.replace(/\s+/g, ' ').trim();
        return cleanedText;
    } catch (error) {
        console.error(`Erro ao extrair texto do DOCX ${filePath}:`, error);
        throw new Error('Falha ao extrair texto do DOCX.');
    }
}

async function extractTextFromTxt(filePath) {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        let cleanedText = data.replace(/[\uFFFD]/g, '');
        cleanedText = cleanedText.replace(/\s+/g, ' ').trim();
        return cleanedText;
    } catch (error) {
        console.error(`Erro ao extrair texto do TXT ${filePath}:`, error);
        throw new Error('Falha ao extrair texto do TXT.');
    }
}

// Função para extrair URLs de imagens de conteúdo HTML (sem anotações de tipo)
const extractImageUrlsFromHtml = (htmlText) => {
    const imageUrls = [];
    const imgRegex = /<img[^>]+src="(\/uploads\/[^"]+)"/g;
    let match;
    while ((match = imgRegex.exec(htmlText)) !== null) {
        imageUrls.push(match[1]);
    }
    return imageUrls;
};


const isServiceTime = () => {
    return true;
};

const requestCounts = new Map();
const MAX_REQUESTS_PER_HOUR = 50;
const RESET_INTERVAL_MS = 60 * 60 * 1000;

setInterval(() => {
    requestCounts.clear();
    console.log("Contadores de requisições de IA resetados.");
}, RESET_INTERVAL_MS);

app.get('/api/faqs', async (req, res) => {
    try {
        const faqs = await loadFaqs();
        res.json(faqs);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao carregar FAQs.' });
    }
});

app.post('/api/faqs', multer().none(), async (req, res) => {
    console.log('Backend - FULL req.body antes de desestruturar (POST):', JSON.stringify(req.body, null, 2));

    if (!req.body) {
        return res.status(400).json({ message: 'Corpo da requisição ausente ou malformado. Verifique o Content-Type.' });
    }

    const question = req.body.question;
    const answer = req.body.answer;
    const category = req.body.category;
    const documentText = req.body.documentText || undefined;
    const _attachmentsData = req.body._attachmentsData;

    let parsedAttachments;
    if (typeof _attachmentsData === 'string') {
        try {
            parsedAttachments = JSON.parse(_attachmentsData);
        } catch (e) {
            console.error('Erro ao parsear _attachmentsData (POST):', e);
            parsedAttachments = [];
        }
    } else {
        parsedAttachments = [];
    }

    console.log('Dados do FAQ recebidos no backend (POST):', { question, answer, category, _attachmentsData, documentText });
    console.log('Backend POST - parsedAttachments (garantido array):', parsedAttachments);

    const userIp = req.ip;
    const userAgent = req.headers['user-agent'];
    const userId = req.headers['x-user-id'] || 'anonymous';

    if (!question || !answer || !category) {
        return res.status(400).json({ message: 'Todos os campos (Pergunta, Resposta, Categoria) são obrigatórios.' });
    }

    try {
        const faqs = await loadFaqs();
        const newFaq = { id: uuidv4(), question, answer, category, attachments: parsedAttachments, documentText };
        faqs.unshift(newFaq);
        await saveFaqs(faqs);

        await logActivity('ADD_FAQ', newFaq.id, { question, category, attachments: parsedAttachments }, userIp, userAgent, userId);

        const reloadedFaqs = await loadFaqs();
        const savedFaq = reloadedFaqs.find(f => f.id === newFaq.id);

        if (savedFaq) {
            res.status(201).json(savedFaq);
        } else {
            console.error(`Erro: FAQ ${newFaq.id} não encontrado após recarga do disco.`);
            res.status(500).json({ message: 'Erro interno ao adicionar e verificar FAQ.' });
        }

    } catch (error) {
        console.error(`Erro ao adicionar FAQ:`, error);
        res.status(500).json({ message: 'Erro ao adicionar FAQ.' });
    }
});

app.put('/api/faqs/:id', multer().none(), async (req, res) => {
    console.log('Backend - FULL req.body antes de desestruturar (PUT):', JSON.stringify(req.body, null, 2));

    const { id } = req.params;
    const question = req.body.question;
    const answer = req.body.answer;
    const category = req.body.category;
    const documentText = req.body.documentText || undefined;
    const _attachmentsData = req.body._attachmentsData;

    let parsedAttachments;
    if (typeof _attachmentsData === 'string') {
        try {
            parsedAttachments = JSON.parse(_attachmentsData);
        } catch (e) {
            console.error('Erro ao parsear _attachmentsData (PUT):', e);
            parsedAttachments = [];
        }
    } else {
        parsedAttachments = [];
    }

    console.log('Backend - _attachmentsData recebido (frontend enviou):', _attachmentsData);
    console.log('Backend - parsedAttachments (garantido array):', parsedAttachments);

    const userIp = req.ip;
    const userAgent = req.headers['user-agent'];
    const userId = req.headers['x-user-id'] || 'anonymous';

    if (!question || !answer || !category) {
        return res.status(400).json({ message: 'Todos os campos (Pergunta, Resposta e Categoria) são obrigatórios para atualização.' });
    }

    try {
        let faqs = await loadFaqs();
        console.log('Backend - FAQs carregados do disco (antes da modificação):', faqs);

        const faqIndex = faqs.findIndex(faq => faq.id === id);

        if (faqIndex === -1) {
            console.error('Backend - Erro: FAQ não encontrado para atualização:', id);
            return res.status(404).json({ message: `FAQ com ID ${id} não encontrado.` });
        }

        const updatedFaqData = { id, question, answer, category, attachments: parsedAttachments, documentText };
        faqs[faqIndex] = updatedFaqData;

        console.log('Backend - faqs[faqIndex] (após atualização em memória, antes de salvar):', faqs[faqIndex]);

        await saveFaqs(faqs);
        console.log('Backend - saveFaqs executado. Dados salvos.');

        const reloadedFaqs = await loadFaqs();
        const savedFaq = reloadedFaqs.find(f => f.id === id);

        console.log('Backend - savedFaq (objeto recarregado do disco):', savedFaq);

        if (savedFaq) {
            res.status(200).json(savedFaq);
        } else {
            console.error(`Backend - Erro: FAQ ${id} não encontrado após recarga do disco.`);
            res.status(500).json({ message: 'Erro interno ao atualizar e verificar FAQ.' });
        }

        await logActivity('UPDATE_FAQ', id, { old: { question: faqs[faqIndex].question, category: faqs[faqIndex].category, attachments: faqs[faqIndex].attachments }, new: { question, category, attachments: parsedAttachments } }, userIp, userAgent, userId);

    } catch (error) {
        console.error(`Backend - Erro CRÍTICO ao atualizar FAQ com ID ${id}:`, error);
        res.status(500).json({ message: 'Erro ao atualizar FAQ.' });
    }
});

app.delete('/api/faqs/category/:categoryName', async (req, res) => {
    const { categoryName } = req.params;
    const userIp = req.ip;
    const userAgent = req.headers['user-agent'];
    const userId = req.headers['x-user-id'] || 'anonymous';

    try {
        let faqs = await loadFaqs();
        const initialLength = faqs.length;
        const deletedFaqsCount = faqs.filter(faq => faq.category.toLowerCase() === categoryName.toLowerCase()).length;
        faqs = faqs.filter(faq => faq.category.toLowerCase() !== categoryName.toLowerCase());

        if (faqs.length === initialLength) {
            return res.status(404).json({ message: `Nenhuma FAQ encontrada para a categoria '${categoryName}'.` });
        }

        await saveFaqs(faqs);

        await logActivity('DELETE_CATEGORY_FAQS', 'N/A', { category: categoryName, count: deletedFaqsCount }, userIp, userAgent, userId);

        res.status(200).json({ message: `Todas as FAQs da categoria '${categoryName}' foram excluídas com sucesso.` });
    } catch (error) {
        console.error(`Erro ao excluir FAQs da categoria '${categoryName}':`, error);
        res.status(500).json({ message: 'Erro ao excluir FAQs por categoria.' });
    }
});

app.delete('/api/faqs/:id', async (req, res) => {
    const { id } = req.params;
    const userIp = req.ip;
    const userAgent = req.headers['user-agent'];
    const userId = req.headers['x-user-id'] || 'anonymous';

    try {
        let faqs = await loadFaqs();
        const initialLength = faqs.length;
        const deletedFaq = faqs.find(faq => faq.id === id);
        faqs = faqs.filter(faq => faq.id !== id);

        if (faqs.length === initialLength) {
            return res.status(404).json({ message: `FAQ com ID ${id} não encontrado.` });
        }

        await saveFaqs(faqs);

        if (deletedFaq) {
            await logActivity('DELETE_FAQ', id, { question: deletedFaq.question, category: deletedFaq.category }, userIp, userAgent, userId);
        }

        res.status(204).send();
    } catch (error) {
        console.error(`Erro ao excluir FAQ com ID ${id}:`, error);
        res.status(500).json({ message: 'Erro ao excluir FAQ.' });
    }
});

app.put('/api/faqs/category/rename', async (req, res) => {
    const { oldCategoryName, newCategoryName } = req.body;
    const userIp = req.ip;
    const userAgent = req.headers['user-agent'];
    const userId = req.headers['x-user-id'] || 'anonymous';

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

        await logActivity('RENAME_CATEGORY', 'N/A', { oldCategory: oldCategoryName, newCategory: newCategoryName, count: updatedCount }, userIp, userAgent, userId);

        res.status(200).json({ message: `${updatedCount} FAQs da categoria '${oldCategoryName}' foram renomeados para '${newCategoryName}'.` });
    } catch (error) {
        console.error(`Erro ao renomear categoria de '${oldCategoryName}' para '${newCategoryName}':`, error);
        res.status(500).json({ message: 'Erro ao renomear categoria.' });
    }
});

app.post('/api/ai-chat', uploadChatImage.single('image'), async (req, res) => {
    try {
        const { message, history, relevantFAQsContext } = req.body;
        const imageFile = req.file;

        let currentAssetFileUrl = null;

        if (imageFile) {
            const savedAssetInfo = await saveChatAssetToDisk(imageFile.buffer, imageFile.originalname, imageFile.mimetype);
            currentAssetFileUrl = savedAssetInfo.fileUrl;
            console.log("Server - Chat asset salvo em:", currentAssetFileUrl);
        }

        let formattedHistory = [];
        try {
            if (typeof history === 'string' && history.trim() !== '') {
                formattedHistory = JSON.parse(history).map((msg) => ({
                    role: msg.sender === 'user' ? 'user' : 'model',
                    parts: [{ text: msg.text }]
                }));
            } else {
                formattedHistory = [];
            }
        } catch (e) {
            console.error("Erro ao parsear histórico do chat:", e);
            formattedHistory = [];
        }

        const contentParts = [];

        if (relevantFAQsContext) {
            contentParts.push({ text: relevantFAQsContext });
        }

        let userMessageText = message || "";
        if (currentAssetFileUrl) {
            userMessageText += `\n\n[ARQUIVO_ANEXADO:${currentAssetFileUrl}]`;
        }
        contentParts.push({ text: userMessageText });

        if (imageFile) {
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
            systemInstruction: { parts: [{ text: AI_SYSTEM_INSTRUCTION }] },
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
        let aiResponseText = result.response.text();

        let questionDetailLevel = null;
        const detailLevelRegex = /\[QUESTION_DETAIL_LEVEL:(Baixo|Médio|Alto)\]/i;
        const detailLevelMatch = aiResponseText.match(detailLevelRegex);

        if (detailLevelMatch && detailLevelMatch[1]) {
            questionDetailLevel = detailLevelMatch[1];
            aiResponseText = aiResponseText.replace(detailLevelRegex, '').trim();
        }

        const userIp = req.ip;
        const userAgent = req.headers['user-agent'];
        const userId = req.headers['x-user-id'] || 'anonymous';
        await logAIChatInteraction(message, aiResponseText, questionDetailLevel, userIp, userAgent, userId);


        res.json({ response: aiResponseText, userAssetUrl: currentAssetFileUrl });
    } catch (error) {
        console.error("Erro ao chamar API Gemini via proxy:", error);
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ message: `Arquivo muito grande. Limite: ${multerLimits.fileSize / (1024 * 1024)}MB.` });
        }
        res.status(500).json({ message: `Erro ao processar sua solicitação de IA: ${error.message || 'Erro desconhecido.'}` });
    }
});

app.get('/api/logs/ai-chat-activity', async (req, res) => {
    try {
        await fs.access(CHAT_LOG_FILE);
        const data = await fs.readFile(CHAT_LOG_FILE, 'utf8');
        res.status(200).type('text/plain').send(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return res.status(404).json({ message: 'Arquivo de log de atividades do chat da IA não encontrado.' });
        }
        console.error('Erro ao ler o arquivo de log do chat da IA:', error);
        res.status(500).json({ message: 'Erro ao carregar o log de atividades do chat da IA.' });
    }
});

// NOVO ENDPOINT: Limpeza de arquivos órfãos
app.delete('/api/cleanup-orphaned-files', async (req, res) => {
    const userIp = req.ip;
    const userAgent = req.headers['user-agent'];
    const userId = req.headers['x-user-id'] || 'anonymous';
    console.log(`[${new Date().toISOString()}] Iniciando limpeza de arquivos órfãos por ${userId} (${userIp})`);

    try {
        const faqs = await loadFaqs();
        // REMOVIDO: Anotação de tipo TypeScript
        const usedUrls = new Set();

        // 1. Coletar todas as URLs usadas de FAQs
        for (const faq of faqs) {
            // URLs de imagens no corpo da resposta (HTML)
            const imagesInAnswer = extractImageUrlsFromHtml(faq.answer);
            for (const url of imagesInAnswer) {
                usedUrls.add(url);
            }
            // URLs de anexos
            if (faq.attachments && Array.isArray(faq.attachments)) {
                for (const att of faq.attachments) {
                    usedUrls.add(att.url);
                }
            }
        }
        console.log("URLs usadas encontradas nos FAQs:", Array.from(usedUrls));

        // 2. Coletar todos os arquivos físicos na pasta de uploads
        let uploadedFiles;
        try {
            uploadedFiles = await fs.readdir(UPLOADS_DIR);
        } catch (readDirError) {
            console.error('Erro ao ler diretório de uploads:', readDirError);
            return res.status(500).json({ message: 'Erro ao acessar diretório de uploads.' });
        }

        let deletedCount = 0;
        let errorCount = 0;
        // REMOVIDO: Anotação de tipo TypeScript
        const deletedFilesList = [];
        // REMOVIDO: Anotação de tipo TypeScript
        const failedToDeleteList = [];

        // 3. Comparar e excluir arquivos órfãos
        for (const file of uploadedFiles) {
            const fileUrl = `${UPLOADS_SERVE_PATH}/${file}`;
            if (!usedUrls.has(fileUrl)) {
                // Se a URL do arquivo não está na lista de URLs usadas, é órfão
                const filePath = path.join(UPLOADS_DIR, file);
                try {
                    await fs.unlink(filePath);
                    console.log(`Arquivo órfão removido: ${file}`);
                    deletedCount++;
                    deletedFilesList.push(file);
                } catch (unlinkError) { // REMOVIDO: Anotação de tipo TypeScript
                    console.error(`Erro ao remover arquivo órfão ${file}:`, unlinkError);
                    errorCount++;
                    failedToDeleteList.push(`${file} (${unlinkError.message})`);
                }
            }
        }

        const message = `Limpeza concluída. ${deletedCount} arquivos órfãos removidos. ${errorCount} falhas.`;
        await logActivity('CLEANUP_ORPHANED_FILES', 'N/A', { removed: deletedFilesList, failed: failedToDeleteList }, userIp, userAgent, userId);
        console.log(message);
        res.status(200).json({ message, removedFiles: deletedFilesList, failedFiles: failedToDeleteList });

    } catch (error) {
        console.error('Erro no processo de limpeza de arquivos órfãos:', error);
        res.status(500).json({ message: `Erro interno ao limpar arquivos: ${error.message || 'Erro desconhecido.'}` });
    }
});


app.get('/api/logs/faq-activity', async (req, res) => {
    try {
        await fs.access(LOG_FILE);
        const data = await fs.readFile(LOG_FILE, 'utf8');
        res.status(200).type('text/plain').send(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return res.status(404).json({ message: 'Arquivo de log de atividades não encontrado.' });
        }
        console.error('Erro ao ler o arquivo de log:', error);
        res.status(500).json({ message: 'Erro ao carregar o log de atividades.' });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(frontendBuildPath, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Servidor FAQ rodando na porta ${PORT}`);
    console.log(`Diretório de uploads: ${UPLOADS_DIR}`);
});