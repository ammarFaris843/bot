import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { insertDailyWordSchema } from "@shared/schema";
import { z } from "zod";
import { startBot } from "./bot";
import { format } from "date-fns";

async function seedDatabase() {
  const today = format(new Date(), "yyyy-MM-dd");
  const existing = await storage.getLatestDailyWord();

  if (!existing) {
    console.log("Seeding database with initial Daily Word...");
    await storage.createDailyWord({
      date: today,
      word: "STELLE",
      hint: "One of the Trailblazer's names.",
      isActive: true,
    });
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  await seedDatabase();

  // ─── Daily Words ────────────────────────────────────────────────────────────

  app.get("/api/daily-words", async (_req, res) => {
    const words = await storage.getDailyWords();
    res.json(words);
  });

  app.get("/api/daily-words/today", async (_req, res) => {
    const today = format(new Date(), "yyyy-MM-dd");
    const word = await storage.getDailyWordByDate(today);
    if (!word) return res.status(404).json({ message: "No word set for today" });
    res.json(word);
  });

  app.get("/api/daily-words/latest", async (_req, res) => {
    const word = await storage.getLatestDailyWord();
    if (!word) return res.status(404).json({ message: "No daily words found" });
    res.json(word);
  });

  app.post("/api/daily-words", async (req, res) => {
    try {
      const data = insertDailyWordSchema.parse(req.body);
      const word = await storage.createDailyWord(data);
      res.status(201).json(word);
    } catch (e) {
      if (e instanceof z.ZodError) return res.status(400).json(e.errors);
      throw e;
    }
  });

  app.put("/api/daily-words/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = insertDailyWordSchema.partial().parse(req.body);
      const word = await storage.updateDailyWord(id, data);
      res.json(word);
    } catch (e) {
      if (e instanceof z.ZodError) return res.status(400).json(e.errors);
      throw e;
    }
  });

  app.delete("/api/daily-words/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    await storage.deleteDailyWord(id);
    res.status(204).send();
  });

  // ─── Stats ──────────────────────────────────────────────────────────────────

  app.get("/api/stats/leaderboard", async (_req, res) => {
    const board = await storage.getLeaderboard(20);
    res.json(board);
  });

  app.get("/api/stats/:discordId", async (req, res) => {
    const stats = await storage.getUserStats(req.params.discordId);
    if (!stats) return res.status(404).json({ message: "No stats found for this user" });
    res.json(stats);
  });

  // Start the Discord bot
  startBot().catch(console.error);

  return httpServer;
}
