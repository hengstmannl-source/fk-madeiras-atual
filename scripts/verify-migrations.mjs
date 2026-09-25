import mysql from "mysql2/promise";

const expectedMigrationCount = 73;
const requiredTables = [
  "users",
  "empresas",
  "titulosFinanceiros",
  "contasFinanceiras",
  "romaneiosCargaToras",
  "romaneiosProducao",
  "lotesPecasSerradas",
  "plaquetas",
  "orcamentos",
];

const connection = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [migrationRows] = await connection.query(
    "SELECT COUNT(*) AS total FROM __drizzle_migrations",
  );
  const migrationCount = Number(migrationRows[0]?.total ?? 0);
  if (migrationCount !== expectedMigrationCount) {
    throw new Error(
      `Esperadas ${expectedMigrationCount} migrations em __drizzle_migrations; encontradas ${migrationCount}.`,
    );
  }

  const [tableRows] = await connection.query("SHOW TABLES");
  const tables = new Set(tableRows.map(row => Object.values(row)[0]));
  const missingTables = requiredTables.filter(table => !tables.has(table));
  if (missingTables.length > 0) {
    throw new Error(`Tabelas essenciais ausentes: ${missingTables.join(", ")}.`);
  }

  console.log(
    JSON.stringify(
      {
        migrations: migrationCount,
        tables: tables.size,
        requiredTables: requiredTables.length,
        status: "ok",
      },
      null,
      2,
    ),
  );
} finally {
  await connection.end();
}
