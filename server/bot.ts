import {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  REST,
  Routes,
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ButtonInteraction,
  ComponentType,
  InteractionCollector,
} from "discord.js";
import { storage } from "./storage";
import { format } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

interface GameState {
  targetWord: string;       // Snapshot of the word at game-start
  wordDate: string;         // Which day's word this is
  guesses: string[];        // Submitted guesses (lowercase)
  startTime: number;
  hintUsed: boolean;
}

// ─── In-memory game state (per user) ─────────────────────────────────────────

const userGames = new Map<string, GameState>();

const MAX_GUESSES = 6;

// ─── Wordle evaluation ────────────────────────────────────────────────────────

function evaluateGuess(guess: string, target: string): string[] {
  const result = new Array(guess.length).fill("⬛");
  const targetChars = target.split("");
  const guessChars = guess.split("");
  const targetUsed = new Array(target.length).fill(false);

  // Pass 1: correct positions (green)
  for (let i = 0; i < guess.length; i++) {
    if (guessChars[i] === targetChars[i]) {
      result[i] = "🟩";
      targetUsed[i] = true;
    }
  }
  // Pass 2: wrong position (yellow)
  for (let i = 0; i < guess.length; i++) {
    if (result[i] !== "🟩") {
      const idx = targetChars.findIndex((c, j) => c === guessChars[i] && !targetUsed[j]);
      if (idx !== -1) {
        result[i] = "🟨";
        targetUsed[idx] = true;
      }
    }
  }
  return result;
}

// Build the full guess history board as a string (all rows so far)
function buildBoard(guesses: string[], target: string): string {
  if (guesses.length === 0) return "*No guesses yet.*";
  return guesses
    .map((g, i) => {
      const tiles = evaluateGuess(g, target);
      return `\`${g.toUpperCase().padEnd(target.length)}\`  ${tiles.join("")}`;
    })
    .join("\n");
}

// Remaining attempts display
function attemptsLine(used: number): string {
  return `**${used}/${MAX_GUESSES}** attempt${used === 1 ? "" : "s"} used`;
}

// ─── Embeds ───────────────────────────────────────────────────────────────────

function startEmbed(wordLength: number, date: string, hint: string | null): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xf5c518)
    .setTitle("🚂  Honkai: Star Rail Wordle")
    .setDescription(
      `A new **${wordLength}-letter** word is waiting to be cracked!\n\n` +
      `📅  Word for: **${date}**\n` +
      `Type your guess — any message that is exactly **${wordLength}** letters.\n\n` +
      (hint ? `💡  Hint available — use \`/hint\` anytime.\n\n` : "") +
      `Use \`/stop\` to abandon your current game.`
    )
    .setFooter({ text: "🟩 Correct position  |  🟨 Wrong position  |  ⬛ Not in word" })
    .setTimestamp();
}

function guessEmbed(
  guess: string,
  guesses: string[],
  target: string,
  remaining: number,
): EmbedBuilder {
  const tiles = evaluateGuess(guess, target);
  const board = buildBoard(guesses, target);
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`📋  Guess ${guesses.length}/${MAX_GUESSES}`)
    .setDescription(board)
    .addFields({ name: "Attempts remaining", value: `${remaining}`, inline: true })
    .setFooter({ text: "🟩 Correct  |  🟨 Present  |  ⬛ Absent" });
}

function winEmbed(guesses: string[], target: string): EmbedBuilder {
  const board = buildBoard(guesses, target);
  const lines: string[] = [
    "✨ **All according to plan, Trailblazer!**",
    "",
    board,
    "",
    `Solved in **${guesses.length}/${MAX_GUESSES}** guesses!`,
  ];
  const praise =
    guesses.length === 1 ? "🤯 Incredible — first try!" :
    guesses.length <= 2 ? "🔥 Outstanding!" :
    guesses.length <= 3 ? "⭐ Excellent work!" :
    guesses.length <= 4 ? "👍 Well done!" :
    guesses.length <= 5 ? "😅 Cutting it close!" :
    "😤 Barely made it, but a win is a win!";
  lines.push(praise);
  return new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle("🎉  Victory!")
    .setDescription(lines.join("\n"))
    .setTimestamp();
}

