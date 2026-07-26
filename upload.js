#!/usr/bin/env node
/**
 * mtgweb desktop uploader.
 *
 * Reads your collection straight from the memory of the running MTG Arena process and sends it
 * to your mtgweb account. You do not export anything, you do not create an account anywhere
 * else, and it does not need administrator rights (measured: isAdmin() is false and the read
 * still returns the full collection).
 *
 * LICENSE: this program links mtga-reader (GPL-3.0-only), so this program is GPL. It runs as
 * its own process and talks to the server over HTTP, so the server is not a derived work.
 *
 * Config lives in ~/.mtgweb/config.json. The upload key is NEVER passed on the command line:
 * argv is visible to every other process on the machine and lands in shell history.
 *
 * Usage:
 *   node upload.js --setup     store your upload key and server
 *   node upload.js             read the collection and upload it
 *   node upload.js --dry       read it and print what would be sent
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const readline = require("readline");
const mtga = require("mtga-reader");

const CONFIG_DIR = path.join(os.homedir(), ".mtgweb");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");
const DEFAULT_API = "https://mtgweb.app";
const MIN_PLAUSIBLE_CARDS = 100;

// True when running as the packaged .exe rather than `node upload.js`.
const PACKAGED = Boolean(process.pkg);
// Where the user actually put the app. With pkg, __dirname points inside the virtual
// filesystem, so the real folder is the one holding the executable.
const APP_DIR = PACKAGED ? path.dirname(process.execPath) : __dirname;

/**
 * Config resolution, in order:
 *   1. mtgweb.key sitting next to the executable. The website hands out a zip containing the
 *      app and this file already filled in, so the common case is: unzip, double click, done.
 *      Nothing to paste and nothing to configure.
 *   2. ~/.mtgweb/config.json, written by --setup.
 *   3. Nothing, and we ask.
 */
function readConfig() {
  const beside = path.join(APP_DIR, "mtgweb.key");
  try {
    const raw = fs.readFileSync(beside, "utf-8").trim();
    const cfg = raw.startsWith("{") ? JSON.parse(raw) : { token: raw };
    if (cfg.token) return { token: cfg.token, api: cfg.api || DEFAULT_API, from: beside };
  } catch {
    /* fall through */
  }
  try {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
    return { ...cfg, from: CONFIG_FILE };
  } catch {
    return null;
  }
}

/** Keeps the console window readable when the app was double clicked. */
async function holdWindow() {
  if (!PACKAGED || process.argv.includes("--no-pause")) return;
  process.stdout.write("\nPress Enter to close. ");
  await new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question("", () => { rl.close(); resolve(); });
  });
}

function writeConfig(cfg) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  // 0600: the upload key is a credential.
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), { mode: 0o600 });
}

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    if (hidden) {
      const onData = (ch) => {
        if (["\n", "\r", ""].includes(ch.toString("utf-8"))) process.stdin.removeListener("data", onData);
        else readline.moveCursor(process.stdout, -1, 0);
      };
      process.stdin.on("data", onData);
    }
    rl.question(question, (a) => { rl.close(); resolve(a.trim()); });
  });
}

async function setup() {
  console.log("Paste the upload key from your mtgweb account page.");
  const token = await ask("Upload key: ");
  if (!token.startsWith("mtgw_")) {
    console.error("That does not look like an upload key. They start with mtgw_.");
    process.exit(2);
  }
  const api = (await ask(`Server [${DEFAULT_API}]: `)) || DEFAULT_API;
  writeConfig({ token, api });
  console.log(`Saved to ${CONFIG_FILE}. Run this again with Arena open to upload.`);
}

async function upload() {
  const cfg = readConfig();
  if (!cfg?.token) {
    console.error("No upload key stored yet. Run: node upload.js --setup");
    process.exit(2);
  }

  if (!(await mtga.findProcess("MTGA").catch(() => null))) {
    console.error("MTG Arena is not running. Open it, sign in, and try again.");
    process.exit(3);
  }

  const t0 = Date.now();
  let raw;
  try {
    raw = await mtga.readCollection("MTGA");
  } catch (e) {
    console.error("Could not read your collection: " + e.message);
    process.exit(4);
  }
  const ms = Date.now() - t0;

  // The reader reports precisely why it could not read, and that reason is actionable.
  // Swallowing it into "too few cards" sends the user hunting for the wrong problem.
  // Measured case: mid-match or on a submenu, Arena's WrapperController.Instance is null.
  if (raw?.error) {
    console.error("Could not read your collection yet: " + raw.error);
    console.error("Go to Arena's home screen (not in a match) and run this again.");
    process.exit(3);
  }
  const cards = raw?.cards ?? [];

  // Local guard: a partial read that the server accepts is worse than no upload at all. It
  // would tell the user they cannot build decks they can actually build.
  if (cards.length < MIN_PLAUSIBLE_CARDS) {
    console.error(
      `Only ${cards.length} cards came back in ${ms}ms, which is too few to be a real ` +
      `collection. Open the Collection screen in Arena and try again.`
    );
    process.exit(5);
  }

  const copies = cards.reduce((a, c) => a + (c.qty || 0), 0);
  console.log(`Read ${cards.length.toLocaleString("en-US")} distinct cards (${copies.toLocaleString("en-US")} copies) in ${ms}ms`);

  if (process.argv.includes("--dry")) {
    console.log("--dry: nothing was sent.");
    return;
  }

  const res = await fetch(cfg.api.replace(/\/$/, "") + "/api/v1/collection", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.token}` },
    body: JSON.stringify({ cards }),
  });
  const body = await res.json().catch(() => ({}));

  if (res.status === 401) {
    console.error("Your upload key was rejected. Generate a new one and run --setup again.");
    process.exit(6);
  }
  if (!res.ok) {
    console.error("The server did not accept this collection:");
    (body.messages ?? ["Unknown error."]).forEach((m) => console.error("  " + m));
    process.exit(7);
  }
  console.log(body.summary ?? "Uploaded.");
}

/**
 * Every exit goes through here so a double-clicked window never vanishes before the user has
 * read what happened. An error the user cannot see is the same as no error message at all.
 */
async function main() {
  try {
    await (process.argv.includes("--setup") ? setup() : upload());
  } catch (e) {
    console.error("Unexpected error: " + e.message);
    await holdWindow();
    process.exit(1);
  }
  await holdWindow();
}

// upload() calls process.exit on its failure paths; hold the window there too.
const realExit = process.exit.bind(process);
process.exit = (code) => {
  if (PACKAGED && code) {
    holdWindow().then(() => realExit(code));
    return undefined;
  }
  return realExit(code);
};

main();
