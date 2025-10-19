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
const { Pool } = require('pg');
// --- NOVAS DEPENDÊNCIAS PARA AUTH ---
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const bcrypt = require('bcrypt');
const crypto = require('crypto');
// --- FIM NOVAS DEPENDÊNCIAS ---

const { GEMINI_MODEL_NAME, AI_SYSTEM_INSTRUCTION } = require('./build/constants');

// --- Configuração do Banco de Dados ---
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    console.error("ERRO CRÍTICO: Variável de ambiente DATABASE_URL não definida!");
    process.exit(1); // Parar se não houver DB em produção
} else {
    console.log("DATABASE_URL encontrada. Configurando pool de conexões PostgreSQL...");
}

const pool = new Pool({
  connectionString: connectionString,
  // ssl: { rejectUnauthorized: false } // Descomente se necessário para Fly.io localmente
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Erro ao conectar ao PostgreSQL:', err);
  } else {
    console.log('Conectado ao PostgreSQL:', res ? res.rows[0].now : 'sem resposta');
  }
});
// --- Fim Configuração Banco de Dados ---

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// ... (Verificação da GEMINI_API_KEY) ...
const ai = new GoogleGenerativeAI(GEMINI_API_KEY);

const app = express();
const PORT = process.env.PORT || 3001;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const DATA_BASE_DIR = IS_PRODUCTION ? '/app/data' : path.join(__dirname, '..', 'data');
const UPLOADS_DIR = IS_PRODUCTION ? path.join('/app/data', 'uploads') : path.join(__dirname, '..', 'public', 'uploads');
const LOG_FILE = path.join(DATA_BASE_DIR, 'faq_activity.log');
const CHAT_LOG_FILE = path.join(DATA_BASE_DIR, 'ai_chat_log.log');
const UPLOADS_SERVE_PATH = '/uploads';
const frontendBuildPath = path.join(__dirname, '..', 'public');

// --- Configuração do Multer (sem alterações) ---
// ... (código do storageFAQAssets, fileFilter, uploadFAQAsset, storageChatImage, uploadChatImage) ...
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
app.use(cors({
    origin: IS_PRODUCTION ? 'https://seu-assistente-de-ti-ia-e-faq.fly.dev' : 'http://localhost:5173', // Ajuste a origem do frontend local se for diferente
    credentials: true // Permite envio de cookies (para sessão)
}));
app.set('trust proxy', 1); // Confia no primeiro proxy (Fly.io) para req.ip e req.protocol
app.use(express.json()); // Middleware para parsear JSON bodies
// --- Fim Middlewares Globais ---

// --- Configuração de Sessão ---
const SESSION_SECRET = process.env.SESSION_SECRET || 'seu-segredo-super-secreto-padrao';
if (SESSION_SECRET === 'seu-segredo-super-secreto-padrao' && IS_PRODUCTION) {
  console.warn('\n\n!!! AVISO: Usando segredo de sessão padrão em produção !!!\n Defina um segredo forte via: fly secrets set SESSION_SECRET=$(openssl rand -hex 32)\n\n');
}

app.use(session({
  store: new PgSession({
    pool: pool,
    tableName: 'user_sessions',
    createTableIfMissing: true // Cria a tabela se não existir
  }),
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: IS_PRODUCTION,
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 dias
    sameSite: 'lax' // Ou 'strict' se preferir mais segurança, mas pode quebrar alguns fluxos
  }
}));

// Middleware para adicionar req.user
app.use((req, res, next) => {
  if (req.session && req.session.user) {
    req.user = req.session.user;
  } else {
    req.user = null;
  }
  next();
});
// --- Fim Configuração de Sessão ---


// --- Servir Arquivos Estáticos ---
app.use(UPLOADS_SERVE_PATH, express.static(UPLOADS_DIR));
app.use(express.static(frontendBuildPath));
// --- Fim Servir Arquivos Estáticos ---

