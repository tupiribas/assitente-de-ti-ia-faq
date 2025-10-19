require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env.local') });

const express = require('express');
const fs = require('fs').promises; // Manter para logs e uploads
const path = require('path');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const multer = require('multer');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const util = require('util');
const { Pool } = require('pg'); // <-- ADICIONADO

const { GEMINI_MODEL_NAME, AI_SYSTEM_INSTRUCTION } = require('./build/constants');

// --- Configuração do Banco de Dados ADICIONADA ---
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    console.error("ERRO CRÍTICO: Variável de ambiente DATABASE_URL não definida!");
    // Em produção, talvez parar: process.exit(1);
} else {
    console.log("DATABASE_URL encontrada. Configurando pool de conexões PostgreSQL...");
}

const pool = new Pool({
  connectionString: connectionString,
  // Configurações SSL podem ser necessárias dependendo do ambiente, mas Fly.io geralmente funciona
//   ssl: {
//     rejectUnauthorized: false // Use com cuidado
//   }
});

// Testar conexão (opcional, ADICIONADO)
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Erro ao conectar ao PostgreSQL:', err);
  } else {
    console.log('Conectado ao PostgreSQL:', res ? res.rows[0].now : 'sem resposta');
  }
});
// --- Fim Configuração Banco de Dados ---

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

// REMOVIDO: const FAQS_FILE = path.join(DATA_BASE_DIR, 'faqs.json');
const LOG_FILE = path.join(DATA_BASE_DIR, 'faq_activity.log');
const CHAT_LOG_FILE = path.join(DATA_BASE_DIR, 'ai_chat_log.log');
const UPLOADS_SERVE_PATH = '/uploads';

const frontendBuildPath = path.join(__dirname, '..', 'public');

// --- Configuração do Multer (sem alterações) ---
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
    limits: { fileSize: 100 * 1024 * 1024 }
});

const storageChatImage = multer.memoryStorage();
const uploadChatImage = multer({
    storage: storageChatImage,
    fileFilter: fileFilter,
    limits: { fileSize: 100 * 1024 * 1024 }
});
// --- Fim Configuração Multer ---

// --- Middlewares Globais ---
app.use(cors());
app.set('trust proxy', true); // Importante para obter IP correto atrás de proxies como o do Fly.io
app.use(express.json()); // Middleware para parsear JSON bodies (necessário para PUT /category/rename)
// --- Fim Middlewares Globais ---

// --- Servir Arquivos Estáticos ---
app.use(UPLOADS_SERVE_PATH, express.static(UPLOADS_DIR)); // Servir uploads
app.use(express.static(frontendBuildPath)); // Servir o build do frontend
// --- Fim Servir Arquivos Estáticos ---

// --- Funções de Log (sem alterações) ---
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
// --- Fim Funções de Log ---

// --- Rotas de Upload e Exclusão de Arquivos (sem alterações na lógica principal) ---
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
        res.status(200).json({ fileUrl: fileUrl, extractedText: extractedText });
    } catch (error) {
        console.error(`Erro no processamento do arquivo ${req.file.filename}:`, error);
        try { await fs.unlink(req.file.path); } catch (unlinkError) { console.error(`Erro ao remover arquivo parcial ${req.file.filename}:`, unlinkError); }
        res.status(500).json({ message: `Erro ao processar o arquivo: ${error.message}` });
    }
});

