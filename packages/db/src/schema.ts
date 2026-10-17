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
  name: varchar({ length: 255 }).notNull(),
  status: varchar({ length: 50 }).notNull(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id),
  created_at: timestamp("created_at").defaultNow(),
  started_at: timestamp("started_at"),
  completed_at: timestamp("completed_at"),
  // workers update status by job_id, without the index every write scans the whole table
  jobId: varchar("job_id", { length: 255 }).unique(),
  type: varchar({ enum: ["bulk", "single"] }),
  metadata: json(),
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
