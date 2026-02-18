import { useState, useEffect, useRef, useCallback } from "react";
import { format } from "date-fns";
import anime from "animejs";
import {
  useDailyWords,
  useTodayWord,
  useCreateDailyWord,
  useUpdateDailyWord,
  useDeleteDailyWord,
} from "@/hooks/use-daily-words";
import { HsrButton } from "@/components/ui/hsr-button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Loader2, Plus, Calendar, Edit, Star, Search,
  Terminal, Trash2, Trophy, Zap, CheckCircle2, XCircle,
} from "lucide-react";
import { DailyWord } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserStats {
  id: number;
  discordId: string;
  discordUsername: string;
  gamesPlayed: number;
  gamesWon: number;
  currentStreak: number;
  bestStreak: number;
  totalGuesses: number;
  lastPlayedDate: string | null;
}

const formSchema = z.object({
  word: z.string().min(1).max(12).transform(w => w.toUpperCase()),
  hint: z.string().optional(),
  date: z.string().min(1),
  isActive: z.boolean().default(true),
});
type FormValues = z.infer<typeof formSchema>;

function useLeaderboard() {
  return useQuery<UserStats[]>({
    queryKey: ["/api/stats/leaderboard"],
    queryFn: async () => {
      const res = await fetch("/api/stats/leaderboard");
      if (!res.ok) throw new Error("Failed to fetch leaderboard");
      return res.json();
    },
  });
}

// ─── Particle Star Background ─────────────────────────────────────────────────

