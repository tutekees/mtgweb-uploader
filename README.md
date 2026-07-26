# mtgweb uploader

Reads your **Magic: The Gathering Arena** card collection directly from the running game and
sends it to your account on [mtgweb](https://mtgweb.vercel.app), so the site can tell you which
Brawl decks you are able to build.

## What it does

1. Checks that MTG Arena is running.
2. Reads the list of cards you own out of the game's memory, using
   [mtga-reader](https://github.com/mtgatool/mtga-reader).
3. Sends that list to your mtgweb account, authenticated with an upload key.

That is the whole program. It takes about a second.

## What it does NOT do

- **It never asks for administrator rights.** Other Arena trackers require them. This one does not.
- **It reads only your card list.** Not your account details, not your email, not your match
  history, not your decks.
- **It sends nothing else.** The only thing that leaves your machine is a list of card ids and
  quantities, plus your upload key so we know which account it belongs to.
- **It stores no credentials for Arena or Wizards of the Coast.** It never sees them.

You can verify all of this: it is a single file, [`upload.js`](upload.js), about 200 lines.

## Requirements

- Windows (a build for other platforms is possible; `mtga-reader` ships Linux and macOS binaries).
- MTG Arena running and sitting on the **main menu**. The reader cannot see the collection while
  a match is in progress, and will tell you so.

## Usage

Download the zip from your mtgweb account page. It contains this app and a `mtgweb.key` file
holding your upload key. Unzip both into the same folder and run the app.

If you would rather build it yourself:

```bash
npm install
node upload.js --setup    # stores your upload key in ~/.mtgweb/config.json
node upload.js            # reads your collection and uploads it
node upload.js --dry      # reads it and prints what it found, sends nothing
```

Your upload key is never passed on the command line. Command line arguments are visible to every
other process on the machine and end up in shell history, so the key is read from a config file
or from a `mtgweb.key` placed beside the executable.

## Building the executable

```bash
npm install
npm run build     # produces dist/mtgweb-uploader.exe
```

The native reader module is bundled into the executable, so the resulting `.exe` is standalone.

## Unsigned builds

Releases are currently unsigned, so Windows SmartScreen will warn about an unknown publisher.
The program reads another process's memory, which is what every Arena tracker does, and code
signing certificates cost money this project does not have.

If that is not acceptable to you, mtgweb also accepts a collection export file from any common
tracker, with no software to install. It gets you the same result.

## License

GPL-3.0-only. This program links [mtga-reader](https://github.com/mtgatool/mtga-reader), which
is GPL-3.0, so this program is too. The mtgweb web service is a separate program that
communicates with this one over HTTP and is not a derived work.
