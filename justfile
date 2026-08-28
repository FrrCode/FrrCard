hostname := env("DEPLOY_HOST", "frrcode")

build:
    node build.js

deploy : build
    rsync -avz --delete dist/ {{hostname}}:deployments/card
