import { pgTable, text, serial, boolean, date, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const dailyWords = pgTable("daily_words", {
  id: serial("id").primaryKey(),
  date: date("date").notNull().unique(),
  word: text("word").notNull(),
  hint: text("hint"),
  isActive: boolean("is_active").default(true).notNull(),
});

export const insertDailyWordSchema = createInsertSchema(dailyWords)
  .omit({ id: true })
  .extend({
    word: z
      .string()
      .min(1, "Word is required")
      .max(12, "Word must be 12 characters or less")
      .transform((w) => w.toUpperCase()),
  });

export type DailyWord = typeof dailyWords.$inferSelect;
export type InsertDailyWord = z.infer<typeof insertDailyWordSchema>;

export const updateDailyWordSchema = insertDailyWordSchema.partial();

export const userStats = pgTable("user_stats", {
  id: serial("id").primaryKey(),
  discordId: text("discord_id").notNull().unique(),
  discordUsername: text("discord_username").notNull(),
  gamesPlayed: integer("games_played").default(0).notNull(),
  gamesWon: integer("games_won").default(0).notNull(),
  currentStreak: integer("current_streak").default(0).notNull(),
  bestStreak: integer("best_streak").default(0).notNull(),
  totalGuesses: integer("total_guesses").default(0).notNull(),
  lastPlayedDate: date("last_played_date"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserStatsSchema = createInsertSchema(userStats).omit({
  id: true,
  updatedAt: true,
});

export type UserStats = typeof userStats.$inferSelect;
export type InsertUserStats = z.infer<typeof insertUserStatsSchema>;
