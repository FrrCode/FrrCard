# FrrCard

**A self-hosted digital business card.** One JSON file per person in, one static
page out — photo, tap-to-act contact links, a downloadable contact file, and a
QR code that points back at the card's own URL.

No database, no tracking, no build toolchain, no third-party service holding your
contact details hostage. The build script is a few hundred lines of plain Node
with zero runtime dependencies, and the output is a folder of `index.html` and
`contact.vcf` files you can drop on any static host.

Built by [frrcode.com](https://frrcode.com). Free to use, fork, and self-host —
just not to resell ([license](#license)).

**Live demo → [petr.nzrv.dev](https://petr.nzrv.dev)** — a card built by this repo,
running in production.

<p align="center">
  <img src="docs/card-light.png" alt="FrrCard in light mode" width="45%">
  &nbsp;&nbsp;
  <img src="docs/card-dark.png" alt="FrrCard in dark mode" width="45%">
</p>

<p align="center"><sub>The same card, light and dark — the theme follows the visitor's system setting.</sub></p>

---

## Why

Digital business card services want a monthly subscription for what is, in
substance, a single HTML page. FrrCard is that page:

- **Yours.** Your domain, your server, your contact data. It never leaves your box.
- **Fast.** One self-contained HTML file per card. No JS framework, no web fonts,
  no network calls beyond the QR image.
- **Multi-person.** Drop in a second JSON file and you have a second card — one
  repo can serve a whole family or team.
- **Native-feeling.** System font stack, automatic light/dark mode, `mailto:` /
  `tel:` / `wa.me` links that open the right app on a phone.
- **Shareable in person.** A built-in QR code and a one-tap copy-link button.
- **Saveable.** A **Save Contact** button hands over a `.vcf` — photo and all —
  that drops straight into iOS Contacts, Android, Outlook or anything else that
  reads vCard.

## Requirements

- Node.js 18 or newer (only for the build — the output is static)
- Optionally [`just`](https://github.com/casey/just) for the build/deploy recipes
  and `rsync` for deploying
- …or nothing but Docker, if you run the [prebuilt image](#docker)

## Quick start

```bash
git clone git@github.com:petr-nazarov/card.git frrcard
cd frrcard

# 1. Describe yourself
cp data/example.json.sample data/jane.json   # or write one from scratch — schema below
$EDITOR data/jane.json

# 2. Build
node build.js
# built dist/jane/index.html (jane.example.com)
# built dist/jane/contact.vcf (Jane Doe)

# 3. Look at it
node serve.js dist/jane          # http://localhost:8080
```

Everything under `dist/jane/` is the finished card. Upload it anywhere that
serves static files.

## The data file

Each `data/<name>.json` produces `dist/<name>/index.html`. The file name is the
output folder name and nothing else — pick whatever you like.

```json
{
  "name": "Jane Doe",
  "firstName": "Jane",
  "lastName": "Doe",
  "jobTitle": "Ceramicist & Studio Owner",
  "description": "Contact links, social profiles, and business card for Jane Doe.",
  "photoUrl": "./jane.jpg",
  "faviconUrl": "https://example.com/favicon.png",
  "domain": "jane.example.com",
  "links": [
    { "type": "website",  "value": "https://jane.example.com" },
    { "type": "schedule", "value": "https://cal.com/jane", "label": "Book a studio visit" },
    { "type": "email",    "value": "jane@example.com" },
    { "type": "whatsapp", "value": "+15551234567" }
  ]
}
```

| Field | Required | What it does |
|---|:---:|---|
| `name` | ✅ | Heading on the card, and the `og:site_name` |
| `firstName`, `lastName` | ✅ | `profile:first_name` / `profile:last_name` Open Graph tags |
| `jobTitle` | ✅ | Subtitle under the name, and part of the `<title>` |
| `description` | ✅ | Meta description and social-share blurb |
| `photoUrl` | ✅ | Profile image. Absolute URL, or a relative path into `public/<name>/` |
| `faviconUrl` | ✅ | Browser tab icon |
| `domain` | ✅ | Where the card will live. Drives the canonical URL and the QR target |
| `links` | ✅ | The buttons, rendered top to bottom in the order you list them |
| `qrTarget` | — | Override what the QR code encodes. Defaults to `https://<domain>/` |
| `credit` | — | `false` hides the "Built with FrrCard" footer link. Shown by default |
| `organization` | — | `ORG` in the contact file. Not shown on the card |
| `vcard` | — | `false` drops the Save Contact button and the `.vcf`. On by default |
| `vcardLabel` | — | Text on the Save Contact button. Defaults to `Save Contact` |

Every field marked required is used somewhere in the page, and the build does not
check for you — leave one out and the word `undefined` shows up in the rendered
card (or, for `links`, the build crashes). Fill them all in.

### Link types

Every entry is `{ "type": ..., "value": ... }` with an optional `"label"` to
override the default text. Each type brings its own inline SVG icon and knows how
to turn a bare value into the right kind of href.

| `type` | Default label | `value` should be | Becomes |
|---|---|---|---|
| `website` | Personal Website | full URL | the URL |
| `company` | Company Website | full URL | the URL |
| `schedule` | Schedule Meeting | full URL | the URL (Calendly, Cal.com, …) |
| `linkedin` | LinkedIn | full profile URL | the URL |
| `email` | Email | address | `mailto:` |
| `phone` | Phone | `+972585007535` | `tel:` with spaces and dashes stripped |
| `whatsapp` | WhatsApp | phone number | `https://wa.me/<digits>` |
| `telegram` | Telegram | `@handle`, `handle`, or full URL | `https://t.me/handle` |
| `instagram` | Instagram | `@handle`, `handle`, or full URL | `https://www.instagram.com/handle` |

An unrecognised `type` stops the build with `Unknown link type: "..."`. To add
your own, drop an entry into the `ICONS` map at the top of `build.js` — an SVG,
a default label, an `href` function, whether it opens in a new tab, and
optionally a `vcard` function returning the property it becomes in the contact
file.

## The contact file

Alongside `index.html`, each card gets a `dist/<name>/contact.vcf` built from the
same JSON, and a blue **Save Contact** button at the top of the links that points
at it. Tapping it on a phone opens the OS "add contact" sheet with everything
already filled in — the fastest way to end up in someone's address book after a
handshake.

It is vCard 3.0, the dialect iOS Contacts, Android and Outlook all read:

| From the data file | Becomes |
|---|---|
| `firstName`, `lastName`, `name` | `N` and `FN` |
| `jobTitle` | `TITLE` |
| `organization` | `ORG` |
| `email` links | `EMAIL;TYPE=INTERNET` |
| `phone` links | `TEL;TYPE=CELL,VOICE` |
| `website`, `company`, `schedule` links | `URL` |
| `linkedin`, `whatsapp`, `telegram`, `instagram` links | `X-SOCIALPROFILE` |
| `photoUrl` | `PHOTO`, base64-embedded |
| `domain` | `SOURCE` |

Each property is written in a labelled group (`item1.URL` + `item1.X-ABLabel`), so
the label you gave a link on the card — `"Book a studio visit"` and all — is the
label that shows up in Contacts.

**The photo is inlined.** The build reads it from `public/<name>/` or fetches the
remote URL once and embeds the bytes, so the saved contact keeps its picture
offline. If the image can't be read, is over 512 KB, or isn't a JPEG/PNG/GIF/WebP,
the build prints a note and falls back to a plain URL reference (or, for a local
file it couldn't read, no photo at all) — it never fails the build over a photo.

The button deliberately carries no `download` attribute: on iOS and Android that
makes the browser hand the file to the Contacts app instead of parking it in
Downloads. Add `download` in `build.js` if you prefer a plain file save.

Set `"vcard": false` to skip the button and the file entirely.

### The credit link

Every card ends with a small, muted **Built with FrrCard** link to the FrrCard
project page. It's on by default — if FrrCard is useful to you, leaving it there
is how other people find it.

Turning it off is one line in the card's data file, no strings attached:

```json
{
  "name": "Jane Doe",
  "credit": false
}
```

Only the literal `false` hides it; any other value (or no `credit` key at all)
leaves the link in place.

### Images and other assets

Anything in `public/<name>/` is copied into `dist/<name>/` next to the generated
`index.html`. So `public/jane/jane.jpg` is reachable from the card as
`"photoUrl": "./jane.jpg"` — no CDN, no hotlinking. Create the folder for a new
card yourself; if it doesn't exist, the build simply skips the copy.

## Deploying

```bash
just build                        # node build.js
just deploy                       # build, then rsync dist/ to the server
DEPLOY_HOST=my-server just deploy # override the target host (default: frrcode)
```

`just deploy` runs `rsync -avz --delete dist/ <host>:deployments/card`. Point the
recipe at wherever your web root lives.

The cards are plain static folders, so serving them is a few lines. One subdomain
per card, with Caddy:

```caddyfile
jane.example.com {
    root * /home/you/deployments/card/jane
    file_server
}
```

…or as paths on a single domain, with nginx:

```nginx
server {
    server_name example.com;
    root /home/you/deployments/card;
    location / { try_files $uri $uri/ $uri/index.html =404; }
}
```

GitHub Pages, Netlify, Cloudflare Pages, S3 and every other static host work just
as well — `dist/` is the whole artifact.

One thing worth checking: your host should send `contact.vcf` as `text/vcard` (or
`text/x-vcard`). Most already do. If yours falls back to `text/plain`, browsers
render the file as text instead of offering to save the contact — pin it
explicitly:

```caddyfile
# Caddy
header /contact.vcf Content-Type "text/vcard; charset=utf-8"
```

```nginx
# nginx
location = /contact.vcf { default_type text/vcard; }
```

## Docker

A prebuilt image lives at **`ghcr.io/frrcode/frrcard`** (amd64 and arm64). It
holds the renderer and a small static server — no card data is baked in. On start
it renders whatever JSON it finds in the mounted `data/` and serves the result.

The repo ships a `compose.yaml`:

```yaml
services:
  frrcard:
    image: ghcr.io/frrcode/frrcard:latest
    restart: unless-stopped
    ports:
      - "8080:8080"
    volumes:
      - ./data:/app/data:ro
      - ./public:/app/public:ro
```

```bash
docker compose up -d        # render the cards and serve them
docker compose restart      # re-render after editing a data file
docker compose logs -f      # the build output lands here
```

Every card is served under its own path: `data/jane.json` becomes
`http://localhost:8080/jane/`, with its contact file at `/jane/contact.vcf`. To
put a single card at the root instead, name it:

```yaml
    environment:
      CARD: jane
```

| Variable | Default | What it does |
|---|---|---|
| `PORT` | `8080` | Port inside the container |
| `HOST` | `0.0.0.0` | Interface to bind |
| `CARD` | — | Serve `dist/<CARD>` at `/` instead of every card under `/<name>/` |

A few things worth knowing:

- **Cards render at startup**, so editing a data file means `docker compose
  restart`. The build takes milliseconds.
- **`/` returns 404 when serving several cards.** There is no index listing who
  lives on the box — reach a card by its own path, or use `CARD`.
- **`/healthz`** answers `ok`; the image's `HEALTHCHECK` uses it.
- **Nothing is written to the host.** Add `- ./dist:/app/dist` to the volumes if
  you want the rendered files back on your side.
- **Build it yourself** with `docker compose build` after swapping `image:` for
  `build: .`, or `docker build -t frrcard .`.

Put a reverse proxy in front for real domains and TLS. One subdomain per card off
a single container, with Caddy:

```caddyfile
jane.example.com {
    rewrite * /jane{uri}
    reverse_proxy localhost:8080
}
```

…or run one container per card with `CARD` set and skip the rewrite.

`.github/workflows/docker.yml` builds the image on every push to `main` and every
`v*` tag, smoke-tests it against the example card, and pushes it to GHCR tagged
`latest`, the version, and the commit SHA. Pull requests build and test without
pushing. If you fork this and push your own image, note that GHCR creates the
package **private** — flip it to Public once in the repo's package settings.

## What's in git, and what isn't

The repository tracks the machinery; your content stays on your machine.

```
build.js         ✅  the renderer
serve.js         ✅  the static server (local look, and the image)
changelog.js     ✅  the CHANGELOG.md generator
template.html    ✅  markup, CSS, copy-button script
justfile         ✅  build, deploy, changelog + release recipes
Dockerfile       ✅  the image
compose.yaml     ✅  how to run it
.github/         ✅  the changelog and docker workflows
CHANGELOG.md     ✅  generated, committed
data/            ✅  folder tracked, contents ignored
public/<name>/   ✅  folder tracked, contents ignored
dist/            ❌  build output
```

Personal cards are never committed, so you can fork this publicly and push
freely without leaking a phone number. The content reaches production through
`just deploy`, which ships the rendered `dist/` — the JSON never goes anywhere
except your own server.

Keep your `data/` and `public/` files backed up somewhere; git isn't doing it
for you any more.

## Customizing the look

`template.html` is one file: markup, an embedded stylesheet, and a small copy-link
script. The build substitutes `{{PLACEHOLDER}}` tokens and changes nothing else,
so edit it like any static page.

Available tokens: `{{NAME}}`, `{{FIRST_NAME}}`, `{{LAST_NAME}}`, `{{JOB_TITLE}}`,
`{{DESCRIPTION}}`, `{{PHOTO_URL}}`, `{{FAVICON_URL}}`, `{{CANONICAL_URL}}`,
`{{OG_IMAGE}}`, `{{QR_IMAGE}}`, `{{QR_LABEL}}`, `{{VCARD}}`, `{{LINKS}}`,
`{{CREDIT}}`.

Colors live in the `:root` block at the top of the `<style>` tag, with a
`prefers-color-scheme: dark` override right below it. Referencing a token that
doesn't exist fails the build instead of rendering a literal `{{TYPO}}`.

## Changelog

[CHANGELOG.md](CHANGELOG.md) is generated, never hand-edited. `changelog.js` reads
the git history, parses each subject as a
[Conventional Commit](https://www.conventionalcommits.org/) (`type(scope)!: subject`),
and groups the entries under the tag they shipped in — anything past the newest tag
lands in **Unreleased**.

```bash
just changelog        # rewrite CHANGELOG.md
just changelog-check  # exit 1 if it is behind the history
just release v1.1.0   # cut a release
```

`just release` is the whole ceremony: it refuses anything but a clean `main` and
an unused semver tag, writes the version into `package.json`, commits that as
`chore(release): v1.1.0`, tags it, and pushes the branch and the tag. CI takes it
from there — the image goes to GHCR under `1.1.0`, `1.1` and `latest`, and the
changelog workflow folds everything that was under **Unreleased** into a
`## [v1.1.0]` section with a compare link and commits it back to `main`. Pull
afterwards, since that commit lands on top of yours.

Release commits describe the release rather than the project, so `changelog.js`
leaves them out of the entries — while still letting the tag on one open its
section.

`.github/workflows/changelog.yml` does it for you: every push to `main` and every
`v*` tag regenerates the file and commits it back to `main` if it changed. Writing
`feat: …` / `fix: …` / `docs: …` commit messages is the whole of the maintenance
burden — an unparseable subject still shows up, under **Other**, and `!` or a
`BREAKING CHANGE:` footer promotes an entry to a **Breaking changes** block at the
top of its release.

## Notes

- **The QR code is fetched from `api.qrserver.com`** at page load — the one
  outside service the card touches. If you want it fully self-contained, generate
  the PNG yourself, drop it in `public/<name>/`, and point `QR_IMAGE` at it in
  `build.js`.
- **`--delete` is real.** `just deploy` mirrors `dist/` onto the target directory
  and removes anything else there. Give the cards their own directory.
- **A remote `photoUrl` is fetched at build time** so it can be embedded in the
  `.vcf`. It is the only network call the build makes, it has an 8-second timeout,
  and failing it only costs you the photo in the contact file.
- The build is not incremental: it re-renders every card every time. At this size
  that takes milliseconds — plus one photo fetch per card with a remote photo.

## License

[ISC with the Commons Clause](LICENSE).

**Free to use and modify.** Run it for yourself, for your family, or for everyone
at the company you work for. Fork it, redesign the template, change whatever you
like — no fee, no permission needed. If you pass it on, keep the license notice
with it, as ISC asks.

**Not free to sell.** You may not charge third parties for a product or service
whose value comes substantially from FrrCard — a hosted card SaaS, a paid fork,
or client work billed for running it on their behalf. That needs written
permission — get in touch through [frrcode.com](https://frrcode.com).

Because of the Commons Clause this is *source-available*, not OSI open source.
If that distinction matters to your organisation, read the [LICENSE](LICENSE) in
full — it's short.

---

Made by **[frrcode.com](https://frrcode.com)**