app.delete('/api/uploads/:filename', async (req, res) => {
    const { filename } = req.params;
    // Validar filename para evitar path traversal
    if (filename.includes('/') || filename.includes('..')) {
        return res.status(400).json({ message: 'Nome de arquivo inválido.' });
    }
    const filePath = path.join(UPLOADS_DIR, filename);
    try {
        await fs.access(filePath); // Verifica se existe
        await fs.unlink(filePath); // Tenta remover
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
// --- Fim Rotas de Upload/Exclusão ---

// --- Funções Auxiliares de Extração de Texto e Imagem (sem alterações) ---
async function extractTextFromPdf(filePath) {
    try {
        const dataBuffer = await fs.readFile(filePath);
        const data = await pdf(dataBuffer);
        let cleanedText = data.text.replace(/[\uFFFD]/g, ''); // Remove replacement character
        cleanedText = cleanedText.replace(/\s+/g, ' ').trim(); // Normaliza espaços
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
            // Sanitizar nome do arquivo original (exemplo básico)
            const safeOriginalNameBase = path.basename(originalname, fileExtension).replace(/[^a-zA-Z0-9_-]/g, '_');
            const filename = `${safeOriginalNameBase}-${uniqueSuffix}${fileExtension}`;
            const filePath = path.join(UPLOADS_DIR, filename);
            await fs.writeFile(filePath, fileBuffer);
            resolve({ fileUrl: `${UPLOADS_SERVE_PATH}/${filename}`, filename: filename, filePath: filePath }); // Retorna filePath
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

const extractImageUrlsFromHtml = (htmlText) => {
    if (!htmlText) return [];
    const imageUrls = [];
    const imgRegex = /<img[^>]+src="(\/uploads\/[^"]+)"/g;
    let match;
    while ((match = imgRegex.exec(htmlText)) !== null) {
        if (match[1]) {
            imageUrls.push(match[1]);
        }
    }
    return imageUrls;
};
// --- Fim Funções Auxiliares ---

// --- Limitação de Requisições IA (sem alterações) ---
const requestCounts = new Map();
const MAX_REQUESTS_PER_HOUR = 50; // Ajuste conforme necessário
const RESET_INTERVAL_MS = 60 * 60 * 1000; // 1 hora

setInterval(() => {
    requestCounts.clear();
    console.log("Contadores de requisições de IA resetados.");
}, RESET_INTERVAL_MS);
// --- Fim Limitação ---


// --- ROTAS CRUD DE FAQS (SUBSTITUÍDAS) ---

app.get('/api/faqs', async (req, res) => {
    try {
        const query = `
        SELECT
            f.id, f.question, f.answer, f.category, f.document_text as "documentText",
            f.created_at as "createdAt", f.updated_at as "updatedAt",
            COALESCE(
            (SELECT json_agg(
                json_build_object(
                'id', a.id, 'url', a.url, 'name', a.name,
                'extension', a.extension, 'type', a.type
                ) ORDER BY a.created_at ASC
            )
            FROM attachments a WHERE a.faq_id = f.id),
            '[]'::json
            ) as attachments
        FROM faqs f
        ORDER BY f.created_at DESC;
        `;
        const result = await pool.query(query);
        const faqs = result.rows.map(row => ({
            ...row,
            documentText: row.documentText,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        }));
        res.json(faqs);
    } catch (error) {
        console.error('Erro ao buscar FAQs do DB:', error);
        res.status(500).json({ message: 'Erro ao carregar FAQs.' });
    }
});

app.post('/api/faqs', multer().none(), async (req, res) => {
    // Usar .none() pois os arquivos vêm de /api/upload-asset, aqui só vem os dados
    const { question, answer, category, documentText } = req.body;
    const _attachmentsData = req.body._attachmentsData; // Espera uma string JSON
    let parsedAttachments = [];
    if (_attachmentsData) {
        try {
            parsedAttachments = JSON.parse(_attachmentsData);
            if (!Array.isArray(parsedAttachments)) parsedAttachments = []; // Garante que é array
        } catch (e) {
            console.error('Erro ao parsear _attachmentsData (POST):', e);
            return res.status(400).json({ message: 'Formato inválido para _attachmentsData.' });
        }
    }
    const userIp = req.ip;
    const userAgent = req.headers['user-agent'];
    const userId = req.headers['x-user-id'] || 'anonymous';

    if (!question || !answer || !category) {
        return res.status(400).json({ message: 'Pergunta, Resposta e Categoria são obrigatórios.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const faqId = uuidv4();
        const insertFaqQuery = `
        INSERT INTO faqs (id, question, answer, category, document_text)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, question, answer, category, document_text, created_at, updated_at;
        `;
        const faqResult = await client.query(insertFaqQuery, [faqId, question, answer, category, documentText || null]);
        const newDbFaq = faqResult.rows[0];

        // Inserir anexos validados
        if (parsedAttachments.length > 0) {
        const insertAttachmentQuery = `
            INSERT INTO attachments (faq_id, url, name, extension, type)
            VALUES ($1, $2, $3, $4, $5);
        `;
        for (const att of parsedAttachments) {
            // Validação básica dos campos do anexo
            if (att.url && att.name && att.extension && att.type && ['image', 'document'].includes(att.type)) {
               await client.query(insertAttachmentQuery, [newDbFaq.id, att.url, att.name, att.extension, att.type]);
            } else {
               console.warn(`Anexo inválido ignorado durante criação do FAQ ${newDbFaq.id}:`, att);
            }
        }
        }

        await client.query('COMMIT');

        await logActivity('ADD_FAQ', newDbFaq.id, { question, category, attachmentsCount: parsedAttachments.length }, userIp, userAgent, userId);

        // Montar resposta
        const createdFaqResponse = {
            id: newDbFaq.id,
            question: newDbFaq.question,
            answer: newDbFaq.answer,
            category: newDbFaq.category,
            documentText: newDbFaq.document_text,
            createdAt: newDbFaq.created_at,
            updatedAt: newDbFaq.updated_at,
            attachments: parsedAttachments.filter(att => att.url && att.name && att.extension && att.type) // Envia apenas os válidos
        };

        res.status(201).json(createdFaqResponse);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Erro ao adicionar FAQ no DB:`, error);
        res.status(500).json({ message: 'Erro ao adicionar FAQ.' });
    } finally {
        client.release();
    }
});

app.put('/api/faqs/:id', multer().none(), async (req, res) => {
    const { id } = req.params;
    const { question, answer, category, documentText } = req.body;
    const _attachmentsData = req.body._attachmentsData;
    let parsedAttachments = [];
     if (_attachmentsData) {
        try {
            parsedAttachments = JSON.parse(_attachmentsData);
            if (!Array.isArray(parsedAttachments)) parsedAttachments = [];
        } catch (e) {
             console.error('Erro ao parsear _attachmentsData (PUT):', e);
             return res.status(400).json({ message: 'Formato inválido para _attachmentsData.' });
        }
    }
    const userIp = req.ip;
    const userAgent = req.headers['user-agent'];
    const userId = req.headers['x-user-id'] || 'anonymous';


    if (!question || !answer || !category) {
        return res.status(400).json({ message: 'Pergunta, Resposta e Categoria são obrigatórios.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const updateFaqQuery = `
        UPDATE faqs
        SET question = $1, answer = $2, category = $3, document_text = $4, updated_at = CURRENT_TIMESTAMP
        WHERE id = $5
        RETURNING id, question, answer, category, document_text, created_at, updated_at;
        `;
        const faqResult = await client.query(updateFaqQuery, [question, answer, category, documentText || null, id]);

        if (faqResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: `FAQ com ID ${id} não encontrado.` });
        }
        const updatedDbFaq = faqResult.rows[0];

        // Re-sincronizar anexos (excluir antigos, inserir novos válidos)
        await client.query('DELETE FROM attachments WHERE faq_id = $1', [id]);
        if (parsedAttachments.length > 0) {
            const insertAttachmentQuery = `
                INSERT INTO attachments (faq_id, url, name, extension, type)
                VALUES ($1, $2, $3, $4, $5);
            `;
            for (const att of parsedAttachments) {
                 if (att.url && att.name && att.extension && att.type && ['image', 'document'].includes(att.type)) {
                    await client.query(insertAttachmentQuery, [id, att.url, att.name, att.extension, att.type]);
                 } else {
                    console.warn(`Anexo inválido ignorado durante atualização do FAQ ${id}:`, att);
                 }
            }
        }

        await client.query('COMMIT');

        await logActivity('UPDATE_FAQ', id, { question, category, attachmentsCount: parsedAttachments.length }, userIp, userAgent, userId);

        // Montar resposta consistente
         const updatedFaqResponse = {
            id: updatedDbFaq.id,
            question: updatedDbFaq.question,
            answer: updatedDbFaq.answer,
            category: updatedDbFaq.category,
            documentText: updatedDbFaq.document_text,
            createdAt: updatedDbFaq.created_at,
            updatedAt: updatedDbFaq.updated_at,
            attachments: parsedAttachments.filter(att => att.url && att.name && att.extension && att.type) // Envia apenas os válidos
        };

        res.status(200).json(updatedFaqResponse);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Erro ao atualizar FAQ ${id} no DB:`, error);
        res.status(500).json({ message: 'Erro ao atualizar FAQ.' });
    } finally {
        client.release();
    }
});

app.delete('/api/faqs/:id', async (req, res) => {
    const { id } = req.params;
    const userIp = req.ip;
    const userAgent = req.headers['user-agent'];
    const userId = req.headers['x-user-id'] || 'anonymous';

    try {
        // ON DELETE CASCADE cuidará dos anexos
        const deleteFaqQuery = 'DELETE FROM faqs WHERE id = $1 RETURNING question, category;';
        const result = await pool.query(deleteFaqQuery, [id]);

        if (result.rowCount === 0) {
        return res.status(404).json({ message: `FAQ com ID ${id} não encontrado.` });
        }

        const deletedInfo = result.rows[0];
        await logActivity('DELETE_FAQ', id, { question: deletedInfo.question, category: deletedInfo.category }, userIp, userAgent, userId);

        res.status(204).send(); // No Content
    } catch (error) {
        console.error(`Erro ao excluir FAQ ${id} do DB:`, error);
        res.status(500).json({ message: 'Erro ao excluir FAQ.' });
    }
});

// --- Fim Rotas CRUD FAQs ---

// --- Rotas de Gerenciamento de Categoria (SUBSTITUÍDAS) ---
app.delete('/api/faqs/category/:categoryName', async (req, res) => {
    const { categoryName } = req.params;
    const userIp = req.ip;
    const userAgent = req.headers['user-agent'];
    const userId = req.headers['x-user-id'] || 'anonymous';

    try {
        // ON DELETE CASCADE cuidará dos anexos dos FAQs excluídos
        const deleteQuery = 'DELETE FROM faqs WHERE lower(category) = lower($1);';
        const result = await pool.query(deleteQuery, [categoryName]);

        if (result.rowCount === 0) {
            return res.status(404).json({ message: `Nenhuma FAQ encontrada para a categoria '${categoryName}'.` });
        }

        await logActivity('DELETE_CATEGORY_FAQS', 'N/A', { category: categoryName, count: result.rowCount }, userIp, userAgent, userId);

        res.status(200).json({ message: `${result.rowCount} FAQs da categoria '${categoryName}' foram excluídos com sucesso.` });
    } catch (error) {
        console.error(`Erro ao excluir FAQs da categoria '${categoryName}' do DB:`, error);
        res.status(500).json({ message: 'Erro ao excluir FAQs por categoria.' });
    }
});

app.put('/api/faqs/category/rename', async (req, res) => { // Removido express.json() daqui, pois já está global
    const { oldCategoryName, newCategoryName } = req.body;
    const userIp = req.ip;
    const userAgent = req.headers['user-agent'];
    const userId = req.headers['x-user-id'] || 'anonymous';

    if (!oldCategoryName || !newCategoryName) {
         return res.status(400).json({ message: 'Os campos oldCategoryName e newCategoryName são obrigatórios.' });
    }
    if (oldCategoryName.trim().toLowerCase() === newCategoryName.trim().toLowerCase()) {
         return res.status(400).json({ message: 'O novo nome da categoria deve ser diferente do antigo.' });
    }
    if (!newCategoryName.trim()) {
         return res.status(400).json({ message: 'O novo nome da categoria não pode estar vazio.' });
    }

    try {
        const updateQuery = 'UPDATE faqs SET category = $1, updated_at = CURRENT_TIMESTAMP WHERE lower(category) = lower($2);';
        const result = await pool.query(updateQuery, [newCategoryName.trim(), oldCategoryName.trim()]);

        if (result.rowCount === 0) {
            return res.status(404).json({ message: `Nenhuma FAQ encontrada para a categoria '${oldCategoryName}'.` });
        }

        await logActivity('RENAME_CATEGORY', 'N/A', { oldCategory: oldCategoryName, newCategory: newCategoryName, count: result.rowCount }, userIp, userAgent, userId);

        res.status(200).json({ message: `${result.rowCount} FAQs da categoria '${oldCategoryName}' foram renomeados para '${newCategoryName}'.` });
    } catch (error) {
        console.error(`Erro ao renomear categoria '${oldCategoryName}' para '${newCategoryName}' no DB:`, error);
        res.status(500).json({ message: 'Erro ao renomear categoria.' });
    }
});
// --- Fim Rotas Categoria ---


// --- Rota do Chat IA (sem alterações significativas na lógica interna) ---
app.post('/api/ai-chat', uploadChatImage.single('image'), async (req, res) => {
    // Implementação original... (verificar limites de taxa, etc.)
    const userIp = req.ip; // Obter IP para limitação de taxa
    const currentCount = requestCounts.get(userIp) || 0;

    // if (!isServiceTime()) {
    //     return res.status(503).json({ message: "O assistente de IA está disponível apenas durante o horário comercial (8h às 18h)." });
    // }

    // if (currentCount >= MAX_REQUESTS_PER_HOUR) {
    //     return res.status(429).json({ message: "Limite de requisições por hora atingido. Tente novamente mais tarde." });
    // }

    try {
        const { message, history, relevantFAQsContext } = req.body;
        const assetFile = req.file; // Renomeado de imageFile para assetFile
        let currentAssetFileUrl = null;
        let extractedFileText = null;
        let savedAssetInfo = null; // Para guardar info do arquivo salvo

        if (assetFile) {
            savedAssetInfo = await saveChatAssetToDisk(assetFile.buffer, assetFile.originalname, assetFile.mimetype);
            currentAssetFileUrl = savedAssetInfo.fileUrl;
            console.log("Server - Chat asset salvo em:", currentAssetFileUrl, "Path:", savedAssetInfo.filePath);

            // Tenta extrair texto
            if (assetFile.mimetype === 'application/pdf' && savedAssetInfo.filePath) {
                extractedFileText = await extractTextFromPdf(savedAssetInfo.filePath);
            } else if (assetFile.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' && savedAssetInfo.filePath) {
                extractedFileText = await extractTextFromDocx(savedAssetInfo.filePath);
            } else if (assetFile.mimetype === 'text/plain' && savedAssetInfo.filePath) {
                extractedFileText = await extractTextFromTxt(savedAssetInfo.filePath);
            }
        }

        let formattedHistory = [];
        try {
            if (typeof history === 'string' && history.trim() !== '') {
                formattedHistory = JSON.parse(history).map((msg) => ({
                    role: msg.sender === 'user' ? 'user' : 'model',
                    parts: [{ text: msg.text }]
                }));
            }
        } catch (e) { console.error("Erro parse history:", e); }

        const contentParts = [];
        if (relevantFAQsContext) {
            contentParts.push({ text: "--- INÍCIO CONTEXTO FAQs RELEVANTES ---\n" + relevantFAQsContext + "\n--- FIM CONTEXTO FAQs RELEVANTES ---" });
        }

        let userMessageText = message || "";
        if (currentAssetFileUrl) {
            userMessageText += `\n\n[ARQUIVO_ANEXADO:${currentAssetFileUrl}]`;
            if (extractedFileText) {
                // Limita o tamanho do texto extraído enviado para a IA
                const MAX_TEXT_LENGTH = 15000; // Ajuste conforme necessário
                const truncatedText = extractedFileText.length > MAX_TEXT_LENGTH
                    ? extractedFileText.substring(0, MAX_TEXT_LENGTH) + "... (texto truncado)"
                    : extractedFileText;
                userMessageText += `\n\n***CONTEÚDO_ANEXO_TEXTO:***\n${truncatedText}\n***FIM_CONTEÚDO_ANEXO_TEXTO***\n`;
            }
        }
        contentParts.push({ text: userMessageText });

        // Enviar imagem como inlineData APENAS se for imagem
        if (assetFile && assetFile.mimetype.startsWith('image/')) {
            const imageBase64 = assetFile.buffer.toString('base64');
            let normalizedMimeType = assetFile.mimetype === 'image/jpg' ? 'image/jpeg' : assetFile.mimetype;
            contentParts.push({
                inlineData: { data: imageBase64, mimeType: normalizedMimeType },
            });
        }

        if (contentParts.length === 0 || (contentParts.length === 1 && !contentParts[0].text && !contentParts[0].inlineData)) {
            return res.status(400).json({ message: "Mensagem vazia." });
        }

        console.log("Server - Enviando para Gemini:", JSON.stringify(contentParts, null, 2).substring(0, 500) + '...');

        const model = ai.getGenerativeModel({
            model: GEMINI_MODEL_NAME,
            systemInstruction: { parts: [{ text: AI_SYSTEM_INSTRUCTION }] },
        });
        const chatSession = model.startChat({ history: formattedHistory, /* generationConfig */ });
        const result = await chatSession.sendMessage(contentParts);
        let aiResponseText = result.response.text();

        // Extrair nível de detalhe
        let questionDetailLevel = null;
        const detailLevelRegex = /\[QUESTION_DETAIL_LEVEL:(Baixo|Médio|Alto)\]/i;
        const detailLevelMatch = aiResponseText.match(detailLevelRegex);
        if (detailLevelMatch && detailLevelMatch[1]) {
            questionDetailLevel = detailLevelMatch[1];
            aiResponseText = aiResponseText.replace(detailLevelRegex, '').trim();
        }

        // Log
        const userAgent = req.headers['user-agent'];
        const userId = req.headers['x-user-id'] || 'anonymous';
        await logAIChatInteraction(message, aiResponseText, questionDetailLevel, userIp, userAgent, userId);

        // Incrementar contador de requisições
        requestCounts.set(userIp, currentCount + 1);

        res.json({ response: aiResponseText, userAssetUrl: currentAssetFileUrl });

    } catch (error) {
        console.error("Erro ao chamar API Gemini via proxy:", error);
        let statusCode = 500;
        let errorMessage = `Erro ao processar sua solicitação de IA: ${error.message || 'Erro desconhecido.'}`;
        // Adicionar tratamento específico para erros da API Gemini se necessário
        // Ex: if (error.status === 429) { statusCode = 429; errorMessage = ... }
        if (error.code === 'LIMIT_FILE_SIZE') {
             statusCode = 413; // Payload Too Large
             errorMessage = `Arquivo muito grande. Limite: ${uploadChatImage.limits.fileSize / (1024 * 1024)}MB.`;
        }
        res.status(statusCode).json({ message: errorMessage });
    }
});
// --- Fim Rota Chat IA ---


// --- Rota de Limpeza de Arquivos Órfãos (PRECISA SER ADAPTADA) ---
app.delete('/api/cleanup-orphaned-files', async (req, res) => {
    const userIp = req.ip;
    const userAgent = req.headers['user-agent'];
    const userId = req.headers['x-user-id'] || 'anonymous';
    console.log(`[${new Date().toISOString()}] Iniciando limpeza de arquivos órfãos por ${userId} (${userIp})`);

    const client = await pool.connect(); // Usar conexão com DB
    try {
        const usedUrlsDb = new Set();

        // 1. Coletar URLs da tabela attachments
        const attachmentsResult = await client.query('SELECT url FROM attachments');
        for (const row of attachmentsResult.rows) {
            if (row.url) usedUrlsDb.add(row.url);
        }

        // 2. Coletar URLs da coluna 'answer' na tabela 'faqs'
        const faqsResult = await client.query('SELECT answer FROM faqs');
        for (const row of faqsResult.rows) {
            const imagesInAnswer = extractImageUrlsFromHtml(row.answer);
            for (const url of imagesInAnswer) {
                usedUrlsDb.add(url);
            }
        }
        console.log("URLs usadas encontradas no Banco de Dados:", Array.from(usedUrlsDb));

        // 3. Coletar arquivos físicos
        let uploadedFiles;
        try {
            uploadedFiles = await fs.readdir(UPLOADS_DIR);
        } catch (readDirError) {
             if (readDirError.code === 'ENOENT') {
                 console.log("Diretório de uploads não encontrado, nada para limpar.");
                 return res.status(200).json({ message: "Diretório de uploads não encontrado, nada para limpar.", removedFiles: [], failedFiles: [] });
             }
            console.error('Erro ao ler diretório de uploads:', readDirError);
            return res.status(500).json({ message: 'Erro ao acessar diretório de uploads.' });
        }

        let deletedCount = 0;
        let errorCount = 0;
        const deletedFilesList = [];
        const failedToDeleteList = [];

        // 4. Comparar e excluir
        for (const file of uploadedFiles) {
            const fileUrl = `${UPLOADS_SERVE_PATH}/${file}`;
            if (!usedUrlsDb.has(fileUrl)) {
                const filePath = path.join(UPLOADS_DIR, file);
                try {
                    await fs.unlink(filePath);
                    console.log(`Arquivo órfão removido: ${file}`);
                    deletedCount++;
                    deletedFilesList.push(file);
                } catch (unlinkError) {
                    console.error(`Erro ao remover arquivo órfão ${file}:`, unlinkError);
                    errorCount++;
                    failedToDeleteList.push(`${file} (${unlinkError.message})`);
                }
            }
        }

        const message = `Limpeza concluída. ${deletedCount} arquivos órfãos removidos. ${errorCount} falhas.`;
        await logActivity('CLEANUP_ORPHANED_FILES', 'N/A', { removedCount: deletedCount, failedCount: errorCount, removed: deletedFilesList, failed: failedToDeleteList }, userIp, userAgent, userId);
        console.log(message);
        res.status(200).json({ message, removedFiles: deletedFilesList, failedFiles: failedToDeleteList });

    } catch (error) {
        console.error('Erro no processo de limpeza de arquivos órfãos:', error);
        res.status(500).json({ message: `Erro interno ao limpar arquivos: ${error.message || 'Erro desconhecido.'}` });
    } finally {
        if(client) client.release(); // Liberar conexão com DB
    }
});
// --- Fim Rota Limpeza ---


// --- Rotas de Log (sem alterações) ---
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
// --- Fim Rotas Log ---

// --- Rota Catch-all para Frontend (sem alterações) ---
app.get('*', (req, res) => {
    // Evitar servir index.html para caminhos de API inexistentes
    if (req.path.startsWith('/api/')) {
        return res.status(404).send('Not Found');
    }
    res.sendFile(path.join(frontendBuildPath, 'index.html'));
});
// --- Fim Catch-all ---

// --- Inicialização do Servidor (sem alterações) ---
app.listen(PORT, '0.0.0.0', () => { // Adicionado '0.0.0.0' para garantir que escute externamente no container
    console.log(`Servidor FAQ rodando na porta ${PORT}`);
    console.log(`Diretório de uploads servido de: ${UPLOADS_DIR}`);
    console.log(`Build do frontend servido de: ${frontendBuildPath}`);
    console.log(`Modo Produção: ${IS_PRODUCTION}`);
});
// --- Fim Inicialização ---