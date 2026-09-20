hostname := env("DEPLOY_HOST", "frrcode")

# Render every data/*.json into dist/<name>/
build:
    node build.js

# Build, then mirror dist/ onto the server
deploy : build
    rsync -avz --delete dist/ {{hostname}}:deployments/card

# Rewrite CHANGELOG.md from the git history
changelog:
    node changelog.js

# Fail if CHANGELOG.md is behind the history (what CI runs)
changelog-check:
    node changelog.js --check

# Bump package.json, tag and push; CI does the rest. e.g. just release v1.1.0
release version:
    #!/usr/bin/env bash
    set -euo pipefail

    number="{{version}}"
    number="${number#v}"
    tag="v${number}"

    if ! [[ "$number" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?$ ]]; then
      echo "not a version: {{version}} (want 1.2.3, 1.2.3-rc.1, or the same with a leading v)" >&2
      exit 1
    fi

    branch="$(git rev-parse --abbrev-ref HEAD)"
    if [[ "$branch" != "main" ]]; then
      echo "release from main, not $branch" >&2
      exit 1
    fi
    if ! git diff --quiet HEAD; then
      echo "working tree is dirty — commit first" >&2
      exit 1
    fi
    if git rev-parse -q --verify "refs/tags/$tag" >/dev/null; then
      echo "$tag already exists" >&2
      exit 1
    fi

    node -e '
      const fs = require("fs");
      const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
      pkg.version = process.argv[1];
      fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");
    ' "$number"

    git add package.json
    git commit -m "chore(release): $tag"
    git tag -a "$tag" -m "$tag"
    git push origin main
    git push origin "$tag"

    echo "pushed $tag — CI publishes the image and folds the tag into CHANGELOG.md"