function StarField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const stars = Array.from({ length: 80 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + 0.2,
      alpha: Math.random() * 0.6 + 0.1,
      speed: Math.random() * 0.3 + 0.05,
    }));

    let frame: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      stars.forEach(s => {
        s.alpha += Math.sin(Date.now() * s.speed * 0.002) * 0.003;
        s.alpha = Math.max(0.05, Math.min(0.7, s.alpha));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(250, 204, 21, ${s.alpha})`;
        ctx.fill();
      });
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: 0.5 }}
    />
  );
}

// ─── Animated grid lines ──────────────────────────────────────────────────────

function GridLines() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const lines = ref.current.querySelectorAll(".grid-line");
    anime({
      targets: lines,
      opacity: [0, 0.06, 0],
      translateX: (_el: Element, i: number) => i % 2 === 0 ? ["-100%", "100%"] : 0,
      translateY: (_el: Element, i: number) => i % 2 !== 0 ? ["-100%", "100%"] : 0,
      duration: 4000,
      delay: anime.stagger(600),
      easing: "linear",
      loop: true,
    });
  }, []);

  return (
    <div ref={ref} className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {/* Vertical lines */}
      {[15, 30, 50, 70, 85].map((pct, i) => (
        <div
          key={`v${i}`}
          className="grid-line absolute top-0 h-full w-px bg-gradient-to-b from-transparent via-primary/20 to-transparent"
          style={{ left: `${pct}%`, opacity: 0 }}
        />
      ))}
      {/* Horizontal lines */}
      {[20, 45, 65, 80].map((pct, i) => (
        <div
          key={`h${i}`}
          className="grid-line absolute left-0 w-full h-px bg-gradient-to-r from-transparent via-secondary/20 to-transparent"
          style={{ top: `${pct}%`, opacity: 0 }}
        />
      ))}
    </div>
  );
}

// ─── Scramble text reveal ─────────────────────────────────────────────────────

function ScrambleText({
  text,
  className,
  startDelay = 0,
}: {
  text: string;
  className?: string;
  startDelay?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%";

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.textContent = text.replace(/./g, "_");
    const letters = text.split("");
    let revealed = 0;

    const revealNext = () => {
      if (revealed >= letters.length) return;
      let scrambles = 0;
      const maxScrambles = 8;
      const iv = setInterval(() => {
        const current = letters.slice(0, revealed).join("") +
          CHARS[Math.floor(Math.random() * CHARS.length)] +
          "_".repeat(letters.length - revealed - 1);
        el.textContent = current;
        scrambles++;
        if (scrambles >= maxScrambles) {
          clearInterval(iv);
          revealed++;
          el.textContent = letters.slice(0, revealed).join("") + "_".repeat(letters.length - revealed);
          setTimeout(revealNext, 30);
        }
      }, 35);
    };

    setTimeout(revealNext, startDelay);
  }, [text, startDelay]);

  return <span ref={ref} className={className}>{text}</span>;
}

// ─── Radar pulse (for Today banner) ──────────────────────────────────────────

function RadarPulse() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const rings = ref.current.querySelectorAll(".pulse-ring");
    anime({
      targets: rings,
      scale: [0.4, 2.2],
      opacity: [0.5, 0],
      duration: 2000,
      delay: anime.stagger(500),
      easing: "easeOutExpo",
      loop: true,
    });
  }, []);

  return (
    <div ref={ref} className="relative w-10 h-10 shrink-0 flex items-center justify-center">
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className="pulse-ring absolute inset-0 rounded-full border border-green-400/50"
          style={{ opacity: 0 }}
        />
      ))}
      <CheckCircle2 className="w-6 h-6 text-green-400 relative z-10" />
    </div>
  );
}

// ─── Holographic stat card ────────────────────────────────────────────────────

function StatCard({
  label, value, icon: Icon, color, delay,
}: {
  label: string; value: number | string; icon: React.ElementType;
  color: string; delay: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const shimRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    anime({
      targets: ref.current,
      translateY: [40, 0],
      opacity: [0, 1],
      duration: 800,
      delay,
      easing: "easeOutExpo",
    });
    // Animate number counter
    if (typeof value === "number" && counterRef.current) {
      const obj = { val: 0 };
      anime({
        targets: obj,
        val: value,
        duration: 1400,
        delay: delay + 300,
        easing: "easeOutExpo",
        round: 1,
        update() {
          if (counterRef.current) counterRef.current.textContent = String(obj.val);
        },
      });
    }
  }, [delay, value]);

  const handleMouseEnter = () => {
    if (!shimRef.current) return;
    anime({
      targets: shimRef.current,
      left: ["-100%", "150%"],
      duration: 600,
      easing: "easeInOutQuad",
    });
  };

  return (
    <div
      ref={ref}
      onMouseEnter={handleMouseEnter}
      style={{ opacity: 0 }}
      className="glass-panel p-5 rounded-lg border-l-4 border-l-primary/50 relative overflow-hidden cursor-default group"
    >
      {/* Holographic shimmer sweep */}
      <div
        ref={shimRef}
        className="absolute top-0 h-full w-16 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12 pointer-events-none"
        style={{ left: "-100%" }}
      />
      {/* Corner bracket */}
      <div className="absolute top-1 right-1 w-4 h-4 border-t border-r border-primary/30" />
      <div className="absolute bottom-1 left-1 w-4 h-4 border-b border-l border-primary/30" />

      <div className="flex justify-between items-start">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-mono">{label}</p>
          <p className={`text-3xl font-black font-display mt-1 ${color}`}>
            {typeof value === "number"
              ? <span ref={counterRef}>0</span>
              : <span>{value}</span>
            }
          </p>
        </div>
        <Icon className={`w-6 h-6 ${color} opacity-30 group-hover:opacity-70 transition-opacity duration-300`} />
      </div>
    </div>
  );
}

// ─── Today's word banner with radar + decode ─────────────────────────────────

function TodayWordBanner({ word, hint }: { word: string; hint?: string | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const lettersRef = useRef<(HTMLSpanElement | null)[]>([]);
  const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#@!0123456789";

  useEffect(() => {
    if (!ref.current) return;
    anime({
      targets: ref.current,
      clipPath: ["inset(0 100% 0 0)", "inset(0 0% 0 0)"],
      opacity: [0, 1],
      duration: 700,
      easing: "easeOutExpo",
    });

    // Decode each letter sequentially
    lettersRef.current.forEach((el, i) => {
      if (!el) return;
      const final = el.dataset.char!;
      let tick = 0;
      setTimeout(() => {
        const iv = setInterval(() => {
          el.textContent = tick < 10 ? CHARS[Math.floor(Math.random() * CHARS.length)] : final;
          tick++;
          if (tick > 12) clearInterval(iv);
        }, 35);
      }, 400 + i * 70);
    });
  }, [word]);

  return (
    <div
      ref={ref}
      style={{ opacity: 0, clipPath: "inset(0 100% 0 0)" }}
      className="glass-panel rounded-lg p-5 border-l-4 border-l-green-400/70 flex items-center gap-5 relative overflow-hidden"
    >
      {/* Background glow */}
      <div className="absolute inset-0 bg-gradient-to-r from-green-400/5 to-transparent pointer-events-none" />
      <RadarPulse />
      <div>
        <p className="text-[10px] uppercase tracking-[0.25em] text-green-400 font-mono mb-1.5">
          ◈ Today's Active Word
        </p>
        <div className="flex items-baseline gap-1">
          {word.split("").map((ch, i) => (
            <span
              key={i}
              data-char={ch}
              ref={el => { lettersRef.current[i] = el; }}
              className="font-display font-black text-2xl text-primary tracking-widest"
            >
              {ch}
            </span>
          ))}
          {hint && (
            <span className="text-sm font-body text-muted-foreground ml-4">
              — {hint}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Word row with clip-path wipe entrance ───────────────────────────────────

function WordRow({
  word, idx, isToday, onEdit, onDelete, confirmingDelete,
}: {
  word: DailyWord; idx: number; isToday: boolean;
  onEdit: () => void; onDelete: () => void; confirmingDelete: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const accentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    anime({
      targets: ref.current,
      clipPath: ["inset(0 100% 0 0)", "inset(0 0% 0 0)"],
      opacity: [0, 1],
      duration: 600,
      delay: idx * 70 + 100,
      easing: "easeOutExpo",
    });
  }, [idx]);

  const onEnter = () => {
    if (!accentRef.current) return;
    anime({ targets: accentRef.current, scaleY: [0, 1], opacity: [0, 1], duration: 250, easing: "easeOutQuart" });
    if (ref.current) anime({ targets: ref.current, translateX: [0, 3], duration: 200, easing: "easeOutQuad" });
  };
  const onLeave = () => {
    if (!accentRef.current) return;
    anime({ targets: accentRef.current, scaleY: [1, 0], opacity: [1, 0], duration: 200, easing: "easeInQuart" });
    if (ref.current) anime({ targets: ref.current, translateX: [3, 0], duration: 200, easing: "easeOutQuad" });
  };

  return (
    <div
      ref={ref}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{ opacity: 0, clipPath: "inset(0 100% 0 0)" }}
      className={`glass-panel p-0 rounded-md flex flex-col md:flex-row items-stretch relative overflow-hidden ${isToday ? "ring-1 ring-green-400/30" : ""}`}
    >
      {/* Animated left accent */}
      <div
        ref={accentRef}
        className="absolute left-0 top-0 w-0.5 h-full bg-gradient-to-b from-transparent via-primary to-transparent origin-center pointer-events-none"
        style={{ opacity: 0, transform: "scaleY(0)" }}
      />

      {/* Date */}
      <div className="bg-black/40 p-4 md:w-28 flex flex-col justify-center items-center border-b md:border-b-0 md:border-r border-white/5 shrink-0">
        <span className="text-3xl font-black font-display text-primary leading-none">
          {format(new Date(word.date + "T00:00:00"), "dd")}
        </span>
        <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground font-mono mt-1">
          {format(new Date(word.date + "T00:00:00"), "MMM yyyy")}
        </span>
        {isToday && (
          <span className="mt-2 text-[8px] bg-green-500/20 text-green-400 border border-green-500/30 px-1.5 py-0.5 rounded-sm font-mono uppercase tracking-widest">
            ● Active
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 p-5 flex flex-col justify-center">
        <div className="flex items-center gap-3 mb-1.5">
          <h3 className="text-xl font-black tracking-[0.15em] font-display">{word.word}</h3>
          <span className="text-[10px] font-mono text-muted-foreground/60 border border-white/10 px-1.5 py-0.5 rounded">
            {word.word.length}L
          </span>
          {!word.isActive && (
            <span className="text-[9px] bg-destructive/20 text-destructive border border-destructive/30 px-2 py-0.5 rounded font-mono uppercase">
              Offline
            </span>
          )}
        </div>
        <p className="text-muted-foreground font-mono text-xs border-l-2 border-primary/20 pl-3">
          {word.hint ? `"${word.hint}"` : "— no hint"}
        </p>
      </div>

      {/* Actions */}
      <div className="p-4 flex items-center justify-end gap-2 border-t md:border-t-0 md:border-l border-white/5">
        <HsrButton variant="cyber" size="sm" onClick={onEdit}>
          <Edit className="w-3.5 h-3.5 mr-1" />
          Edit
        </HsrButton>
        <HsrButton
          variant="destructive"
          size="sm"
          onClick={onDelete}
          className={confirmingDelete ? "animate-pulse ring-1 ring-destructive/50" : ""}
        >
          {confirmingDelete ? <><XCircle className="w-3.5 h-3.5 mr-1" />Sure?</> : <Trash2 className="w-3.5 h-3.5" />}
        </HsrButton>
      </div>
    </div>
  );
}

// ─── Leaderboard row ──────────────────────────────────────────────────────────

function LeaderboardRow({ player, idx }: { player: UserStats; idx: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const medals = ["🥇", "🥈", "🥉"];
  const winRate = player.gamesPlayed > 0 ? Math.round((player.gamesWon / player.gamesPlayed) * 100) : 0;

  useEffect(() => {
    if (!ref.current) return;
    anime({
      targets: ref.current,
      translateX: [-50, 0],
      opacity: [0, 1],
      duration: 700,
      delay: idx * 90,
      easing: "easeOutExpo",
    });
    if (fillRef.current) {
      anime({
        targets: fillRef.current,
        width: ["0%", `${winRate}%`],
        duration: 1200,
        delay: idx * 90 + 500,
        easing: "easeOutExpo",
      });
    }
  }, [idx, winRate]);

  return (
    <div ref={ref} style={{ opacity: 0 }} className="glass-panel rounded-md p-4 flex items-center gap-4 relative overflow-hidden">
      {/* Win-rate progress stripe at bottom */}
      <div className="absolute bottom-0 left-0 h-0.5 w-full bg-white/5" />
      <div ref={fillRef} className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-primary via-secondary to-primary" style={{ width: 0 }} />

      <span className="w-8 text-center text-2xl shrink-0">{medals[idx] ?? <span className="font-mono text-sm text-muted-foreground">{idx + 1}</span>}</span>
      <div className="flex-1 min-w-0">
        <p className="font-display font-bold text-base truncate">{player.discordUsername}</p>
        <p className="text-[10px] text-muted-foreground font-mono">
          {player.gamesWon}W / {player.gamesPlayed}G · {winRate}% win rate
        </p>
      </div>
      <div className="flex gap-5 shrink-0">
        <div className="text-center">
          <p className="text-[9px] text-muted-foreground font-mono uppercase tracking-widest">Streak</p>
          <p className="font-display font-bold text-lg text-primary">🔥 {player.currentStreak}</p>
        </div>
        <div className="text-center">
          <p className="text-[9px] text-muted-foreground font-mono uppercase tracking-widest">Best</p>
          <p className="font-display font-bold text-lg text-secondary">⭐ {player.bestStreak}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Leaderboard panel ────────────────────────────────────────────────────────

function LeaderboardPanel() {
  const { data: board, isLoading } = useLeaderboard();
  return (
    <div className="space-y-3 mt-4">
      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : !board?.length ? (
        <div className="text-center py-20 text-muted-foreground">
          <Trophy className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-mono text-sm">No players yet — leaderboard populates once people play via Discord.</p>
        </div>
      ) : board.map((p, i) => <LeaderboardRow key={p.discordId} player={p} idx={i} />)}
    </div>
  );
}

// ─── Sliding tab indicator ────────────────────────────────────────────────────

function TabBar({ tab, onSwitch }: { tab: string; onSwitch: (t: "words" | "leaderboard") => void }) {
  const indicatorRef = useRef<HTMLDivElement>(null);
  const wordsRef = useRef<HTMLButtonElement>(null);
  const lbRef = useRef<HTMLButtonElement>(null);

  const moveIndicator = useCallback((to: "words" | "leaderboard") => {
    const btn = to === "words" ? wordsRef.current : lbRef.current;
    const bar = indicatorRef.current;
    if (!btn || !bar) return;
    anime({
      targets: bar,
      left: btn.offsetLeft,
      width: btn.offsetWidth,
      duration: 280,
      easing: "easeOutExpo",
    });
  }, []);

  useEffect(() => { moveIndicator(tab as "words" | "leaderboard"); }, [tab, moveIndicator]);

  return (
    <div className="relative flex border-b border-white/10">
      {/* Sliding underline */}
      <div ref={indicatorRef} className="absolute bottom-0 h-0.5 bg-primary rounded-full" style={{ left: 0, width: 0 }} />
      {[
        { key: "words" as const, label: "Word Database", ref: wordsRef },
        { key: "leaderboard" as const, label: "Leaderboard", ref: lbRef },
      ].map(t => (
        <button
          key={t.key}
          ref={t.ref}
          onClick={() => onSwitch(t.key)}
          className={`px-5 py-3 font-mono text-xs uppercase tracking-widest transition-colors ${tab === t.key ? "text-primary" : "text-muted-foreground hover:text-white"}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

type Tab = "words" | "leaderboard";

export default function Dashboard() {
  const { data: words, isLoading } = useDailyWords();
  const { data: todayWord } = useTodayWord();
  const deleteMutation = useDeleteDailyWord();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingWord, setEditingWord] = useState<DailyWord | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [tab, setTab] = useState<Tab>("words");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // Page load refs
  const heroRef = useRef<HTMLDivElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const btnRef = useRef<HTMLDivElement>(null);
  const tabBarRef = useRef<HTMLDivElement>(null);
  const tabContentRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // ── Entry animation ────────────────────────────────────────────────────────
  useEffect(() => {
    const tl = anime.timeline({ easing: "easeOutExpo" });

    tl.add({
      targets: heroRef.current,
      translateY: [-24, 0],
      opacity: [0, 1],
      duration: 800,
    });

    tl.add({
      targets: subtitleRef.current,
      translateX: [-16, 0],
      opacity: [0, 1],
      duration: 500,
    }, "-=400");

    tl.add({
      targets: btnRef.current,
      scale: [0.88, 1],
      opacity: [0, 1],
      duration: 450,
    }, "-=300");

    tl.add({
      targets: tabBarRef.current,
      translateY: [8, 0],
      opacity: [0, 1],
      duration: 350,
    }, "-=200");

    tl.add({
      targets: searchRef.current,
      translateY: [8, 0],
      opacity: [0, 1],
      duration: 350,
    }, "-=200");
  }, []);

  // ── Tab switch with slide ──────────────────────────────────────────────────
  const handleTabSwitch = (t: Tab) => {
    if (!tabContentRef.current || t === tab) { setTab(t); return; }
    anime({
      targets: tabContentRef.current,
      opacity: [1, 0],
      translateX: [0, t === "leaderboard" ? -16 : 16],
      duration: 180,
      easing: "easeInQuad",
      complete: () => {
        setTab(t);
        anime({
          targets: tabContentRef.current,
          opacity: [0, 1],
          translateX: [t === "leaderboard" ? 16 : -16, 0],
          duration: 320,
          easing: "easeOutExpo",
        });
      },
    });
  };

  const filteredWords = words
    ?.filter(w =>
      w.word.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.date.includes(searchQuery)
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const activeCount = words?.filter(w => w.isActive).length ?? 0;

  const handleDelete = (id: number) => {
    if (confirmDeleteId === id) { deleteMutation.mutate(id); setConfirmDeleteId(null); }
    else setConfirmDeleteId(id);
  };

  return (
    <div className="min-h-screen p-6 md:p-10 relative">
      <GridLines />

      <div className="max-w-7xl mx-auto space-y-8 relative z-10">

        {/* ── Hero header ─────────────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-xl glass-panel p-8 md:p-10">
          <StarField />

          {/* Corner brackets */}
          <div className="absolute top-3 left-3 w-5 h-5 border-t-2 border-l-2 border-primary/50" />
          <div className="absolute top-3 right-3 w-5 h-5 border-t-2 border-r-2 border-primary/50" />
          <div className="absolute bottom-3 left-3 w-5 h-5 border-b-2 border-l-2 border-primary/50" />
          <div className="absolute bottom-3 right-3 w-5 h-5 border-b-2 border-r-2 border-primary/50" />

          <div
            ref={heroRef}
            style={{ opacity: 0 }}
            className="relative flex flex-col md:flex-row justify-between items-start md:items-end gap-6"
          >
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
                  System: Astral Express Net · Admin Panel
                </span>
              </div>

              <h1 className="text-5xl md:text-7xl font-black font-display uppercase tracking-tighter leading-none">
                <span className="text-transparent bg-clip-text bg-gradient-to-br from-white via-primary/80 to-white/40">
                  <ScrambleText text="WORDLE" startDelay={200} />
                </span>
                <br />
                <span className="text-white/20 text-3xl md:text-4xl">
                  <ScrambleText text="PROTOCOL" startDelay={600} />
                </span>
              </h1>

              <p
                ref={subtitleRef}
                style={{ opacity: 0 }}
                className="text-muted-foreground mt-3 font-body text-base max-w-md"
              >
                Manage daily word sequences for the Discord Wordle bot.
              </p>
            </div>

            <div ref={btnRef} style={{ opacity: 0 }}>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <HsrButton size="lg" onClick={() => { setEditingWord(null); setIsDialogOpen(true); }} className="gap-2">
                    <Plus className="w-5 h-5" />
                    New Sequence
                  </HsrButton>
                </DialogTrigger>
                <WordDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} initialData={editingWord} />
              </Dialog>
            </div>
          </div>
        </div>

        {/* ── Stat cards ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Words",    value: words?.length ?? 0,          icon: Star,         color: "text-primary",   delay: 150 },
            { label: "Active Words",   value: activeCount,                  icon: CheckCircle2, color: "text-green-400", delay: 230 },
            { label: "Today's Word",   value: todayWord?.word ?? "—",       icon: Zap,          color: "text-secondary", delay: 310 },
            { label: "Next Date",      value: words?.length ? format(new Date(words[0].date + "T00:00:00"), "MMM dd") : "N/A",
              icon: Calendar, color: "text-accent", delay: 390 },
          ].map((s, i) => <StatCard key={i} {...s} />)}
        </div>

        {/* ── Today's word banner ──────────────────────────────────────────── */}
        {todayWord && <TodayWordBanner word={todayWord.word} hint={todayWord.hint} />}

        {/* ── Tabs ─────────────────────────────────────────────────────────── */}
        <div ref={tabBarRef} style={{ opacity: 0 }}>
          <TabBar tab={tab} onSwitch={handleTabSwitch} />
        </div>

        {/* ── Tab content ──────────────────────────────────────────────────── */}
        <div ref={tabContentRef}>
          {tab === "words" && (
            <>
              <div ref={searchRef} style={{ opacity: 0 }} className="relative mb-5">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search word or date..."
                  className="pl-11 h-11 bg-black/20 border-white/10 focus:border-primary/40 font-body"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="space-y-3">
                {isLoading ? (
                  <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                ) : !filteredWords?.length ? (
                  <div className="text-center py-20 text-muted-foreground font-mono text-sm">No sequences found.</div>
                ) : (
                  filteredWords.map((word, idx) => (
                    <WordRow
                      key={word.id}
                      word={word}
                      idx={idx}
                      isToday={todayWord?.id === word.id}
                      onEdit={() => { setEditingWord(word); setIsDialogOpen(true); }}
                      onDelete={() => handleDelete(word.id)}
                      confirmingDelete={confirmDeleteId === word.id}
                    />
                  ))
                )}
              </div>
            </>
          )}
          {tab === "leaderboard" && <LeaderboardPanel />}
        </div>
      </div>
    </div>
  );
}

// ─── Word dialog ──────────────────────────────────────────────────────────────

function WordDialog({
  open, onOpenChange, initialData,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; initialData: DailyWord | null;
}) {
  const createMutation = useCreateDailyWord();
  const updateMutation = useUpdateDailyWord();
  const fieldsRef = useRef<HTMLDivElement>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { word: "", hint: "", date: format(new Date(), "yyyy-MM-dd"), isActive: true },
  });

  useEffect(() => {
    if (!open) return;
    if (initialData) {
      form.reset({ word: initialData.word, hint: initialData.hint ?? "", date: initialData.date, isActive: initialData.isActive });
    } else {
      form.reset({ word: "", hint: "", date: format(new Date(), "yyyy-MM-dd"), isActive: true });
    }
    // Stagger form fields in
    if (fieldsRef.current) {
      const fields = fieldsRef.current.querySelectorAll(".field-row");
      anime({
        targets: fields,
        translateY: [16, 0],
        opacity: [0, 1],
        duration: 450,
        delay: anime.stagger(65, { start: 80 }),
        easing: "easeOutExpo",
      });
    }
  }, [open]);

  const isPending = createMutation.isPending || updateMutation.isPending;
  const wordValue = form.watch("word") ?? "";

  const onSubmit = (data: FormValues) => {
    if (initialData) updateMutation.mutate({ id: initialData.id, ...data }, { onSuccess: () => onOpenChange(false) });
    else createMutation.mutate(data, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <DialogContent className="bg-muted/96 backdrop-blur-2xl border-white/10 sm:max-w-[480px] text-foreground overflow-hidden">
      {/* Scan line */}
      <ScanLine />
      {/* Corner decor */}
      <div className="absolute top-2 right-8 w-6 h-6 border-t border-r border-primary/20 pointer-events-none" />
      <div className="absolute bottom-2 left-8 w-6 h-6 border-b border-l border-primary/20 pointer-events-none" />

      <DialogHeader>
        <DialogTitle className="text-xl font-display uppercase tracking-widest flex items-center gap-2">
          {initialData ? <Edit className="w-4 h-4 text-primary" /> : <Plus className="w-4 h-4 text-primary" />}
          {initialData ? "Modify Sequence" : "New Sequence"}
        </DialogTitle>
      </DialogHeader>

      <form onSubmit={form.handleSubmit(onSubmit)} className="mt-2">
        <div ref={fieldsRef} className="space-y-4">

          <div className="field-row space-y-1.5" style={{ opacity: 0 }}>
            <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">
              Word <span className="text-muted-foreground/50">(max 12 chars)</span>
            </Label>
            <div className="relative">
              <Input
                className="bg-black/30 border-white/10 font-mono text-2xl tracking-[0.3em] uppercase text-center focus:border-primary/50 h-14"
                maxLength={12}
                {...form.register("word")}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-muted-foreground/50">
                {wordValue.length}/12
              </span>
            </div>
            {form.formState.errors.word && <p className="text-xs text-destructive">{form.formState.errors.word.message}</p>}
          </div>

          <div className="field-row space-y-1.5" style={{ opacity: 0 }}>
            <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Active Date</Label>
            <Input type="date" className="bg-black/30 border-white/10 font-mono" {...form.register("date")} />
            {form.formState.errors.date && <p className="text-xs text-destructive">{form.formState.errors.date.message}</p>}
          </div>

          <div className="field-row space-y-1.5" style={{ opacity: 0 }}>
            <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">
              Hint <span className="text-muted-foreground/50">(optional · shown via /hint)</span>
            </Label>
            <Textarea
              className="bg-black/30 border-white/10 min-h-[80px] font-body text-sm"
              placeholder="e.g. A member of the Astral Express crew..."
              {...form.register("hint")}
            />
          </div>

          <div className="field-row flex items-center justify-between bg-black/20 p-4 rounded border border-white/5" style={{ opacity: 0 }}>
            <div>
              <Label className="text-sm">Active Status</Label>
              <p className="text-[10px] text-muted-foreground font-mono mt-0.5">Inactive words are skipped by the bot</p>
            </div>
            <Switch checked={form.watch("isActive")} onCheckedChange={v => form.setValue("isActive", v)} />
          </div>
        </div>

        <DialogFooter className="mt-6">
          <HsrButton type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</HsrButton>
          <HsrButton type="submit" disabled={isPending}>
            {isPending ? "Transmitting..." : initialData ? "Save Changes" : "Initialize"}
          </HsrButton>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

// ─── Scan line (used in dialog) ───────────────────────────────────────────────

function ScanLine() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    anime({
      targets: ref.current,
      top: ["-2px", "100%"],
      opacity: [0, 0.5, 0.5, 0],
      duration: 3200,
      easing: "linear",
      loop: true,
      delay: 600,
    });
  }, []);
  return (
    <div
      ref={ref}
      className="absolute left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent pointer-events-none z-20"
      style={{ top: 0, opacity: 0 }}
    />
  );
}

// NOTE: Add this to index.css for the clip-path animation support:
// .glass-panel { overflow: hidden; }  ← already there
// No extra CSS needed — all animations are driven by anime.js inline.
