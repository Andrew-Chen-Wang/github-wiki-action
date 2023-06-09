#!/bin/bash
# Copyright 2023 Jacob Hummer
# SPDX-License-Identifier: Apache-2.0

# Remember, this enables fail-fast mode! We want this for scripts. If a command
# returns a non-zero exit code, this -e makes us exit then-and-there.
set -e
# When a job fails, you can re-run it with debug mode enabled. This is exposed
# to scripts via the ${{ runner.debug }} or $RUNNER_DEBUG variable. Here, we
# use the -n test to see if the $RUNNER_DEBUG exists. If so, we use the -x flag
# to print a '+ cmd arg1 arg2' of each command that's run in the script. This
# helps with debugging what commands and $VAR expansions are actually happening.
if [[ -n $RUNNER_DEBUG ]]; then
  set -x
fi

# We overwrite the $GITHUB_* environment variables with user-provided ones.
# GitHub Actions normally provides a bunch of $GITHUB_* env vars. These can
# be used in scripts to tailor them to the current GitHub thing (repo, issue,
# etc). Here, we want to use these same variables, but with our custom
# user-provided values instead. We overwrite the originals (in this process;
# we can't affect our parent process) with the user-provided (or default)
# values so that we can use the same $GITHUB_REPOSITORY semantics to refer to
# the current repo that the action is on (the default) or the user-provided
# repo that we want to use instead. We use the same var names to make it
# familiar.
export GITHUB_TOKEN="$INPUT_TOKEN"
export GITHUB_SERVER_URL="$INPUT_GITHUB_SERVER_URL"
export GITHUB_REPOSITORY="$INPUT_REPOSITORY"
# This is the default host that gh uses for clones and commands without a repo
# context (a .git folder). We use Bash string magic to get the github.com part
# from a full origin (no pathname) like https://github.com => github.com. The
# '#*//' operation removes '*//' from the start of the string. That's the
# 'https://' chunk. With that gone, we are left with 'github.company.com' or
# something similar.
export GH_HOST="${GITHUB_SERVER_URL#*//}"

# We configure some special $GIT_* environment variables to make it so that
# we can have our special .git folder (you know, the one that holds all the
# critical repo information & history?) in a completely different location
# from our working tree! Normally, $GIT_DIR is automagically determined by
# walking up the folders from your $PWD until '.git/' is found. In this case,
# we want that in a temp folder. Then, we use $GIT_WORK_TREE to control what
# the base folder or "root" of the $GIT_DIR's repo should be. Normally, this
# would be the $PWD, but we want to set it to the $INPUT_PATH which is
# probably a subfolder of the project somwhere!
export GIT_DIR && GIT_DIR=$(mktemp -d)
export GIT_WORK_TREE="$INPUT_PATH"
# This is just good practice to clean up after yourself. It's not needed per-se.
# This is a one-off Actions runner that will delete every part of itself after
# completion. It's a good habit nonetheless.
trap 'rm -rf "$GIT_DIR"' SIGINT SIGTERM ERR EXIT

# This setup-git is a command is what makes it so that we can be authorized to
# do normal 'git clone' and 'git push' operations without using the gh CLI. It
# auto-adds the credentials for the host in $GH_HOST and any additional --host
# options passed to it. We need this to make it so that our 'git push' at the
# end of this script works!
gh auth setup-git
# We also need to preemptively mark the $GIT_DIR as safe to use. Normally Git
# will protect you against doing insecure stuff in untrusted areas, and that's
# a good thing! In this case, though, we know that what we are doing in this
# temp folder is OK.
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
