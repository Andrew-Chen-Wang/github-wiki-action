#!/bin/bash
# Copyright 2023 Jacob Hummer
# SPDX-License-Identifier: Apache-2.0
set -e
if [[ -n $RUNNER_DEBUG ]]; then
  set -x
fi

export GITHUB_TOKEN="$INPUT_TOKEN"
export GITHUB_SERVER_URL="$INPUT_GITHUB_SERVER_URL"
export GITHUB_REPOSITORY="$INPUT_REPOSITORY"
export GH_HOST="${GITHUB_SERVER_URL#*//}"

export GIT_DIR && GIT_DIR=$(mktemp -d)
export GIT_WORK_TREE="$INPUT_PATH"
trap 'rm -rf "$GIT_DIR"' SIGINT SIGTERM ERR EXIT

gh auth setup-git
git config --global --add safe.directory "$GIT_DIR"

git init -b master
git remote add origin "$GITHUB_SERVER_URL/$GITHUB_REPOSITORY.wiki.git"

echo "$INPUT_IGNORE" >>"$GIT_DIR/info/exclude"
git add -Av

git config user.name github-actions[bot]
git config user.email 41898282+github-actions[bot]@users.noreply.github.com

git commit --allow-empty -m "$INPUT_COMMIT_MESSAGE"

if [[ $INPUT_DRY_RUN == true ]]; then
  echo 'Dry run'
  git remote show origin
  git show
  exit 0
fi

git push -f origin master
echo "wiki_url=$GITHUB_SERVER_URL/$GITHUB_REPOSITORY/wiki" >>"$GITHUB_OUTPUT"
