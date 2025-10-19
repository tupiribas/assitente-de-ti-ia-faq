// server/migrate-json-to-pg.js
// Carrega variáveis de ambiente (necessário se rodar localmente com .env.local)
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env.local') });
const fs = require('fs').promises;
const path = require('path');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid'); // Para garantir IDs UUID válidos

// --- Configuração ---
// Pega a string de conexão da variável de ambiente (essencial para Fly.io e local)
const connectionString = process.env.DATABASE_URL;
// Caminho para o seu arquivo JSON original
const DATA_BASE_DIR = process.env.NODE_ENV === 'production' ? '/app/data' : path.join(__dirname, '..', '..', 'data');
const FAQS_JSON_PATH = path.join(DATA_BASE_DIR, 'faqs.json'); // Caminho corrigido

// Verifica se a string de conexão existe
if (!connectionString) {
    console.error("\x1b[31m%s\x1b[0m", "ERRO: Variável de ambiente DATABASE_URL não definida!"); // Vermelho
    console.error("Certifique-se de que ela está configurada no seu ambiente ou no arquivo .env.local.");
    process.exit(1); // Aborta o script se não houver conexão
}

// Cria o pool de conexões com o PostgreSQL
const pool = new Pool({
    connectionString: connectionString,
    // Descomente a linha abaixo se encontrar problemas de SSL ao conectar ao Fly.io localmente via proxy
    // ssl: { rejectUnauthorized: false }
});
// --- Fim Configuração ---