function loseEmbed(guesses: string[], target: string): EmbedBuilder {
  const board = buildBoard(guesses, target);
  return new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle("💀  Mission Failed")
    .setDescription(
      `${board}\n\n` +
      `The word was: **${target.toUpperCase()}**\n\n` +
      `Better luck next time, Trailblazer! Come back tomorrow for a new word.`
    )
    .setTimestamp();
}

function statsEmbed(stats: Awaited<ReturnType<typeof storage.getUserStats>>, username: string): EmbedBuilder {
  if (!stats) {
    return new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`📊  Stats for ${username}`)
      .setDescription("No games played yet. Use `/wordle` to start your first game!");
  }
  const winRate = stats.gamesPlayed > 0
    ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100)
    : 0;
  const avgGuesses = stats.gamesWon > 0
    ? (stats.totalGuesses / stats.gamesWon).toFixed(1)
    : "–";
  return new EmbedBuilder()
    .setColor(0xf5c518)
    .setTitle(`📊  Stats for ${stats.discordUsername}`)
    .addFields(
      { name: "🎮  Played",      value: `${stats.gamesPlayed}`,    inline: true },
      { name: "🏆  Won",         value: `${stats.gamesWon}`,       inline: true },
      { name: "📈  Win Rate",    value: `${winRate}%`,             inline: true },
      { name: "🔥  Streak",      value: `${stats.currentStreak}`,  inline: true },
      { name: "⭐  Best Streak", value: `${stats.bestStreak}`,     inline: true },
      { name: "✏️  Avg Guesses", value: `${avgGuesses}`,           inline: true },
    )
    .setTimestamp();
}

function leaderboardEmbed(board: Awaited<ReturnType<typeof storage.getLeaderboard>>): EmbedBuilder {
  if (board.length === 0) {
    return new EmbedBuilder()
      .setColor(0xf5c518)
      .setTitle("🏆  Leaderboard")
      .setDescription("No players yet! Use `/wordle` to start playing.");
  }
  const medals = ["🥇", "🥈", "🥉"];
  const rows = board.map((p, i) => {
    const medal = medals[i] ?? `**${i + 1}.**`;
    const winRate = p.gamesPlayed > 0
      ? Math.round((p.gamesWon / p.gamesPlayed) * 100)
      : 0;
    return `${medal} **${p.discordUsername}** — ${p.gamesWon}W / ${p.gamesPlayed}G  (${winRate}%)  🔥${p.currentStreak}`;
  });
  return new EmbedBuilder()
    .setColor(0xf5c518)
    .setTitle("🏆  Honkai: Star Rail Wordle Leaderboard")
    .setDescription(rows.join("\n"))
    .setFooter({ text: "Ranked by wins, then best streak" })
    .setTimestamp();
}

function helpEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("🚂  HSR Wordle — How to Play")
    .setDescription(
      "Guess the hidden Honkai: Star Rail word in up to **6 attempts**!\n\n" +
      "After each guess you'll see coloured squares:\n" +
      "🟩  Letter is in the word at the **correct** position\n" +
      "🟨  Letter is in the word but at the **wrong** position\n" +
      "⬛  Letter is **not** in the word\n"
    )
    .addFields(
      { name: "Commands", value:
        "`/wordle` — Start or resume today's game\n" +
        "`/hint` — Get a hint (if one is set)\n" +
        "`/stop` — Abandon your current game\n" +
        "`/stats` — View your personal stats\n" +
        "`/leaderboard` — View the server leaderboard\n" +
        "`/help` — Show this message"
      }
    )
    .setFooter({ text: "A new word is available every day!" });
}

// ─── Slash command definitions ────────────────────────────────────────────────

const commands = [
  new SlashCommandBuilder().setName("wordle").setDescription("Start or resume today's HSR Wordle game"),
  new SlashCommandBuilder().setName("hint").setDescription("Get a hint for today's word"),
  new SlashCommandBuilder().setName("stop").setDescription("Abandon your current game"),
  new SlashCommandBuilder().setName("stats").setDescription("View your Wordle stats"),
  new SlashCommandBuilder().setName("leaderboard").setDescription("View the server Wordle leaderboard"),
  new SlashCommandBuilder().setName("help").setDescription("How to play HSR Wordle"),
].map((cmd) => cmd.toJSON());

// ─── Token helper ─────────────────────────────────────────────────────────────

let connectionSettings: any;

