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

# Bump package.json, tag and push; CI does the rest. e.g. just release minor
release bump="patch":
    #!/usr/bin/env bash
    set -euo pipefail

    case "{{bump}}" in
      patch|minor|major) ;;
      *) echo "not a bump: {{bump}} (want patch, minor or major)" >&2; exit 1 ;;
    esac

    number="$(node -e '
      const fs = require("fs");
      const current = JSON.parse(fs.readFileSync("package.json", "utf8")).version;
      const match = /^(\d+)\.(\d+)\.(\d+)(-[0-9A-Za-z.]+)?$/.exec(current);
      if (!match) throw new Error(`package.json version is not a version: ${current}`);
      let [, major, minor, patch, pre] = match;
      [major, minor, patch] = [major, minor, patch].map(Number);
      // A prerelease already carries the bump, so patch just drops the suffix.
      if (process.argv[1] === "major") { major += 1; minor = 0; patch = 0; }
      else if (process.argv[1] === "minor") { minor += 1; patch = 0; }
      else if (!pre) { patch += 1; }
      process.stdout.write(`${major}.${minor}.${patch}`);
    ' "{{bump}}")"
    tag="v${number}"

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
