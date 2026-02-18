import { dailyWords, userStats, type DailyWord, type InsertDailyWord, type UserStats } from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc } from "drizzle-orm";
import { format } from "date-fns";

export interface IStorage {
  // Daily Words
  getDailyWords(): Promise<DailyWord[]>;
  getDailyWordByDate(date: string): Promise<DailyWord | undefined>;
  getLatestDailyWord(): Promise<DailyWord | undefined>;
  createDailyWord(word: InsertDailyWord): Promise<DailyWord>;
  updateDailyWord(id: number, word: Partial<InsertDailyWord>): Promise<DailyWord>;
  deleteDailyWord(id: number): Promise<void>;

  // User Stats
  getUserStats(discordId: string): Promise<UserStats | undefined>;
  getLeaderboard(limit?: number): Promise<UserStats[]>;
  upsertUserStats(discordId: string, username: string, won: boolean, guessCount: number, today: string): Promise<UserStats>;
}

export class DatabaseStorage implements IStorage {
  // ─── Daily Words ──────────────────────────────────────────────────────────

  async getDailyWords(): Promise<DailyWord[]> {
    return await db.select().from(dailyWords).orderBy(desc(dailyWords.date));
  }

  async getDailyWordByDate(date: string): Promise<DailyWord | undefined> {
    const [word] = await db
      .select()
      .from(dailyWords)
      .where(eq(dailyWords.date, date))
      .limit(1);
    return word;
  }

  async getLatestDailyWord(): Promise<DailyWord | undefined> {
    const [word] = await db
      .select()
      .from(dailyWords)
      .orderBy(desc(dailyWords.date))
      .limit(1);
    return word;
  }

  async createDailyWord(insertWord: InsertDailyWord): Promise<DailyWord> {
    const [word] = await db.insert(dailyWords).values(insertWord).returning();
    return word;
  }

  async updateDailyWord(id: number, updateWord: Partial<InsertDailyWord>): Promise<DailyWord> {
    const [word] = await db
      .update(dailyWords)
      .set(updateWord)
      .where(eq(dailyWords.id, id))
      .returning();
    return word;
  }

  async deleteDailyWord(id: number): Promise<void> {
    await db.delete(dailyWords).where(eq(dailyWords.id, id));
  }

  // ─── User Stats ───────────────────────────────────────────────────────────

  async getUserStats(discordId: string): Promise<UserStats | undefined> {
    const [stats] = await db
      .select()
      .from(userStats)
      .where(eq(userStats.discordId, discordId))
      .limit(1);
    return stats;
  }

  async getLeaderboard(limit = 10): Promise<UserStats[]> {
    return await db
      .select()
      .from(userStats)
      .orderBy(desc(userStats.gamesWon), desc(userStats.bestStreak))
      .limit(limit);
  }

  async upsertUserStats(
    discordId: string,
    username: string,
    won: boolean,
    guessCount: number,
    today: string,
  ): Promise<UserStats> {
    const existing = await this.getUserStats(discordId);

    if (!existing) {
      // First game ever
      const newStreak = won ? 1 : 0;
      const [stats] = await db
        .insert(userStats)
        .values({
          discordId,
          discordUsername: username,
          gamesPlayed: 1,
          gamesWon: won ? 1 : 0,
          currentStreak: newStreak,
          bestStreak: newStreak,
          totalGuesses: guessCount,
          lastPlayedDate: today,
        })
        .returning();
      return stats;
    }

    // Calculate streak
    let currentStreak = existing.currentStreak;
    const lastDate = existing.lastPlayedDate;
    if (won) {
      // Extend streak if played yesterday or first win
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = format(yesterday, "yyyy-MM-dd");
      currentStreak = (lastDate === yesterdayStr || lastDate === today) ? currentStreak + 1 : 1;
    } else {
      currentStreak = 0;
    }

    const bestStreak = Math.max(existing.bestStreak, currentStreak);

    const [stats] = await db
      .update(userStats)
      .set({
        discordUsername: username,
        gamesPlayed: existing.gamesPlayed + 1,
        gamesWon: won ? existing.gamesWon + 1 : existing.gamesWon,
        currentStreak,
        bestStreak,
        totalGuesses: existing.totalGuesses + guessCount,
        lastPlayedDate: today,
        updatedAt: new Date(),
      })
      .where(eq(userStats.discordId, discordId))
      .returning();
    return stats;
  }
}

export const storage = new DatabaseStorage();