async function getAccessToken(): Promise<string | null> {
  if (process.env.DISCORD_TOKEN) return process.env.DISCORD_TOKEN;

  if (
    connectionSettings?.settings?.expires_at &&
    new Date(connectionSettings.settings.expires_at).getTime() > Date.now()
  ) {
    return connectionSettings.settings.access_token;
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? "depl " + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) {
    console.log("X_REPLIT_TOKEN not found and DISCORD_TOKEN not set.");
    return null;
  }

  try {
    connectionSettings = await fetch(
      "https://" + hostname + "/api/v2/connection?include_secrets=true&connector_names=discord",
      { headers: { Accept: "application/json", X_REPLIT_TOKEN: xReplitToken } }
    )
      .then((r) => r.json())
      .then((d) => d.items?.[0]);
  } catch (e) {
    console.error("Failed to fetch Replit connection settings:", e);
    return null;
  }

  const token =
    connectionSettings?.settings?.access_token ||
    connectionSettings?.settings?.oauth?.credentials?.access_token;

  if (!token) {
    console.log("Discord not connected via Replit integration.");
    return null;
  }
  return token;
}

// ─── Register slash commands with Discord ────────────────────────────────────

async function registerSlashCommands(token: string, clientId: string): Promise<void> {
  try {
    const rest = new REST({ version: "10" }).setToken(token);
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    console.log("✅ Registered global slash commands.");
  } catch (err) {
    console.error("Failed to register slash commands:", err);
  }
}

// ─── Get today's active word ──────────────────────────────────────────────────

async function getTodayWord() {
  const today = format(new Date(), "yyyy-MM-dd");
  // First try today's specific word
  let word = await storage.getDailyWordByDate(today);
  // Fall back to the most recent active word
  if (!word) word = await storage.getLatestDailyWord();
  if (!word || !word.isActive) return null;
  return word;
}

// ─── Handle /wordle ───────────────────────────────────────────────────────────

async function handleWordle(interaction: ChatInputCommandInteraction): Promise<void> {
  const dailyWord = await getTodayWord();

  if (!dailyWord) {
    await interaction.reply({
      content: "⚠️ No active Daily Word configured yet. The Trailblazer will set one soon!",
      ephemeral: true,
    });
    return;
  }

  const userId = interaction.user.id;
  const today = format(new Date(), "yyyy-MM-dd");

  // Resume existing game
  const existing = userGames.get(userId);
  if (existing && existing.wordDate === today) {
    const board = buildBoard(existing.guesses, existing.targetWord);
    const remaining = MAX_GUESSES - existing.guesses.length;
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xf5c518)
          .setTitle("🚂  Game in Progress")
          .setDescription(
            `You already have a game running!\n\n${board}\n\n` +
            `**${remaining}** guess${remaining === 1 ? "" : "es"} remaining. Keep going!`
          )
          .setFooter({ text: "🟩 Correct  |  🟨 Present  |  ⬛ Absent" }),
      ],
      ephemeral: true,
    });
    return;
  }

  // Start new game — snapshot the word so it can't change mid-session
  userGames.set(userId, {
    targetWord: dailyWord.word.toLowerCase(),
    wordDate: today,
    guesses: [],
    startTime: Date.now(),
    hintUsed: false,
  });

  await interaction.reply({
    embeds: [startEmbed(dailyWord.word.length, today, dailyWord.hint ?? null)],
  });
}

// ─── Handle /hint ─────────────────────────────────────────────────────────────

async function handleHint(interaction: ChatInputCommandInteraction): Promise<void> {
  const userId = interaction.user.id;
  const game = userGames.get(userId);

  if (!game) {
    await interaction.reply({ content: "You don't have an active game! Use `/wordle` to start one.", ephemeral: true });
    return;
  }

  const dailyWord = await getTodayWord();
  if (!dailyWord?.hint) {
    await interaction.reply({ content: "No hint has been set for today's word. You're on your own, Trailblazer!", ephemeral: true });
    return;
  }

  game.hintUsed = true;
  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0xfee75c)
        .setTitle("💡  Hint")
        .setDescription(dailyWord.hint)
        .setFooter({ text: "Using a hint doesn't affect your win — but bragging rights may suffer 😄" }),
    ],
    ephemeral: true,
  });
}

// ─── Handle /stop ─────────────────────────────────────────────────────────────

