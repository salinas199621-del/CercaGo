import "dotenv/config";
import bcrypt from "bcryptjs";
import { pool } from "../db";

async function main() {
  const { ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_NAME || !ADMIN_PASSWORD || ADMIN_PASSWORD.length < 16 ||
    Buffer.byteLength(ADMIN_PASSWORD, "utf8") > 72) {
    throw new Error("Define ADMIN_EMAIL, ADMIN_NAME y ADMIN_PASSWORD (entre 16 y 72 bytes) para crear el administrador");
  }
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  await pool.query(
    `INSERT INTO users(name, email, password_hash, role)
     VALUES($1, LOWER($2), $3, 'admin')`,
    [ADMIN_NAME, ADMIN_EMAIL, passwordHash],
  );
  console.log(`Administrador configurado: ${ADMIN_EMAIL}`);
}

main()
  .catch((error) => { console.error("No se pudo crear el administrador", error); process.exitCode = 1; })
  .finally(() => pool.end());
