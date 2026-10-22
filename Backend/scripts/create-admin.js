require('dotenv').config();
const readline = require('readline/promises');
const { stdin, stdout } = require('process');
const bcrypt = require('bcryptjs');
const { pool } = require('../src/config/db');

const main = async () => {
  const prompt = readline.createInterface({ input: stdin, output: stdout });
  try {
    const fullName = (await prompt.question('Admin full name: ')).trim();
    const phone = (await prompt.question('Phone: ')).trim();
    const email = (await prompt.question('Email: ')).trim().toLowerCase();
    const password = await prompt.question('Password (12+ characters): ');
    if (!fullName || !/^\+?[0-9 ()-]{8,20}$/.test(phone) || !/^\S+@\S+\.\S+$/.test(email) || password.length < 12) {
      throw new Error('Invalid name, phone, email, or password length.');
    }
    const [[existing]] = await pool.query("SELECT COUNT(*) AS total FROM users WHERE role = 'ADMIN'");
    if (existing.total) throw new Error('An administrator account already exists. Use the admin management page to add another.');
    const hash = await bcrypt.hash(password, 12);
    await pool.query("INSERT INTO users (full_name, phone, email, password_hash, role) VALUES (?, ?, ?, ?, 'ADMIN')", [fullName, phone, email, hash]);
    console.log('Administrator account created. The password was not written to disk.');
  } finally { prompt.close(); }
};

main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => pool.end());
