# Talking Video Ads

Write an ad script, pick a person from your team's actor library, and get back a video of them speaking it, in any of 31 languages. Batches turn a few hooks, actors and languages into every combination at once.

Inspired by https://arcads.ai

Built with [oss.new](https://oss.new) for [EveryApp](https://github.com/every-app/every-app).

## Features

- Build an actor library from uploaded portraits, tagged and searchable, private unless an admin shares them.
- Turn a script into a lip-synced video with a chosen actor, voice, delivery, language and aspect ratio.
- Generate batches of hook × actor × language variations and follow each one's status.
- Browse, search, sort and filter your ads; play, download, rename, duplicate, retry or delete them.

Left out: accounts and sign-in, which your Gateway handles; plans and credits; editing tools such as captions, music and B-roll; a stock actor catalogue; voice and actor swapping in existing videos; a public API; direct publishing to ad platforms.

## Setup

```sh
pnpm install
pnpm dev          # run locally
pnpm test         # unit tests
pnpm run deploy   # deploy behind your EveryApp Gateway
```

The release checks in `checks/` run against a packaged build with the oss.new runtime.

Video generation is an optional feature that uses Replicate. Create a token at https://replicate.com/account/api-tokens and add it to your Gateway with `everyapp provider add replicate`. There are no other secrets or settings; the database and file storage are created on deploy.

## Limitations

- Generation runs on your Replicate account and is billed there; a video takes a few minutes.
- The video model decides the final framing; portraits shot in the chosen aspect ratio come out best.
- Only Replicate's own file hosts are accepted for finished videos.
- Generation against real Replicate models was not part of local testing; the checks use a stand-in for Replicate's API.