async function handleStop(interaction: ChatInputCommandInteraction): Promise<void> {
  const userId = interaction.user.id;
  const game = userGames.get(userId);

  if (!game) {
    await interaction.reply({ content: "You don't have an active game to stop.", ephemeral: true });
    return;
  }

  const word = game.targetWord.toUpperCase();
  userGames.delete(userId);

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x99aab5)
        .setTitle("🛑  Game Abandoned")
        .setDescription(`Game stopped. The word was **${word}**.\n\nCome back tomorrow for a fresh challenge!`)
        .setTimestamp(),
    ],
    ephemeral: true,
  });
}

// ─── Handle /stats ────────────────────────────────────────────────────────────

async function handleStats(interaction: ChatInputCommandInteraction): Promise<void> {
  const userId = interaction.user.id;
  const username = interaction.user.username;
  const stats = await storage.getUserStats(userId);
  await interaction.reply({ embeds: [statsEmbed(stats, username)] });
}

// ─── Handle /leaderboard ──────────────────────────────────────────────────────

async function handleLeaderboard(interaction: ChatInputCommandInteraction): Promise<void> {
  const board = await storage.getLeaderboard(10);
  await interaction.reply({ embeds: [leaderboardEmbed(board)] });
}

// ─── Handle /help ─────────────────────────────────────────────────────────────

async function handleHelp(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.reply({ embeds: [helpEmbed()], ephemeral: true });
}

// ─── Handle a guess message ───────────────────────────────────────────────────

async function handleGuess(message: import("discord.js").Message): Promise<void> {
  const userId = message.author.id;
  const game = userGames.get(userId);
  if (!game) return; // Not playing

  const content = message.content.trim().toLowerCase();
  const target = game.targetWord;

  // Ignore messages that clearly aren't a guess attempt
  if (content.length !== target.length) return;
  // Only accept alphabetical guesses
  if (!/^[a-z]+$/.test(content)) return;

  const guess = content;
  game.guesses.push(guess);

  const today = format(new Date(), "yyyy-MM-dd");
  const remaining = MAX_GUESSES - game.guesses.length;

  if (guess === target) {
    // WIN
    userGames.delete(userId);
    await storage.upsertUserStats(userId, message.author.username, true, game.guesses.length, today);
    await message.reply({ embeds: [winEmbed(game.guesses, target)] });
  } else if (game.guesses.length >= MAX_GUESSES) {
    // LOSE
    userGames.delete(userId);
    await storage.upsertUserStats(userId, message.author.username, false, game.guesses.length, today);
    await message.reply({ embeds: [loseEmbed(game.guesses, target)] });
  } else {
    // Continue
    await message.reply({ embeds: [guessEmbed(guess, game.guesses, target, remaining)] });
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function startBot(): Promise<void> {
  const token = await getAccessToken();

  if (!token) {
    console.log("⚠️  No valid Discord token found. Bot will not start.");
    return;
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel],
  });

  client.once("ready", async () => {
    console.log(`✅ Bot logged in as ${client.user?.tag}`);
    if (client.user) {
      await registerSlashCommands(token, client.user.id);
    }
  });

  // ── Slash command handler ──────────────────────────────────────────────────
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    try {
      switch (interaction.commandName) {
        case "wordle":      await handleWordle(interaction);      break;
        case "hint":        await handleHint(interaction);        break;
        case "stop":        await handleStop(interaction);        break;
        case "stats":       await handleStats(interaction);       break;
        case "leaderboard": await handleLeaderboard(interaction); break;
        case "help":        await handleHelp(interaction);        break;
        default:
          await interaction.reply({ content: "Unknown command.", ephemeral: true });
      }
    } catch (err) {
      console.error(`Error handling /${interaction.commandName}:`, err);
      const errMsg = { content: "⚠️ Something went wrong. Please try again.", ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errMsg);
      } else {
        await interaction.reply(errMsg);
      }
    }
  });

  // ── Message handler (for actual guesses during an active game) ─────────────
  client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    // Also support legacy prefix commands for discoverability
    const lower = message.content.trim().toLowerCase();
    if (lower === "!help" || lower === "!wordle") {
      await message.reply("Use Discord slash commands! Type `/wordle` to start, or `/help` for all commands.");
      return;
    }
    await handleGuess(message);
  });

  try {
    await client.login(token);
  } catch (err) {
    console.error("Failed to log in to Discord:", err);
  }
}
