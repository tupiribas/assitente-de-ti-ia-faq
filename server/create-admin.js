// server/create-admin.js
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env.local') });
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SALT_ROUNDS = 10;
const connectionString = process.env.DATABASE_URL;

if (!connectionString || !ADMIN_USERNAME || !ADMIN_PASSWORD) {
    console.error("\x1b[31m%s\x1b[0m", "ERRO: DATABASE_URL, ADMIN_USERNAME e ADMIN_PASSWORD devem estar definidos nas variáveis de ambiente/segredos.");
    process.exit(1);
}
if (ADMIN_PASSWORD.length < 8) {
    console.error("\x1b[31m%s\x1b[0m", "ERRO: A senha ADMIN_PASSWORD deve ter no mínimo 8 caracteres.");
    process.exit(1);
}

const pool = new Pool({ connectionString });

async function createAdminUser() {
    let client;
    try {
        client = await pool.connect();
        // Verifica se já existe algum admin
        const check = await client.query('SELECT 1 FROM users WHERE role = $1 LIMIT 1', ['admin']);
        if (check.rowCount > 0) {
            console.log('\x1b[33m%s\x1b[0m', 'AVISO: Um utilizador admin já existe. Nenhum novo utilizador foi criado.');
            return; // Sai se já existir admin
        }

        console.log(`A criar utilizador admin: ${ADMIN_USERNAME}...`);
        const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, SALT_ROUNDS);

        await client.query('BEGIN');
        await client.query(
            'INSERT INTO users (id, username, password_hash, role) VALUES ($1, $2, $3, $4)',
            [uuidv4(), ADMIN_USERNAME, passwordHash, 'admin']
        );
        await client.query('COMMIT');
        console.log('\x1b[32m%s\x1b[0m', 'Utilizador admin criado com sucesso!');

    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error('\x1b[31m%s\x1b[0m', 'Erro ao criar utilizador admin:', error.message);
        if (error.code === '23505') { // Código de erro para unique violation
            console.error('\x1b[31m%s\x1b[0m', `Detalhe: O nome de utilizador '${ADMIN_USERNAME}' provavelmente já existe.`);
        }
    } finally {
        if (client) client.release();
        await pool.end();
        console.log('Conexão com o banco de dados fechada.');
    }
}
createAdminUser();