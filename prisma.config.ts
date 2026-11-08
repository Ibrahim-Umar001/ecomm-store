import "dotenv/config";
import { defineConfig } from "prisma/config";

const usesPostgreSql = process.env.DATABASE_URL?.startsWith("postgres") ?? false;

export default defineConfig({
  schema: usesPostgreSql
    ? "prisma/postgresql/schema.prisma"
    : "prisma/schema.prisma",
  migrations: {
    path: usesPostgreSql
      ? "prisma/postgresql/migrations"
      : "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  },
});
