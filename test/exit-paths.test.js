// A failure has to end the program. On 2026-09-06 a read that Arena refused went on to post an
// empty collection and print "You're all set! Your collection was saved"; the server had
// rejected it. Each case here runs upload.js for real, with the reader stubbed, and checks the
// exit code, that the success line never prints, and that nothing was posted (a bogus server
// address would turn a POST into "Unexpected error", exit 1).
//
//   node --test uploader/test
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

const HERE = __dirname;
const UPLOAD = path.join(HERE, "..", "upload.js");

function run(mode, withKey = true) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "mtgweb-uploader-"));
  if (withKey) {
    fs.mkdirSync(path.join(home, ".mtgweb"));
    fs.writeFileSync(path.join(home, ".mtgweb", "config.json"),
      JSON.stringify({ token: "mtgw_test", api: "http://127.0.0.1:9/" }));
  }
  const r = spawnSync(process.execPath,
    ["--require", path.join(HERE, "stub-mtga.js"), UPLOAD, "--no-pause"],
    { env: { ...process.env, MTGA_STUB: mode, USERPROFILE: home, HOME: home }, encoding: "utf-8" });
  fs.rmSync(home, { recursive: true, force: true });
  return { code: r.status, out: r.stdout + r.stderr };
}

// The same run, without blocking this process: the tests below answer the child's upload from
// a server living in THIS process, and spawnSync would hold the event loop and never answer.
function runAsync(mode, api) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "mtgweb-uploader-"));
  fs.mkdirSync(path.join(home, ".mtgweb"));
  fs.writeFileSync(path.join(home, ".mtgweb", "config.json"),
    JSON.stringify({ token: "mtgw_test", api }));
  return new Promise((resolve) => {
    const child = spawn(process.execPath,
      ["--require", path.join(HERE, "stub-mtga.js"), UPLOAD, "--no-pause"],
      { env: { ...process.env, MTGA_STUB: mode, USERPROFILE: home, HOME: home } });
    let out = "";
    child.stdout.on("data", (c) => { out += c; });
    child.stderr.on("data", (c) => { out += c; });
    child.on("close", (code) => {
      fs.rmSync(home, { recursive: true, force: true });
      resolve({ code, out });
    });
  });
}

// A server that accepts one upload and keeps the raw body, so a test can look at exactly what
// left the machine. Answers the way the real route does on success.
function server() {
  const got = { raw: "" };
  const srv = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => { body += c; });
    req.on("end", () => {
      got.raw = body;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: true, changed: true, summary: "Saved 200 cards for KNKTT#11111." }));
    });
  });
  return new Promise((resolve) => {
    srv.listen(0, "127.0.0.1", () => {
      resolve({ got, api: `http://127.0.0.1:${srv.address().port}/`, close: () => srv.close() });
    });
  });
}

test("a read Windows refused ends the run: no post, no success line", () => {
  const { code, out } = run("denied");
  assert.equal(code, 3, out);
  assert.match(out, /running elevated/);
  assert.doesNotMatch(out, /all set|was saved/);
  assert.doesNotMatch(out, /too few|did not accept|Unexpected error/);
});

test("an empty read ends the run before anything is sent", () => {
  const { code, out } = run("empty");
  assert.equal(code, 5, out);
  assert.match(out, /too few/);
  assert.doesNotMatch(out, /all set|was saved|did not accept|Unexpected error/);
});

test("Arena not running ends the run", () => {
  const { code, out } = run("closed");
  assert.equal(code, 3, out);
  assert.match(out, /not running/);
  assert.doesNotMatch(out, /all set/);
});

test("no key stored ends the run", () => {
  const { code, out } = run("denied", false);
  assert.equal(code, 2, out);
  assert.match(out, /No upload key/);
});

// The account read is a courtesy, never a gate. When Arena will not say who is signed in, the
// cards go up exactly as they did before 0.2.0, with no account block at all.
test("an account read that fails still uploads the cards", async () => {
  const s = await server();
  try {
    const { code, out } = await runAsync("ok", s.api);
    assert.equal(code, 0, out);
    assert.match(out, /all set/);
    assert.doesNotMatch(out, /Signed in to Arena/);
    const body = JSON.parse(s.got.raw);
    assert.equal(body.cards.length, 200);
    assert.equal("account" in body, false);
  } finally { s.close(); }
});

// The reader returns the whole AccountInformation object, email and access token included.
// Only the id and the display name may leave the machine, and the raw request body is what
// proves it, not the parsed object.
test("the account block carries only the id and the display name", async () => {
  const s = await server();
  try {
    const { code, out } = await runAsync("ok-account", s.api);
    assert.equal(code, 0, out);
    assert.match(out, /Signed in to Arena as KNKTT#11111/);
    assert.match(out, /Saved 200 cards for KNKTT#11111/);
    const body = JSON.parse(s.got.raw);
    assert.deepEqual(body.account, { id: "acc-1", name: "KNKTT#11111" });
    assert.doesNotMatch(s.got.raw, /secret@example|SECRET-TOKEN|accessToken|email|personaId/);
  } finally { s.close(); }
});