// --- Funções de Log (Atualizada para aceitar userId corretamente) ---
const logActivity = async (action, targetId, details, ip, userAgent, userId = 'anonymous') => {
    const timestamp = new Date().toISOString();
    // Garante que userId seja uma string, mesmo que venha como undefined da sessão
    const finalUserId = userId || 'anonymous';
    const logEntry = `[${timestamp}] [USER_ID: ${finalUserId}] [IP: ${ip}] [USER_AGENT: ${userAgent}] ACTION: ${action} TARGET_ID: ${targetId || 'N/A'} DETAILS: ${JSON.stringify(details)}\n`;
    try {
        await fs.mkdir(path.dirname(LOG_FILE), { recursive: true }).catch(console.error);
        await fs.appendFile(LOG_FILE, logEntry, 'utf8');
        console.log(`Audit log: ${action} by ${finalUserId} on ${targetId || 'N/A'}`);
    } catch (error) {
        console.error('Erro ao escrever no arquivo de log de auditoria:', error);
    }
};

const logAIChatInteraction = async (userQuestion, aiResponse, detailLevel, ip, userAgent, userId = 'anonymous') => {
    // ...(implementação existente) ...
};
// --- Fim Funções de Log ---

// --- Middlewares de Autorização ---
const isAuthenticated = (req, res, next) => {
  if (req.user) { // Verifica req.user que foi setado pelo middleware anterior
    next();
  } else {
    res.status(401).json({ message: 'Acesso não autorizado. Faça login.' });
  }
};

const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Acesso proibido. Requer privilégios de administrador.' });
  }
};

const isEditorOrAdmin = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'editor')) {
    next();
  } else {
    res.status(403).json({ message: 'Acesso proibido. Requer privilégios de editor ou administrador.' });
  }
};
// --- Fim Middlewares de Autorização ---

// --- Rotas de Autenticação ---
const SALT_ROUNDS = 10;

app.post('/api/auth/login', async (req, res) => { // Removido express.json() daqui, já está global
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Usuário e senha são obrigatórios.' });
  }
  try {
    const result = await pool.query('SELECT id, username, password_hash, role FROM users WHERE username = $1', [username]);
    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ message: 'Usuário ou senha inválidos.' }); // Resposta genérica
    }
    const match = await bcrypt.compare(password, user.password_hash);
    if (match) {
      req.session.user = { id: user.id, username: user.username, role: user.role };
      console.log(`Login successful for user: ${user.username}`);
      res.json({ id: user.id, username: user.username, role: user.role });
    } else {
      console.log(`Login failed for user: ${username} (invalid password)`);
      res.status(401).json({ message: 'Usuário ou senha inválidos.' }); // Resposta genérica
    }
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ message: 'Erro interno no servidor durante o login.' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  const username = req.session.user ? req.session.user.username : 'unknown';
  req.session.destroy(err => {
    if (err) {
      console.error("Erro ao destruir sessão:", err);
      return res.status(500).json({ message: 'Erro ao fazer logout.' });
    }
    res.clearCookie('connect.sid'); // Nome padrão do cookie do express-session
    console.log(`Logout successful for user: ${username}`);
    res.status(200).json({ message: 'Logout bem-sucedido.' });
  });
});

app.get('/api/auth/status', (req, res) => {
  if (req.user) { // Usa req.user populado pelo middleware
    res.json({ loggedIn: true, user: req.user });
  } else {
    res.json({ loggedIn: false, user: null });
  }
});
// --- Fim Rotas de Autenticação ---

// --- Rotas de Upload e Exclusão de Arquivos (PROTEGIDAS e com LOG) ---
app.post('/api/upload-asset', isEditorOrAdmin, uploadFAQAsset.single('file'), async (req, res) => {
    const userIp = req.ip;
    const userAgent = req.headers['user-agent'];
    const userId = req.user.id; // Usuário está autenticado aqui
    const username = req.user.username;

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

        // Log do Upload
        await logActivity(
            'UPLOAD_ASSET',
            req.file.filename,
            { filename: req.file.filename, mimetype: req.file.mimetype, size: req.file.size, uploadedBy: username },
            userIp,
            userAgent,
            userId
        );

        res.status(200).json({ fileUrl: fileUrl, extractedText: extractedText });
    } catch (error) {
        console.error(`Erro no processamento do arquivo ${req.file.filename}:`, error);
        try { await fs.unlink(req.file.path); } catch (unlinkError) { console.error(`Erro ao remover arquivo parcial ${req.file.filename}:`, unlinkError); }
        res.status(500).json({ message: `Erro ao processar o arquivo: ${error.message}` });
    }
});

