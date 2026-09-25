import { drizzle } from "drizzle-orm/mysql2";

let connection: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!connection && process.env.DATABASE_URL) {
    try {
      connection = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      connection = null;
    }
  }

  return connection;
}
