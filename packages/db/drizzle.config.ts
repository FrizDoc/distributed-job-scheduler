import path from "path";
import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: path.resolve(__dirname, "./drizzle"),
  schema: path.resolve(__dirname, "./src/schema.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
