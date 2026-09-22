# Changelog

All notable changes to FrrCard, newest first.

Generated from the git history by `node changelog.js` — edit the commit
messages, not this file. Entries come from [Conventional Commits](https://www.conventionalcommits.org/)
subjects; the layout follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased](https://github.com/FrrCode/FrrCard/compare/v1.1.3...HEAD)

### Features

- **just:** deploy the released image instead of rsyncing dist ([`4b40012`](https://github.com/FrrCode/FrrCard/commit/4b4001285ff8e82b644644e08afe83be54d10155))

## [v1.1.3](https://github.com/FrrCode/FrrCard/compare/v1.1.2...v1.1.3) — 2026-09-22

### Features

- **qr:** generate the qr code locally at build time ([`96d54b1`](https://github.com/FrrCode/FrrCard/commit/96d54b12a1fd1cbcb3da60d135b720e74917de9b))

### CI

- **docker:** publish the image only for a release tag ([`9986231`](https://github.com/FrrCode/FrrCard/commit/99862312e774dd79305654f9332f980bc222c373))

## [v1.1.2](https://github.com/FrrCode/FrrCard/compare/v1.1.1...v1.1.2) — 2026-09-20


## [v1.1.1](https://github.com/FrrCode/FrrCard/compare/v1.1.0...v1.1.1) — 2026-09-20

### Features

- **docker:** serve a bundled example card when no data is mounted ([`f9ab568`](https://github.com/FrrCode/FrrCard/commit/f9ab568f178b64414840179c23e712f9a4c6e3ad))
- **cards:** add a cv link type and drop the Save Contact accent ([`400f073`](https://github.com/FrrCode/FrrCard/commit/400f073523963db2cd4b0c84aed71c76c4f7a550))

### Fixes

- **just:** sync main with origin before cutting a release ([`8d68909`](https://github.com/FrrCode/FrrCard/commit/8d689094d76d10048aca428838a3b1d542f5be9c))
- **release:** publish a GitHub release when a tag is pushed ([`d5bb9a5`](https://github.com/FrrCode/FrrCard/commit/d5bb9a5232c4b660399034cad35e04ec22ae6f57))

### Documentation

- **readme:** lead with docker compose and move the checkout to development ([`269f07a`](https://github.com/FrrCode/FrrCard/commit/269f07ad333cb87544dff73f6beb9e6f1feef7b8))

### Build

- **just:** derive the release version from a bump level ([`7f4a425`](https://github.com/FrrCode/FrrCard/commit/7f4a42507772ff2a98d65e1a443bbc2311624b17))

## v1.1.0 — 2026-09-20

### Features

- **release:** bump package.json as part of just release ([`0ccfdae`](https://github.com/FrrCode/FrrCard/commit/0ccfdae351abedd536be522789534f6540ebcd6f))
- **docker:** ship a minimal image that renders and serves the cards ([`a9f064d`](https://github.com/FrrCode/FrrCard/commit/a9f064d9bd6a3baa4c1c64f865141bdaf937c309))
- **changelog:** generate CHANGELOG.md from the git history ([`a554cce`](https://github.com/FrrCode/FrrCard/commit/a554cce180543d6f30501a999a835e88487cbcdb))
- **vcard:** add a downloadable contact file to every card ([`8179e52`](https://github.com/FrrCode/FrrCard/commit/8179e5217d4354c73b1617e8db4af1b8cf683872))

### Documentation

- document the Docker image and compose setup ([`3f3e31c`](https://github.com/FrrCode/FrrCard/commit/3f3e31c6957b7f119df447b3f8c802fa013cbabb))
- cover the contact file and the changelog workflow ([`62d41f1`](https://github.com/FrrCode/FrrCard/commit/62d41f153941126f7d664a1be929d7f7433de436))

### CI

- **docker:** build, smoke-test and push the image to GHCR ([`dfa58f8`](https://github.com/FrrCode/FrrCard/commit/dfa58f831d0403d1f54c4d28fc2e4b73a15dc8ab))

### Chores

- point credit link at the FrrCard project page ([`95fd500`](https://github.com/FrrCode/FrrCard/commit/95fd5007ec8274e22f7076d47d0fa5f390b529f6))
- First public commit ([`3b32782`](https://github.com/FrrCode/FrrCard/commit/3b327826f0ad68052c734ad47e5dc2ddbde45fd1))
