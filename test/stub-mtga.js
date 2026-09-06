// Preloaded with --require: answers `require("mtga-reader")` with a stub driven by env, so a
// test can walk upload.js down each failure path without Arena, a real reader, or a server.
//
//   MTGA_STUB=denied   the reader could not open the process ("Access is denied")
//   MTGA_STUB=empty    the read worked and found nothing
//   MTGA_STUB=closed   Arena is not running
// The bug only showed in the packaged .exe, where holdWindow() applies: pretend to be one.
process.pkg = process.pkg || { simulated: true };
const Module = require("module");
const load = Module._load;
const mode = process.env.MTGA_STUB || "denied";
const stub = {
  findProcess: async () => (mode === "closed" ? null : { pid: 28500 }),
  readCollection: async () => {
    if (mode === "denied") {
      return { error: "could not open MTGA process (run elevated): Access is denied. (os error 5)" };
    }
    return { cards: [] };
  },
};
Module._load = function (request, ...rest) {
  if (request === "mtga-reader") return stub;
  return load.call(this, request, ...rest);
};
