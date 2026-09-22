#!/usr/bin/env node
// Renders template.html against each data/*.json into dist/<name>/index.html,
// plus a downloadable dist/<name>/contact.vcf built from the same data.
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-generator');

const ROOT = __dirname;
const TEMPLATE_PATH = path.join(ROOT, 'template.html');
const DATA_DIR = path.join(ROOT, 'data');
const PUBLIC_DIR = path.join(ROOT, 'public');
const DIST_DIR = path.join(ROOT, 'dist');
// Demo card, rendered only when data/ holds no JSON of its own. It is what a
// fresh `docker compose up` serves instead of a 404.
const EXAMPLE_PATH = path.join(ROOT, 'example.json');
const EXAMPLE_KEY = 'example';
const CREDIT_URL = 'https://apps.frrcode.com/en/frrcard/';

const QR_FILE = 'qr.svg';
const VCARD_FILE = 'contact.vcf';
const VCARD_LABEL = 'Save Contact';
const PHOTO_TIMEOUT_MS = 8000;
// Base64 of anything much larger makes a .vcf that some address books refuse.
const PHOTO_MAX_BYTES = 512 * 1024;

// Small "Built with FrrCard" link in the card footer. Opt out per card with
// `"credit": false` in the data file.
const CREDIT_HTML =
  `    <a class="credit" href="${CREDIT_URL}" target="_blank" rel="noopener">Built with FrrCard</a>`;

const VCARD_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>';

// Each link type carries its icon, its default label, how to turn a bare value
// into an href, and — optionally — the vCard property it becomes. vCard values
// here are all URIs, phone numbers or addresses, so they are written verbatim;
// only free text (names, labels) goes through escapeVcard().
const ICONS = {
  website: {
    label: 'Personal Website',
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
    href: (v) => v,
    external: true,
    vcard: (v) => ({ prop: 'URL', value: v }),
  },
  company: {
    label: 'Company Website',
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>',
    href: (v) => v,
    external: true,
    vcard: (v) => ({ prop: 'URL;TYPE=WORK', value: v }),
  },
  cv: {
    label: 'CV',
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
    href: (v) => v,
    external: true,
    vcard: (v) => ({ prop: 'URL', value: v }),
  },
  schedule: {
    label: 'Schedule Meeting',
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    href: (v) => v,
    external: true,
    vcard: (v) => ({ prop: 'URL', value: v }),
  },
  linkedin: {
    label: 'LinkedIn',
    svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.48-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.11 20.45H3.56V9h3.55v11.45z"/></svg>',
    href: (v) => v,
    external: true,
    vcard: (v) => ({ prop: 'X-SOCIALPROFILE;TYPE=linkedin', value: v }),
  },
  email: {
    label: 'Email',
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 6 12 13 2 6"/></svg>',
    href: (v) => `mailto:${v}`,
    vcard: (v) => ({ prop: 'EMAIL;TYPE=INTERNET', value: v }),
  },
  phone: {
    label: 'Phone',
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
    href: (v) => `tel:${v.replace(/[\s-]/g, '')}`,
    vcard: (v) => ({ prop: 'TEL;TYPE=CELL,VOICE', value: v.replace(/[\s-]/g, '') }),
  },
  whatsapp: {
    label: 'WhatsApp',
    svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2zm0 18.13a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.11.82.83-3.03-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.55-3.7 8.24-8.26 8.24zm4.52-6.16c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.13-.17.24-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.04-.38-1.98-1.22-.73-.65-1.23-1.46-1.37-1.7-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.36-.77-1.86-.2-.48-.41-.42-.56-.43-.14-.01-.31-.01-.48-.01-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.57.12.17 1.75 2.67 4.24 3.74.59.26 1.06.41 1.42.53.6.19 1.14.16 1.57.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.1-.23-.16-.48-.28z"/></svg>',
    href: (v) => `https://wa.me/${v.replace(/[^\d]/g, '')}`,
    external: true,
    vcard: (v) => ({ prop: 'X-SOCIALPROFILE;TYPE=whatsapp', value: `https://wa.me/${v.replace(/[^\d]/g, '')}` }),
  },
  telegram: {
    label: 'Telegram',
    svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 3.5 2.5 11.2c-1.1.44-1.1 1.06-.2 1.34l4.98 1.56L18.9 6.9c.5-.32.96-.15.58.2l-9.1 8.23h-.01l.35 5.1c.5 0 .72-.23 1-.5l2.4-2.35 5 3.7c.92.5 1.58.24 1.82-.86L23.94 5c.36-1.34-.5-1.94-1.94-1.5z"/></svg>',
    href: (v) => (v.startsWith('http') ? v : `https://t.me/${v.replace(/^@/, '')}`),
    external: true,
    vcard: (v) => ({
      prop: 'X-SOCIALPROFILE;TYPE=telegram',
      value: v.startsWith('http') ? v : `https://t.me/${v.replace(/^@/, '')}`,
    }),
  },
  instagram: {
    label: 'Instagram',
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><line x1="17.5" y1="6.5" x2="17.5" y2="6.5"/></svg>',
    href: (v) => (v.startsWith('http') ? v : `https://www.instagram.com/${v.replace(/^@/, '')}`),
    external: true,
    vcard: (v) => ({
      prop: 'X-SOCIALPROFILE;TYPE=instagram',
      value: v.startsWith('http') ? v : `https://www.instagram.com/${v.replace(/^@/, '')}`,
    }),
  },
};

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function renderLink(link) {
  const icon = ICONS[link.type];
  if (!icon) throw new Error(`Unknown link type: "${link.type}"`);
  const href = icon.href(link.value);
  const label = escapeHtml(link.label || icon.label);
  const target = icon.external ? ' target="_blank" rel="noopener"' : '';
  return `      <a class="link" href="${escapeHtml(href)}"${target}>\n        ${icon.svg}\n        ${label}\n      </a>`;
}

