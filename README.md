# FrrCard

**A self-hosted digital business card.** One JSON file per person in, one static
page out — photo, tap-to-act contact links, and a QR code that points back at
the card's own URL.

No database, no tracking, no build toolchain, no third-party service holding your
contact details hostage. The build script is ~130 lines of plain Node with zero
runtime dependencies, and the output is a folder of `index.html` files you can
drop on any static host.

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

## Requirements

- Node.js 18 or newer (only for the build — the output is static)
- Optionally [`just`](https://github.com/casey/just) for the build/deploy recipes
  and `rsync` for deploying

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

# 3. Look at it
pnpm install && pnpm exec serve dist/jane
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
a default label, an `href` function, and whether it opens in a new tab.

### The credit link

Every card ends with a small, muted **Built with FrrCard** link back to this
repository. It's on by default — if FrrCard is useful to you, leaving it there is
how other people find it.

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

## What's in git, and what isn't

The repository tracks the machinery; your content stays on your machine.

```
build.js         ✅  the renderer
template.html    ✅  markup, CSS, copy-button script
justfile         ✅  build + deploy recipes
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
`{{OG_IMAGE}}`, `{{QR_IMAGE}}`, `{{QR_LABEL}}`, `{{LINKS}}`, `{{CREDIT}}`.

Colors live in the `:root` block at the top of the `<style>` tag, with a
`prefers-color-scheme: dark` override right below it. Referencing a token that
doesn't exist fails the build instead of rendering a literal `{{TYPO}}`.

## Notes

- **The QR code is fetched from `api.qrserver.com`** at page load — the one
  outside service the card touches. If you want it fully self-contained, generate
  the PNG yourself, drop it in `public/<name>/`, and point `QR_IMAGE` at it in
  `build.js`.
- **`--delete` is real.** `just deploy` mirrors `dist/` onto the target directory
  and removes anything else there. Give the cards their own directory.
- The build is not incremental: it re-renders every card every time. At this size
  that takes milliseconds.

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