// --- Função Principal de Migração ---
async function migrateData() {
    let client; // Variável para o cliente do banco de dados
    let successfulMigrations = 0;
    let failedMigrations = 0;

    console.log("\x1b[36m%s\x1b[0m", `Iniciando migração de dados de ${path.basename(FAQS_JSON_PATH)} para PostgreSQL...`); // Ciano

    try {
        // 1. Ler o arquivo JSON
        console.log(`Lendo arquivo JSON: ${FAQS_JSON_PATH}`);
        const jsonData = await fs.readFile(FAQS_JSON_PATH, 'utf8');
        const faqsFromJson = JSON.parse(jsonData);
        console.log(`Encontrados ${faqsFromJson.length} FAQs no arquivo JSON.`);

        if (!Array.isArray(faqsFromJson)) {
            throw new Error("O arquivo JSON não contém um array de FAQs.");
        }

        // 2. Conectar ao Banco de Dados
        client = await pool.connect();
        console.log("\x1b[32m%s\x1b[0m", 'Conectado ao banco de dados PostgreSQL com sucesso.'); // Verde

        // 3. Iterar e Inserir cada FAQ
        for (const faqJson of faqsFromJson) {
            // Validar estrutura básica do FAQ do JSON
            if (!faqJson || typeof faqJson !== 'object' || !faqJson.question || !faqJson.answer || !faqJson.category) {
                console.warn("\x1b[33m%s\x1b[0m", `Ignorando registro inválido no JSON: ${JSON.stringify(faqJson)}`); // Amarelo
                failedMigrations++;
                continue;
            }

            // Validar/Gerar ID UUID
            const faqId = (faqJson.id && typeof faqJson.id === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(faqJson.id))
                ? faqJson.id : uuidv4();
            if (faqId !== faqJson.id) {
                console.warn("\x1b[33m%s\x1b[0m", `ID inválido ou ausente para "${faqJson.question.substring(0, 30)}...", gerando novo UUID: ${faqId}`); // Amarelo
            }

            // Iniciar transação para este FAQ e seus anexos
            await client.query('BEGIN');

            try {
                console.log(` -> Migrando FAQ ID: ${faqId} - "${faqJson.question.substring(0, 50)}..."`);

                // Inserir FAQ na tabela 'faqs'
                const insertFaqQuery = `
          INSERT INTO faqs (id, question, answer, category, document_text)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (id) DO UPDATE SET -- Se ID já existir, atualiza (ou pode usar DO NOTHING para ignorar)
            question = EXCLUDED.question,
            answer = EXCLUDED.answer,
            category = EXCLUDED.category,
            document_text = EXCLUDED.document_text,
            updated_at = CURRENT_TIMESTAMP;
        `;
                await client.query(insertFaqQuery, [
                    faqId,
                    faqJson.question,
                    faqJson.answer,
                    faqJson.category,
                    faqJson.documentText || faqJson.document_text || null // Compatibilidade com nomes antigos
                ]);

                // Tratar Anexos: Verifica se existe a propriedade 'attachments' e é um array
                let attachmentsToInsert = [];
                if (faqJson.attachments && Array.isArray(faqJson.attachments)) {
                    attachmentsToInsert = faqJson.attachments;
                }
                // Lógica legada: Se 'attachments' não existe, mas os campos antigos sim, cria um anexo virtual
                else if (faqJson.documentUrl && faqJson.documentName && faqJson.documentExtension) {
                    console.log(`    - Encontrado anexo no formato legado para FAQ ${faqId}.`);
                    attachmentsToInsert.push({
                        url: faqJson.documentUrl,
                        name: faqJson.documentName,
                        extension: faqJson.documentExtension,
                        type: 'document' // Assume 'document' para o legado
                    });
                }

                // Limpar anexos antigos antes de inserir os novos (para idempotência em caso de re-execução)
                await client.query('DELETE FROM attachments WHERE faq_id = $1', [faqId]);

                // Inserir Anexos na tabela 'attachments'
                if (attachmentsToInsert.length > 0) {
                    const insertAttachmentQuery = `
            INSERT INTO attachments (faq_id, url, name, extension, type)
            VALUES ($1, $2, $3, $4, $5);
          `;
                    let attachmentCount = 0;
                    for (const attachment of attachmentsToInsert) {
                        // Validação mais robusta dos campos do anexo
                        if (attachment.url && typeof attachment.url === 'string' &&
                            attachment.name && typeof attachment.name === 'string' &&
                            attachment.extension && typeof attachment.extension === 'string' &&
                            attachment.type && ['image', 'document'].includes(attachment.type)) {
                            await client.query(insertAttachmentQuery, [
                                faqId,
                                attachment.url,
                                attachment.name,
                                attachment.extension.substring(0, 10), // Limita extensão
                                attachment.type,
                            ]);
                            attachmentCount++;
                        } else {
                            console.warn("\x1b[33m%s\x1b[0m", `   - Anexo inválido ignorado para FAQ ${faqId}: Campos ausentes ou tipo inválido.`, attachment); // Amarelo
                        }
                    }
                    if (attachmentCount > 0) {
                        console.log(`    - ${attachmentCount} anexo(s) inserido(s) para FAQ ${faqId}.`);
                    }
                }

                // Confirmar a transação para este FAQ
                await client.query('COMMIT');
                successfulMigrations++;
                // console.log(`    - FAQ ${faqId} migrado com sucesso.`);

            } catch (innerError) {
                // Desfazer a transação em caso de erro neste FAQ específico
                await client.query('ROLLBACK');
                console.error("\x1b[31m%s\x1b[0m", `   - ERRO ao migrar FAQ ID: ${faqId}. Alterações revertidas. Erro: ${innerError.message}`); // Vermelho
                // console.error(innerError.stack); // Descomente para ver o stack trace completo do erro
                failedMigrations++;
                // Continuar para o próximo FAQ
            }
        } // Fim do loop for

        console.log("\n--- Resumo da Migração ---");
        console.log("\x1b[32m%s\x1b[0m", `FAQs migrados com sucesso: ${successfulMigrations}`); // Verde
        if (failedMigrations > 0) {
            console.log("\x1b[31m%s\x1b[0m", `FAQs com falha na migração: ${failedMigrations}`); // Vermelho
        } else {
            console.log("Nenhuma falha durante a migração.");
        }
        console.log("---------------------------\n");


    } catch (error) {
        console.error("\x1b[31m%s\x1b[0m", 'Erro GERAL durante o processo de migração:', error.message); // Vermelho
        // console.error(error.stack); // Descomente para ver o stack trace
    } finally {
        // 4. Liberar a conexão e fechar o pool
        if (client) {
            client.release(); // Libera o cliente de volta para o pool
            console.log('Conexão com o banco de dados liberada.');
        }
        await pool.end(); // Fecha todas as conexões no pool
        console.log('Pool de conexões com o banco de dados fechado.');
    }
}

// --- Executar a Migração ---
migrateData();