// --- vCard -----------------------------------------------------------------

// RFC 2426 text values: backslash, comma, semicolon and newlines are escaped.
function escapeVcard(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/([,;])/g, '\\$1');
}

// RFC 2426 says no line may exceed 75 octets; longer ones continue on the next
// line behind a single space. Base64 photos depend on this.
function foldLine(line) {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;

  const chunks = [];
  let start = 0;
  while (start < bytes.length) {
    const width = chunks.length === 0 ? 75 : 74; // continuations spend one octet on the space
    let end = Math.min(start + width, bytes.length);
    // Never split in the middle of a UTF-8 sequence.
    while (end > start + 1 && end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
    chunks.push((chunks.length ? ' ' : '') + bytes.subarray(start, end).toString('utf8'));
    start = end;
  }
  return chunks.join('\r\n');
}

function imageType(contentType, src) {
  const hint = (contentType || path.extname(src)).toLowerCase();
  if (hint.includes('jpeg') || hint.includes('jpg')) return 'JPEG';
  if (hint.includes('png')) return 'PNG';
  if (hint.includes('gif')) return 'GIF';
  if (hint.includes('webp')) return 'WEBP';
  return null;
}

// Inlines the profile photo so the saved contact carries its own picture.
// Anything that goes wrong (offline build, oversized image, odd format) falls
// back to a plain URI reference rather than failing the build.
async function photoProperty(data, key) {
  const src = data.photoUrl;
  const remote = /^https?:\/\//i.test(src);

  // A data: URI carries its own bytes — nothing to fetch or read off disk. SVG
  // is the one format address books tend to refuse, so it is left out of the
  // contact file without a warning; the card page still shows it.
  if (/^data:/i.test(src)) {
    const comma = src.indexOf(',');
    if (comma === -1) return null;
    const meta = src.slice('data:'.length, comma);
    const type = imageType(meta.split(';')[0], '');
    if (!type) return null;
    const body = src.slice(comma + 1);
    const buffer = meta.includes('base64')
      ? Buffer.from(body, 'base64')
      : Buffer.from(decodeURIComponent(body), 'utf8');
    if (buffer.length > PHOTO_MAX_BYTES) {
      console.warn(`  photo not embedded (${Math.round(buffer.length / 1024)} KB exceeds the ${PHOTO_MAX_BYTES / 1024} KB embed limit) — skipping it`);
      return null;
    }
    return `PHOTO;ENCODING=b;TYPE=${type}:${buffer.toString('base64')}`;
  }

  try {
    let buffer;
    let type;
    if (remote) {
      const res = await fetch(src, { signal: AbortSignal.timeout(PHOTO_TIMEOUT_MS) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      buffer = Buffer.from(await res.arrayBuffer());
      type = imageType(res.headers.get('content-type'), src);
    } else {
      buffer = fs.readFileSync(path.join(PUBLIC_DIR, key, src.replace(/^\.\//, '')));
      type = imageType(null, src);
    }
    if (!type) throw new Error('unsupported image format');
    if (buffer.length > PHOTO_MAX_BYTES) {
      throw new Error(`${Math.round(buffer.length / 1024)} KB exceeds the ${PHOTO_MAX_BYTES / 1024} KB embed limit`);
    }
    return `PHOTO;ENCODING=b;TYPE=${type}:${buffer.toString('base64')}`;
  } catch (err) {
    console.warn(`  photo not embedded (${err.message}) — ${remote ? 'referencing its URL instead' : 'skipping it'}`);
    return remote ? `PHOTO;VALUE=URI:${src}` : null;
  }
}

function renderVcard(data, photo, canonicalUrl) {
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${escapeVcard(data.lastName)};${escapeVcard(data.firstName)};;;`,
    `FN:${escapeVcard(data.name)}`,
  ];
  if (data.organization) lines.push(`ORG:${escapeVcard(data.organization)}`);
  if (data.jobTitle) lines.push(`TITLE:${escapeVcard(data.jobTitle)}`);

  // Property groups (`item1.URL` + `item1.X-ABLabel`) are plain vCard grammar,
  // so the labels shown on the card survive the import into Contacts.
  let group = 0;
  for (const link of data.links) {
    const icon = ICONS[link.type];
    if (!icon) throw new Error(`Unknown link type: "${link.type}"`);
    if (!icon.vcard) continue;
    const { prop, value } = icon.vcard(link.value);
    const name = `item${++group}`;
    lines.push(`${name}.${prop}:${value}`);
    lines.push(`${name}.X-ABLabel:${escapeVcard(link.label || icon.label)}`);
  }

  if (photo) lines.push(photo);
  lines.push(`SOURCE:${canonicalUrl}`);
  lines.push(`REV:${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}`);
  lines.push('END:VCARD');

  return lines.map(foldLine).join('\r\n') + '\r\n';
}

// --- QR code ---------------------------------------------------------------

// Rendered locally at build time, so viewing a card calls no outside service.
// UTF-8 so a non-ASCII qrTarget encodes the way phone scanners decode it.
qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];

function renderQr(text) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  // No quiet zone of its own: the .qr-section img padding supplies it.
  return qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
}

// --- page ------------------------------------------------------------------

function render(template, data) {
  const linksHtml = data.links.map(renderLink).join('\n');
  const canonicalUrl = `https://${data.domain}/`;
  const vcardHtml = data.vcard === false
    ? ''
    : `      <a class="link" href="./${VCARD_FILE}" type="text/vcard">\n        ${VCARD_ICON}\n        ${escapeHtml(data.vcardLabel || VCARD_LABEL)}\n      </a>\n`;

  const replacements = {
    NAME: data.name,
    FIRST_NAME: data.firstName,
    LAST_NAME: data.lastName,
    JOB_TITLE: data.jobTitle,
    PHOTO_URL: data.photoUrl,
    FAVICON_URL: data.faviconUrl,
    CANONICAL_URL: canonicalUrl,
    DESCRIPTION: data.description,
    OG_IMAGE: data.photoUrl,
    QR_IMAGE: `./${QR_FILE}`,
    QR_LABEL: data.domain,
    VCARD: vcardHtml,
    LINKS: linksHtml,
    CREDIT: data.credit === false ? '' : CREDIT_HTML,
  };

  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (!(key in replacements)) throw new Error(`Missing template value for {{${key}}}`);
    return replacements[key];
  });
}

async function main() {
  const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  const cards = fs.existsSync(DATA_DIR)
    ? fs
        .readdirSync(DATA_DIR)
        .filter((f) => f.endsWith('.json'))
        .map((f) => ({ key: path.basename(f, '.json'), file: path.join(DATA_DIR, f) }))
    : [];

  // An empty or missing data/ is a first run, not an error: render the bundled
  // example so there is a real card to look at, and say how to replace it.
  if (!cards.length && fs.existsSync(EXAMPLE_PATH)) {
    cards.push({ key: EXAMPLE_KEY, file: EXAMPLE_PATH });
    console.log('no data/*.json found — building the bundled example card');
    console.log(`put your own <name>.json in data/ and restart to replace dist/${EXAMPLE_KEY}/`);
  } else if (!cards.length) {
    console.log('no data/*.json found and no bundled example.json — nothing to build');
  }

  for (const { key, file } of cards) {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const html = render(template, data);
    const outDir = path.join(DIST_DIR, key);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'index.html'), html);
    fs.writeFileSync(path.join(outDir, QR_FILE), renderQr(data.qrTarget || `https://${data.domain}/`));

    const publicDir = path.join(PUBLIC_DIR, key);
    if (fs.existsSync(publicDir)) {
      fs.cpSync(publicDir, outDir, { recursive: true });
    }

    console.log(`built dist/${key}/index.html (${data.domain})`);

    if (data.vcard !== false) {
      const canonicalUrl = `https://${data.domain}/`;
      const photo = await photoProperty(data, key);
      fs.writeFileSync(path.join(outDir, VCARD_FILE), renderVcard(data, photo, canonicalUrl));
      console.log(`built dist/${key}/${VCARD_FILE} (${data.name})`);
    }
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
