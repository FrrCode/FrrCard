#!/usr/bin/env node
// Regenerates CHANGELOG.md from the git history. Commits are read as
// Conventional Commits (`type(scope)!: subject`) and grouped per tag.
//
//   node changelog.js           rewrite CHANGELOG.md
//   node changelog.js --check   exit 1 if CHANGELOG.md is out of date (CI)
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const OUT_PATH = path.join(__dirname, 'CHANGELOG.md');
const UNRELEASED = 'Unreleased';

// Rendered in this order; anything unparseable lands in "Other".
const SECTIONS = [
  ['feat', 'Features'],
  ['fix', 'Fixes'],
  ['perf', 'Performance'],
  ['refactor', 'Refactoring'],
  ['docs', 'Documentation'],
  ['style', 'Styling'],
  ['test', 'Tests'],
  ['build', 'Build'],
  ['ci', 'CI'],
  ['chore', 'Chores'],
  ['revert', 'Reverts'],
  ['other', 'Other'],
];

const HEADER = `# Changelog

All notable changes to FrrCard, newest first.

Generated from the git history by \`node changelog.js\` — edit the commit
messages, not this file. Entries come from [Conventional Commits](https://www.conventionalcommits.org/)
subjects; the layout follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
`;

const FIELD = '\x1f';
const RECORD = '\x1e';

function git(...args) {
  return execFileSync('git', args, { cwd: __dirname, encoding: 'utf8' }).trim();
}

// git@github.com:Owner/Repo.git and https://github.com/Owner/Repo.git both
// become https://github.com/Owner/Repo — used for commit and compare links.
function repoUrl() {
  let url;
  try {
    url = git('remote', 'get-url', 'origin');
  } catch {
    return null;
  }
  const ssh = url.match(/^git@([^:]+):(.+?)(?:\.git)?$/);
  if (ssh) return `https://${ssh[1]}/${ssh[2]}`;
  const https = url.match(/^https?:\/\/(.+?)(?:\.git)?$/);
  if (https) return `https://${https[1]}`;
  return null;
}

function readCommits() {
  const format = ['%H', '%h', '%ad', '%D', '%s', '%b'].join(FIELD) + RECORD;
  const log = git('log', '--no-merges', '--date=short', `--pretty=format:${format}`);
  if (!log) return [];

  return log.split(RECORD).map((r) => r.trim()).filter(Boolean).map((record) => {
    const [hash, short, date, refs, subject, body = ''] = record.split(FIELD);
    const tag = (refs.match(/tag: ([^,]+)/) || [])[1] || null;
    return { hash, short, date, tag, subject, body };
  });
}

function parseSubject(commit) {
  const m = commit.subject.match(/^(\w+)(?:\(([^)]*)\))?(!)?:\s*(.+)$/);
  const breaking = Boolean(m && m[3]) || /^BREAKING[ -]CHANGE:/m.test(commit.body);
  if (!m) return { type: 'other', scope: null, subject: commit.subject, breaking };

  const type = m[1].toLowerCase();
  const known = SECTIONS.some(([key]) => key === type);
  return {
    type: known ? type : 'other',
    scope: m[2] || null,
    subject: known ? m[4] : commit.subject,
    breaking,
  };
}

// Release plumbing: these describe the changelog rather than the project. The
// tag usually sits on the release commit, so they are filtered out of the
// entries but still open their release — see below.
const PLUMBING = /^chore\((changelog|release)\):/;

// Newest first: a tagged commit closes the section above it and opens its own.
function groupByRelease(commits) {
  const releases = [{ version: UNRELEASED, date: null, entries: [] }];

  for (const commit of commits) {
    // Open the release before dropping anything, or a tag sitting on a
    // plumbing commit would take its whole section down with it.
    if (commit.tag) releases.push({ version: commit.tag, date: commit.date, entries: [] });
    if (PLUMBING.test(commit.subject)) continue;
    releases[releases.length - 1].entries.push({ ...commit, ...parseSubject(commit) });
  }

  // A release with nothing but plumbing in it still happened; only an empty
  // Unreleased section is worth hiding.
  return releases.filter((r) => r.entries.length > 0 || r.version !== UNRELEASED);
}

function renderEntry(entry, url) {
  const scope = entry.scope ? `**${entry.scope}:** ` : '';
  const link = url ? ` ([\`${entry.short}\`](${url}/commit/${entry.hash}))` : ` (\`${entry.short}\`)`;
  return `- ${scope}${entry.subject}${link}`;
}

function renderRelease(release, previous, url) {
  const lines = [];
  const heading = url && previous
    ? `## [${release.version}](${url}/compare/${previous}...${release.version === UNRELEASED ? 'HEAD' : release.version})`
    : `## ${release.version}`;
  lines.push(release.date ? `${heading} — ${release.date}` : heading, '');

  const breaking = release.entries.filter((e) => e.breaking);
  if (breaking.length) {
    lines.push('### ⚠ Breaking changes', '');
    lines.push(...breaking.map((e) => renderEntry(e, url)), '');
  }

  for (const [type, title] of SECTIONS) {
    const entries = release.entries.filter((e) => e.type === type);
    if (!entries.length) continue;
    lines.push(`### ${title}`, '');
    lines.push(...entries.map((e) => renderEntry(e, url)), '');
  }

  return lines.join('\n');
}

function render() {
  const url = repoUrl();
  const releases = groupByRelease(readCommits());
  const body = releases
    .map((release, i) => renderRelease(release, releases[i + 1]?.version, url))
    .join('\n');

  return `${HEADER}\n${body || '_No commits yet._\n'}`;
}

function main() {
  const changelog = render();
  const check = process.argv.includes('--check');
  const current = fs.existsSync(OUT_PATH) ? fs.readFileSync(OUT_PATH, 'utf8') : null;

  if (check) {
    if (current === changelog) {
      console.log('CHANGELOG.md is up to date');
      return;
    }
    console.error('CHANGELOG.md is out of date — run `node changelog.js` and commit the result');
    process.exit(1);
  }

  if (current === changelog) {
    console.log('CHANGELOG.md unchanged');
    return;
  }
  fs.writeFileSync(OUT_PATH, changelog);
  console.log(`wrote ${path.relative(process.cwd(), OUT_PATH)}`);
}

main();
