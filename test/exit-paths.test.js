// A failure has to end the program. On 2026-09-06 a read that Arena refused went on to post an
// empty collection and print "You're all set! Your collection was saved"; the server had
// rejected it. Each case here runs upload.js for real, with the reader stubbed, and checks the
// exit code, that the success line never prints, and that nothing was posted (a bogus server
// address would turn a POST into "Unexpected error", exit 1).
//
//   node --test uploader/test
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
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
