// Preloaded with --require: answers `require("mtga-reader")` with a stub driven by env, so a
// test can walk upload.js down each path without Arena, a real reader, or a server.
//
//   MTGA_STUB=denied      the reader could not open the process ("Access is denied")
//   MTGA_STUB=empty       the read worked and found nothing
//   MTGA_STUB=closed      Arena is not running
//   MTGA_STUB=ok          a real-looking collection; the account read throws
//   MTGA_STUB=ok-account  a real-looking collection and a full AccountInformation object, with
//                         the email and the access token the real reader also returns
// The bug only showed in the packaged .exe, where holdWindow() applies: pretend to be one.
process.pkg = process.pkg || { simulated: true };
const Module = require("module");
const load = Module._load;
const mode = process.env.MTGA_STUB || "denied";
const cards = Array.from({ length: 200 }, (_, i) => ({ grpId: 70000 + i, qty: 1 + (i % 4) }));
const stub = {
  findProcess: async () => (mode === "closed" ? null : { pid: 28500 }),
  readCollection: async () => {
    if (mode === "denied") {
      return { error: "could not open MTGA process (run elevated): Access is denied. (os error 5)" };
    }
    if (mode === "ok" || mode === "ok-account") return { cards };
    return { cards: [] };
  },
  readAccount: async () => {
    if (mode === "ok-account") {
      return {
        displayName: "KNKTT#11111", accountId: "acc-1", personaId: "p-1", gameId: "g-1",
        email: "secret@example.invalid", externalId: "x-1", countryCode: "AR",
        accessToken: "SECRET-TOKEN",
      };
    }
    throw new Error("WrapperController.Instance is null");
  },
};
Module._load = function (request, ...rest) {
  if (request === "mtga-reader") return stub;
  return load.call(this, request, ...rest);
};
