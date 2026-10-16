import { Relation } from "drizzle-orm";
import { relations } from "drizzle-orm/_relations";
import { integer, pgTable, varchar, json, timestamp, PgEnum } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar({ length: 255 }).notNull(),
  age: integer().notNull(),
  email: varchar({ length: 255 }).notNull().unique(),
  hashedPassword: varchar({ length: 255 }).notNull(),
});

export const jobsTable = pgTable("jobs", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  title: varchar({ length: 255 }).notNull(),
  description: varchar({ length: 255 }).notNull(),
  status: varchar({ length: 50 }).notNull(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id),
  created_at: timestamp("created_at").defaultNow(),
  type: varchar({ enum: ['bulk', 'single'] }),
  metadata: json()
});

export const usersRelations = relations(usersTable, ({ many }) => ({
  jobs: many(jobsTable),
}));

export const jobsRelations = relations(jobsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [jobsTable.userId],
    references: [usersTable.id],
  }),
}));