app.delete('/api/uploads/:filename', isEditorOrAdmin, async (req, res) => {
    const { filename } = req.params;
    const userIp = req.ip;
    const userAgent = req.headers['user-agent'];
    const userId = req.user.id;
    const username = req.user.username;

    if (filename.includes('/') || filename.includes('..')) {
        return res.status(400).json({ message: 'Nome de arquivo inválido.' });
    }
    const filePath = path.join(UPLOADS_DIR, filename);
    try {
        await fs.access(filePath);
        await fs.unlink(filePath);
        console.log(`Arquivo ${filename} removido do servidor por ${username}.`);

        // Log da Exclusão
        await logActivity(
            'DELETE_ASSET',
            filename,
            { filename: filename, deletedBy: username },
            userIp,
            userAgent,
            userId
        );

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

// --- Funções Auxiliares (sem alterações) ---
// ... (extractTextFromPdf, saveChatAssetToDisk, extractTextFromDocx, extractTextFromTxt, extractImageUrlsFromHtml) ...
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
// ... (código requestCounts, MAX_REQUESTS_PER_HOUR, etc.) ...
const requestCounts = new Map();
const MAX_REQUESTS_PER_HOUR = 50; // Ajuste conforme necessário
const RESET_INTERVAL_MS = 60 * 60 * 1000; // 1 hora

setInterval(() => {
    requestCounts.clear();
    console.log("Contadores de requisições de IA resetados.");
}, RESET_INTERVAL_MS);
// --- Fim Limitação ---


// --- ROTAS CRUD DE FAQS (PROTEGIDAS e com LOG ATUALIZADO) ---

// GET /api/faqs (NÃO PROTEGIDA - Qualquer um pode ler)
app.get('/api/faqs', async (req, res) => {
    try {
        const query = `
        SELECT
            f.id, f.question, f.answer, f.category, f.document_text as "documentText",
            f.created_at as "createdAt", f.updated_at as "updatedAt",
            COALESCE(/* ... query para agregar anexos ... */
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
        const faqs = result.rows.map(row => ({ /* ... mapeamento ... */
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

// POST /api/faqs (PROTEGIDA)
app.post('/api/faqs', isEditorOrAdmin, multer().none(), async (req, res) => {
    const { question, answer, category, documentText } = req.body;
    const _attachmentsData = req.body._attachmentsData;
    let parsedAttachments = [];
    if (_attachmentsData) { /* ... parse anexo ... */
        try {
            parsedAttachments = JSON.parse(_attachmentsData);
            if (!Array.isArray(parsedAttachments)) parsedAttachments = [];
        } catch (e) {
            console.error('Erro ao parsear _attachmentsData (POST):', e);
            return res.status(400).json({ message: 'Formato inválido para _attachmentsData.' });
        }
    }
    const userIp = req.ip;
    const userAgent = req.headers['user-agent'];
    const userId = req.user.id; // Usuário autenticado
    const username = req.user.username;

    if (!question || !answer || !category) { /* ... validação ... */
        return res.status(400).json({ message: 'Pergunta, Resposta e Categoria são obrigatórios.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const faqId = uuidv4();
        const insertFaqQuery = `/* ... query INSERT ... */
        INSERT INTO faqs (id, question, answer, category, document_text)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, question, answer, category, document_text, created_at, updated_at;
        `;
        const faqResult = await client.query(insertFaqQuery, [faqId, question, answer, category, documentText || null]);
        const newDbFaq = faqResult.rows[0];
        if (parsedAttachments.length > 0) { /* ... inserir anexos ... */
            const insertAttachmentQuery = `
                INSERT INTO attachments (faq_id, url, name, extension, type)
                VALUES ($1, $2, $3, $4, $5);
            `;
            for (const att of parsedAttachments) {
                if (att.url && att.name && att.extension && att.type && ['image', 'document'].includes(att.type)) {
                   await client.query(insertAttachmentQuery, [newDbFaq.id, att.url, att.name, att.extension, att.type]);
                } else {
                   console.warn(`Anexo inválido ignorado durante criação do FAQ ${newDbFaq.id}:`, att);
                }
            }
        }
        await client.query('COMMIT');

        // Log ATUALIZADO
        await logActivity(
            'ADD_FAQ',
            newDbFaq.id,
            { question, category, attachmentsCount: parsedAttachments.length, performedBy: username },
            userIp,
            userAgent,
            userId // Passa ID do usuário logado
        );

        const createdFaqResponse = { /* ... montar resposta ... */
            id: newDbFaq.id,
            question: newDbFaq.question,
            answer: newDbFaq.answer,
            category: newDbFaq.category,
            documentText: newDbFaq.document_text,
            createdAt: newDbFaq.created_at,
            updatedAt: newDbFaq.updated_at,
            attachments: parsedAttachments.filter(att => att.url && att.name && att.extension && att.type)
        };
        res.status(201).json(createdFaqResponse);
    } catch (error) { /* ... erro ... */
        await client.query('ROLLBACK');
        console.error(`Erro ao adicionar FAQ no DB:`, error);
        res.status(500).json({ message: 'Erro ao adicionar FAQ.' });
    } finally {
        client.release();
    }
});

// PUT /api/faqs/:id (PROTEGIDA)
app.put('/api/faqs/:id', isEditorOrAdmin, multer().none(), async (req, res) => {
    const { id } = req.params;
    const { question, answer, category, documentText } = req.body;
    const _attachmentsData = req.body._attachmentsData;
    let parsedAttachments = [];
    if (_attachmentsData) { /* ... parse anexo ... */
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
    const userId = req.user.id; // Usuário autenticado
    const username = req.user.username;

    if (!question || !answer || !category) { /* ... validação ... */
        return res.status(400).json({ message: 'Pergunta, Resposta e Categoria são obrigatórios.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const updateFaqQuery = `/* ... query UPDATE ... */
        UPDATE faqs
        SET question = $1, answer = $2, category = $3, document_text = $4, updated_at = CURRENT_TIMESTAMP
        WHERE id = $5
        RETURNING id, question, answer, category, document_text, created_at, updated_at;
        `;
        const faqResult = await client.query(updateFaqQuery, [question, answer, category, documentText || null, id]);
        if (faqResult.rowCount === 0) { /* ... FAQ não encontrado ... */
            await client.query('ROLLBACK');
            return res.status(404).json({ message: `FAQ com ID ${id} não encontrado.` });
        }
        const updatedDbFaq = faqResult.rows[0];
        // Re-sincronizar anexos
        await client.query('DELETE FROM attachments WHERE faq_id = $1', [id]);
        if (parsedAttachments.length > 0) { /* ... inserir anexos ... */
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

        // Log ATUALIZADO
        await logActivity(
            'UPDATE_FAQ',
            id,
            { question, category, attachmentsCount: parsedAttachments.length, performedBy: username },
            userIp,
            userAgent,
            userId // Passa ID do usuário logado
        );

        const updatedFaqResponse = { /* ... montar resposta ... */
            id: updatedDbFaq.id,
            question: updatedDbFaq.question,
            answer: updatedDbFaq.answer,
            category: updatedDbFaq.category,
            documentText: updatedDbFaq.document_text,
            createdAt: updatedDbFaq.created_at,
            updatedAt: updatedDbFaq.updated_at,
            attachments: parsedAttachments.filter(att => att.url && att.name && att.extension && att.type)
        };
        res.status(200).json(updatedFaqResponse);
    } catch (error) { /* ... erro ... */
        await client.query('ROLLBACK');
        console.error(`Erro ao atualizar FAQ ${id} no DB:`, error);
        res.status(500).json({ message: 'Erro ao atualizar FAQ.' });
    } finally {
        client.release();
    }
});

// DELETE /api/faqs/:id (PROTEGIDA)
app.delete('/api/faqs/:id', isEditorOrAdmin, async (req, res) => {
    const { id } = req.params;
    const userIp = req.ip;
    const userAgent = req.headers['user-agent'];
    const userId = req.user.id; // Usuário autenticado
    const username = req.user.username;

    try {
        const deleteFaqQuery = 'DELETE FROM faqs WHERE id = $1 RETURNING question, category;';
        const result = await pool.query(deleteFaqQuery, [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ message: `FAQ com ID ${id} não encontrado.` });
        }
        const deletedInfo = result.rows[0];

        // Log ATUALIZADO
        await logActivity(
            'DELETE_FAQ',
            id,
            { question: deletedInfo.question, category: deletedInfo.category, performedBy: username },
            userIp,
            userAgent,
            userId // Passa ID do usuário logado
        );

        res.status(204).send();
    } catch (error) { /* ... erro ... */
        console.error(`Erro ao excluir FAQ ${id} do DB:`, error);
        res.status(500).json({ message: 'Erro ao excluir FAQ.' });
    }
});
// --- Fim Rotas CRUD FAQs ---

// --- Rotas de Gerenciamento de Categoria (PROTEGIDAS e com LOG ATUALIZADO) ---
app.delete('/api/faqs/category/:categoryName', isEditorOrAdmin, async (req, res) => {
    const { categoryName } = req.params;
    const userIp = req.ip;
    const userAgent = req.headers['user-agent'];
    const userId = req.user.id; // Usuário autenticado
    const username = req.user.username;

    try {
        const deleteQuery = 'DELETE FROM faqs WHERE lower(category) = lower($1);';
        const result = await pool.query(deleteQuery, [categoryName]);
        if (result.rowCount === 0) {
            return res.status(404).json({ message: `Nenhuma FAQ encontrada para a categoria '${categoryName}'.` });
        }

        // Log ATUALIZADO
        await logActivity(
            'DELETE_CATEGORY_FAQS',
            null, // Sem ID específico de target
            { category: categoryName, count: result.rowCount, performedBy: username },
            userIp,
            userAgent,
            userId // Passa ID do usuário logado
        );

        res.status(200).json({ message: `${result.rowCount} FAQs da categoria '${categoryName}' foram excluídos com sucesso.` });
    } catch (error) { /* ... erro ... */
        console.error(`Erro ao excluir FAQs da categoria '${categoryName}' do DB:`, error);
        res.status(500).json({ message: 'Erro ao excluir FAQs por categoria.' });
    }
});

app.put('/api/faqs/category/rename', isEditorOrAdmin, async (req, res) => {
    const { oldCategoryName, newCategoryName } = req.body;
    const userIp = req.ip;
    const userAgent = req.headers['user-agent'];
    const userId = req.user.id; // Usuário autenticado
    const username = req.user.username;

    // ... (validações) ...
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

        // Log ATUALIZADO
        await logActivity(
            'RENAME_CATEGORY',
            null, // Sem ID específico de target
            { oldCategory: oldCategoryName, newCategory: newCategoryName, count: result.rowCount, performedBy: username },
            userIp,
            userAgent,
            userId // Passa ID do usuário logado
        );

        res.status(200).json({ message: `${result.rowCount} FAQs da categoria '${oldCategoryName}' foram renomeados para '${newCategoryName}'.` });
    } catch (error) { /* ... erro ... */
        console.error(`Erro ao renomear categoria '${oldCategoryName}' para '${newCategoryName}' no DB:`, error);
        res.status(500).json({ message: 'Erro ao renomear categoria.' });
    }
});
// --- Fim Rotas Categoria ---

// --- Rota do Chat IA (sem alterações na proteção ou lógica principal) ---
// Note: Adicionar log de auditoria aqui pode ser excessivo, mas pode-se logar quem iniciou a conversa se necessário.
app.post('/api/ai-chat', uploadChatImage.single('image'), async (req, res) => {
    // ... (lógica existente, incluindo logAIChatInteraction) ...
});
// --- Fim Rota Chat IA ---

// --- Rota de Limpeza de Arquivos Órfãos (PROTEGIDA com isAdmin e LOG ATUALIZADO) ---
app.delete('/api/cleanup-orphaned-files', isAdmin, async (req, res) => {
    const userIp = req.ip;
    const userAgent = req.headers['user-agent'];
    const userId = req.user.id; // Admin autenticado
    const username = req.user.username;
    console.log(`[${new Date().toISOString()}] Iniciando limpeza de arquivos órfãos por ${username} (${userId})`);

    const client = await pool.connect();
    try {
        const usedUrlsDb = new Set();
        // ... (coletar URLs do DB) ...
        const attachmentsResult = await client.query('SELECT url FROM attachments');
        for (const row of attachmentsResult.rows) {
            if (row.url) usedUrlsDb.add(row.url);
        }
        const faqsResult = await client.query('SELECT answer FROM faqs');
        for (const row of faqsResult.rows) {
            const imagesInAnswer = extractImageUrlsFromHtml(row.answer);
            for (const url of imagesInAnswer) {
                usedUrlsDb.add(url);
            }
        }

        // ... (coletar arquivos físicos e comparar/excluir) ...
        let uploadedFiles;
        try { uploadedFiles = await fs.readdir(UPLOADS_DIR); } catch (readDirError) { /* ... tratamento ENOENT ... */ }
        let deletedCount = 0;
        let errorCount = 0;
        const deletedFilesList = [];
        const failedToDeleteList = [];
        for (const file of uploadedFiles) { /* ... lógica de exclusão ... */ }


        const message = `Limpeza concluída. ${deletedCount} arquivos órfãos removidos. ${errorCount} falhas.`;

        // Log ATUALIZADO
        await logActivity(
            'CLEANUP_ORPHANED_FILES',
            null,
            { removedCount: deletedCount, failedCount: errorCount, performedBy: username },
            userIp,
            userAgent,
            userId // Passa ID do admin
        );

        console.log(message);
        res.status(200).json({ message, removedFiles: deletedFilesList, failedFiles: failedToDeleteList });

    } catch (error) { /* ... erro ... */
        console.error('Erro no processo de limpeza de arquivos órfãos:', error);
        res.status(500).json({ message: `Erro interno ao limpar arquivos: ${error.message || 'Erro desconhecido.'}` });
    } finally {
        if(client) client.release();
    }
});
// --- Fim Rota Limpeza ---

// --- NOVAS ROTAS DE ADMINISTRAÇÃO DE USUÁRIOS (PROTEGIDAS e com LOG) ---
app.get('/api/admin/users', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, role, created_at FROM users ORDER BY username');
    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao listar usuários:", error);
    res.status(500).json({ message: 'Erro ao buscar usuários.' });
  }
});

app.post('/api/admin/users', isAuthenticated, isAdmin, async (req, res) => { // Removido express.json()
  const { username, password, role } = req.body;
  const userIp = req.ip;
  const userAgent = req.headers['user-agent'];
  const adminUserId = req.user.id;
  const adminUsername = req.user.username;

  if (!username || !password || !role || !['admin', 'editor'].includes(role)) { /* ... validação ... */ }
  if (password.length < 8) { /* ... validação senha ... */ }

  try {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await pool.query(
      'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id, username, role, created_at',
      [username, passwordHash, role]
    );
    const newUser = result.rows[0];

    await logActivity(
        'CREATE_USER',
        newUser.id,
        { username: newUser.username, role: newUser.role, createdBy: adminUsername },
        userIp,
        userAgent,
        adminUserId
    );

    res.status(201).json(newUser);
  } catch (error) { /* ... tratamento erro unique constraint e outros ... */
      console.error("Erro ao criar usuário:", error);
      if (error.code === '23505') {
         res.status(409).json({ message: `Nome de usuário '${username}' já existe.` });
      } else {
         res.status(500).json({ message: 'Erro ao criar usuário.' });
      }
  }
});

app.delete('/api/admin/users/:userId', isAuthenticated, isAdmin, async (req, res) => {
  const { userId } = req.params;
  const userIp = req.ip;
  const userAgent = req.headers['user-agent'];
  const adminUserId = req.user.id;
  const adminUsername = req.user.username;

  if (userId === adminUserId) { /* ... não excluir a si mesmo ... */ }

  try {
    const userToDeleteResult = await pool.query('SELECT username, role FROM users WHERE id = $1', [userId]);
    const userToDelete = userToDeleteResult.rows[0];
    if (!userToDelete) { /* ... usuário não encontrado ... */ }

    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [userId]);
    // A verificação de rowCount já estava implícita pelo SELECT anterior

    await logActivity(
        'DELETE_USER',
        userId,
        { username: userToDelete.username, role: userToDelete.role, deletedBy: adminUsername },
        userIp,
        userAgent,
        adminUserId
    );

    res.status(204).send();
  } catch (error) { /* ... erro ... */
      console.error("Erro ao excluir usuário:", error);
      res.status(500).json({ message: 'Erro ao excluir usuário.' });
  }
});
// --- Fim Rotas Admin Usuários ---

// --- Rotas de Log (sem alterações) ---
// ... (GET /api/logs/faq-activity, GET /api/logs/ai-chat-activity) ...
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
    if (req.path.startsWith('/api/')) {
        return res.status(404).send('Not Found');
    }
    res.sendFile(path.join(frontendBuildPath, 'index.html'));
});
// --- Fim Catch-all ---

// --- Inicialização do Servidor (sem alterações) ---
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor FAQ rodando na porta ${PORT}`);
    console.log(`Diretório de uploads servido de: ${UPLOADS_DIR}`);
    console.log(`Build do frontend servido de: ${frontendBuildPath}`);
    console.log(`Modo Produção: ${IS_PRODUCTION}`);
});
// --- Fim Inicialização ---