**Quick Bash recap:** Remember that `if [[ -n $VAR ]]` means "if var is non-zero
length" and `if [[ -z $VAR ]]` means "if var is zero length". We use this to
check for the presence of variables too.

At the top of the file, we first `set -e` like good programmers to make sure
that errors _do propogate_ instead of being swallowed. Then, we conditionally
`set -x` to debug log only if the current Job is in debug mode.

When a job fails, you can re-run it with debug mode enabled. This is exposed
to scripts via the `${{ runner.debug }}` or `$RUNNER_DEBUG` variable. Here, we
use the -n test to see if the $RUNNER_DEBUG exists. If so, we use the `-x` flag
to print a `+ cmd arg1 arg2` of each command that's run in the script. This
helps with debugging what commands and `$VAR` expansions are actually happening.

We use a convention of overwriting the existing `GITHUB_*` env vars with our own
equivalent settings that we recieved from the user in the `github-server-url:`
and `token:` inputs. This is just a convention so that we can continue to use
`$GITHUB_TOKEN`.

```sh
# This is the default host that gh uses for clones and commands without a repo
# context (a .git folder). We use Bash string magic to get the github.com part
# from a full origin (no pathname) like https://github.com => github.com. The
# '#*//' operation removes '*//' from the start of the string. That's the
# 'https://' chunk. With that gone, we are left with 'github.company.com' or
# something similar.
export GH_HOST="${GITHUB_SERVER_URL#*//}"
```

```sh
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
```

This `setup-git` is a command is what makes it so that we can be authorized to
do normal `git clone` and `git push` operations without using the gh CLI. It
auto-adds the credentials for the host in `$GH_HOST` and any additional `--host`
options passed to it. We need this to make it so that our `git push` at the
end of this script works!

```sh
gh auth setup-git
```

We also need to preemptively mark the $GIT_DIR as safe to use. Normally Git
will protect you against doing insecure stuff in untrusted areas, and that's
a good thing! In this case, though, we know that what we are doing in this
temp folder is OK.

## `clone.sh`-specific

```sh
# We clone the $GITHUB_REPOSITORY.wiki Git repo into a temp folder. This is
# a special Git repository that holds a flat file structure of markup files
# that are rendered on the Wiki tab in the GitHub web UI. We clone this repo
# into the aforementioned $GIT_DIR folder. We use the --bare option to make
# the underlying 'git clone' command that's run create just a .git folder
# without pulling out all the initial files (which is the default behaviour).
# So, we'll have a .git-like folder sitting in /tmp/id.1234 which we want to
# use as our .git folder that we commit to and use for the rest of the Git
# stuff. The $GIT_WORK_TREE is already set to use the $INPUT_PATH (likely a
# folder like 'wiki/').
git clone "$GITHUB_SERVER_URL/$GITHUB_REPOSITORY.wiki.git" "$GIT_DIR" --bare
# This is a trick to make the git CLI think that there should be a worktree too!
# By default, --bare Git repos are pretty inert. We unset this and then use our
# previously configured $GIT_WORK_TREE.
git config --unset core.bare
```

```sh
# This sets the default author & committer for the Git commit that we make. If
# you want to change this, you can! You can set the $GIT_AUTHOR_* and
# $GIT_COMMITTER_* env vars in your workflow and they should pass down to this
# 'git commit' operation. These values are from one of the popular Git commit
# actions: stefanzweifel/git-auto-commit-action [1]
#
# [1]: https://github.com/stefanzweifel/git-auto-commit-action/blob/master/action.yml#L35-L42
git config user.name github-actions[bot]
git config user.email 41898282+github-actions[bot]@users.noreply.github.com
```

Allowing an empty commit is way easier than detecting empty commits! This also
makes semantic sense. If you run this action, it adds a commit to your wiki.
How large that commit is comes down to your changes. 0 change = commit with 0.
This works well with the default `Update wiki ${{ github.sha }}` message so
that even if the commit is empty, the message has the SHA there.

```sh
# This is the pushing operation! The origin remote looks something like:
# "https://github.com/octocat/awesome.wiki.git" with no token attached. That
# 'gh auth setup-git' is what makes the username & password automagically attach
# to that 'github.com' hostname! We aren't using -u or -f here since there
# shouldn't be a need.
git push origin master
```
