# Code signing policy

This document is required by the [SignPath Foundation](https://signpath.org/) and describes how
releases of this project are built, reviewed and signed.

## Team roles

This is a single-maintainer project.

| Role | Who |
|---|---|
| Author | Matias Kees ([@tutekees](https://github.com/tutekees)) |
| Reviewer | Matias Kees |
| Approver | Matias Kees |

Any change proposed by someone who is not a committer is reviewed by a committer before it is
merged. Every release is approved manually before signing. If the project gains additional
maintainers, this table will be updated before they are granted release rights.

All accounts with write access to the repository and to SignPath use multi-factor
authentication.

## How releases are built

Releases are built from the tagged source in this repository by the GitHub Actions workflow in
[`.github/workflows/build.yml`](.github/workflows/build.yml), which runs `npm ci` followed by
`npm run build`. The build produces a single Windows executable using
[`@yao-pkg/pkg`](https://github.com/yao-pkg/pkg), bundling
[`mtga-reader`](https://github.com/mtgatool/mtga-reader) (GPL-3.0).

No artifact is uploaded from a maintainer's machine. The SHA-256 of every released binary is
published in the release notes so anyone can verify that what they downloaded matches what was
built.

## Privacy

The program reads the list of cards owned in a locally running copy of MTG Arena and sends it,
together with an upload key that identifies the user's account, to the mtgweb service.

It transmits nothing else. It does not read or transmit account credentials, email addresses,
match history, or any other personal data, and it collects no telemetry. The full source of what
is sent is in [`upload.js`](upload.js), which is under 250 lines.

Users who prefer not to run this program can upload a collection export file to the website
instead, with nothing installed.

## Attribution

Free code signing is provided by [SignPath.io](https://signpath.io/), with a certificate by the
[SignPath Foundation](https://signpath.org/).

## Reporting a vulnerability

Open an issue at https://github.com/tutekees/mtgweb-uploader/issues, or contact the maintainer
directly if the issue should not be public.
