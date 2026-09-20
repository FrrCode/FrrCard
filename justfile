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

# Tag a release; the changelog workflow folds it into CHANGELOG.md
release version:
    @git diff --quiet HEAD || { echo "working tree is dirty — commit first"; exit 1; }
    git tag -a {{version}} -m "{{version}}"
    git push origin {{version}}
