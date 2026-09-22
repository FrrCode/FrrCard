hostname := env("DEPLOY_HOST", "frrcode")
# Where the server's compose file lives, the frrcard service in it, and the
# directory its data/ and public/ mounts point at (relative to the ssh home).
compose_dir := env("DEPLOY_COMPOSE_DIR", ".")
service := env("DEPLOY_SERVICE", "frrcard")
card_dir := env("DEPLOY_CARD_DIR", "data/frrcard")

# Render every data/*.json into dist/<name>/
build:
    node build.js

# The local build is only a check: a broken data file fails here, not in production.
# The container is recreated, not restarted: cards only render on start, and a
# fresh dist/ drops any card whose JSON is gone. --wait holds until it is healthy.
# Sync data/ and public/ to the server, then run the latest released image on them
deploy : build
    rsync -avz --delete --include='*.json' --exclude='*' data/ {{hostname}}:{{card_dir}}/data/
    rsync -avz --delete --exclude='.gitkeep' public/ {{hostname}}:{{card_dir}}/public/
    ssh {{hostname}} 'cd {{compose_dir}} && docker compose pull -q {{service}} && docker compose up -d --force-recreate --wait {{service}}'

# Build, then mirror dist/ onto a static web root instead of running the image
deploy-static : build
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

    branch="$(git rev-parse --abbrev-ref HEAD)"
    if [[ "$branch" != "main" ]]; then
      echo "release from main, not $branch" >&2
      exit 1
    fi
    if ! git diff --quiet HEAD; then
      echo "working tree is dirty — commit first" >&2
      exit 1
    fi

    # CI commits CHANGELOG.md back to main after every push, so main is usually
    # a commit behind by the time anyone releases. Catch up before reading the
    # version out of package.json, rather than failing on the push at the end.
    git fetch --tags origin
    if ! git merge-base --is-ancestor origin/main HEAD; then
      if ! git merge-base --is-ancestor HEAD origin/main; then
        echo "main and origin/main have diverged — reconcile them first" >&2
        exit 1
      fi
      echo "fast-forwarding main to origin/main"
      git merge --ff-only origin/main
    fi

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
    # One atomic push: a rejected main must not leave the tag on the remote
    # pointing at a commit nobody has.
    if ! git push --atomic origin main "$tag"; then
      echo "push rejected — origin moved since the fetch; nothing was pushed." >&2
      echo "reconcile main with origin, then push main and $tag yourself." >&2
      exit 1
    fi

    echo "pushed $tag — CI publishes the image and folds the tag into CHANGELOG.md"
