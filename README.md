# Publish to GitHub wiki

📖 GitHub Action to sync a folder to the GitHub wiki

<div align="center">

![](https://user-images.githubusercontent.com/61068799/225482167-8228fa46-ceb2-407d-b5a9-c02495965f79.png)

[Awesome GitHub wikis](https://github.com/MyHoneyBadger/awesome-github-wiki)

</div>

📂 Keep your dev docs in sync with your code \
🔁 Able to open PRs with docs updates \
🗂️ Use the fancy GitHub wiki reader view \
💡 Inspired by [Decathlon/wiki-page-creator-action#11]

**GitHub Wiki Action** is not certified by GitHub. It is provided by a
third-party and is governed by separate terms of service, privacy policy, and
support documentation.

## Installation

![GitHub Actions](https://img.shields.io/static/v1?style=for-the-badge&message=GitHub+Actions&color=2088FF&logo=GitHub+Actions&logoColor=FFFFFF&label=)
![GitHub](https://img.shields.io/static/v1?style=for-the-badge&message=GitHub&color=181717&logo=GitHub&logoColor=FFFFFF&label=)

⚠️ You must create a dummy page manually! This is what initially creates the
GitHub wiki Git-based storage backend that we then push to in this Action.

<div align="center">

![](https://user-images.githubusercontent.com/61068799/224426115-98106d72-6323-4101-8d08-f349af3fcc03.png)

</div>

Add a GitHub Actions workflow file to your `.github/workflows/` folder similar
to the example shown below.

```yml
name: Publish wiki
on:
  push:
    branches: [main]
    paths: [wiki/**, .github/workflows/publish-wiki.yml]
concurrency:
  group: wiki
  cancel-in-progress: true
permissions:
  contents: write
jobs:
  wiki:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: Andrew-Chen-Wang/github-wiki-action@v3
        # ⚠️ We use the env: key to provide our inputs! See #27.
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

After creating your workflow file, now all you need is to put your Markdown
files in a `wiki/` folder (or whatever you set the `WIKI_DIR` option to) and
commit them to your default branch to trigger the workflow (or whatever other
trigger you set up).

💡 Each page has an auto-generated title. It is derived from the filename by
replacing every `-` (dash) character with a space. Name your files accordingly.

💡 The `Home.md` file will automatically become the homepage, not `README.md`.
This is specific to GitHub wikis. You can use a preprocessor like [TBD] to
automagically ✨ change `README.md` into `Home.md` and rewrite links from
`./My-sibling-page.md` to `./My-sibling-page` to work when deployed to the
GitHub wiki.

### GitHub token

This actions needs a GitHub token that can write to the GitHub wiki of the
selected repository. By default, the `${{ github.token }}` you are given only
offers **read** permissions to the current GitHub repository. You will need to
either:

1. Provide a custom GitHub PAT that has `contents: write` permissions. This can
   be generated from [github.com/settings/personal-access-tokens].
2. Upgrade the `${{ github.token }}` using the GitHub Actions' `permissions:`
   directive. This can be done by adding `permissions: { contents: write }` to
   the top level fields **or** to the job's fields. You can see examples of both
   of these above.

⚠️ If you're pushing to another repository (**not** the one that houses the
workflow `.yml` file) you'll always need to use a GitHub PAT.

### Options

#### `GH_TOKEN`

**Required**

The GitHub API token to use. This is usually `${{ secrets.GITHUB_TOKEN }}` or
`${{ github.token }}` (they are the same).

#### `GH_MAIL`

**Required**

You must specify an email address to be associated with the commit that we make
to the wiki.

#### `GH_NAME`

**Required**

In addition to an email, you must also specify a username to tie to the commit
that we make.

#### `WIKI_DIR`

**Default:** `wiki/`

This is the directory to process and publish to the wiki. Usually it's something
like `wiki/` or `docs/`.

#### `EXCLUDED_FILES`

The files or directories you want to exclude. This _can_ be a glob pattern. By
default, we include everything.

#### `REPO`

**Default:** `${{ github.repository }}`

The repository to push to. This is useful if you want to push to a different
repository than the one that houses the workflow file. This should be in the
format `owner/repo`.

#### `WIKI_PUSH_MESSAGE`

**Default:** _latest commit message_

The commit message to use when pushing to the wiki. This is useful if you want
to customize the commit message.

<!-- prettier-ignore-start -->
[github.dev]: https://github.com/github/dev
[`act`]: https://github.com/nektos/act#readme
[EndBug/add-and-commit]: https://github.com/EndBug/add-and-commit#readme
[github.com/settings/personal-access-tokens]: https://github.com/settings/personal-access-tokens
[Decathlon/wiki-page-creator-action#11]: https://github.com/Decathlon/wiki-page-creator-action/issues/11
[shfmt]: https://github.com/mvdan/sh#shfmt
[shellcheck]: https://www.shellcheck.net/
[prettier]: https://prettier.io/
<!-- prettier-ignore-end -->
