/**
 * keep-alive.js
 * Pings your Render app every 14 minutes to prevent it from spinning down.
 *
 * Usage:
 *   node keep-alive.js https://your-app.onrender.com
 *
 * Or set the URL as an env var and just run:
 *   APP_URL=https://your-app.onrender.com node keep-alive.js
 */

const APP_URL = process.argv[2] || process.env.APP_URL;
const INTERVAL_MINUTES = 14;
const INTERVAL_MS = INTERVAL_MINUTES * 60 * 1000;

if (!APP_URL) {
  console.error("❌  No URL provided.");
  console.error("    Usage: node keep-alive.js https://your-app.onrender.com");
  process.exit(1);
}

function timestamp() {
  return new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

async function ping() {
  const start = Date.now();
  try {
    const res = await fetch(APP_URL, { signal: AbortSignal.timeout(10_000) });
    const ms = Date.now() - start;
    console.log(`[${timestamp()}] ✅  ${res.status} — responded in ${ms}ms`);
  } catch (err) {
    const ms = Date.now() - start;
    console.error(`[${timestamp()}] ❌  Ping failed after ${ms}ms — ${err.message}`);
  }
}

console.log(`🚂  HSR Wordle keep-alive started`);
console.log(`    Target : ${APP_URL}`);
console.log(`    Interval: every ${INTERVAL_MINUTES} minutes`);
console.log(`    Started : ${new Date().toLocaleString()}`);
console.log("");

// Ping immediately on start, then on the interval
ping();
setInterval(ping, INTERVAL_MS);
