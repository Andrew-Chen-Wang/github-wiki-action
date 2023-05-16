<!--
Copyright 2023 Andrew Chen Wang
Copyright 2023 Jacob Hummer
SPDX-License-Identifier: Apache-2.0
-->

# Publish to GitHub wiki

📖 GitHub Action to sync a folder to the GitHub wiki

📂 Keep your dev docs in sync with your code \
🔁 Able to open PRs with docs updates \
🗂️ Use the fancy GitHub wiki reader view \
💡 Inspired by [Decathlon/wiki-page-creator-action#11]

## Installation

![GitHub Actions](https://img.shields.io/static/v1?style=for-the-badge&message=GitHub+Actions&color=2088FF&logo=GitHub+Actions&logoColor=FFFFFF&label=)
![GitHub](https://img.shields.io/static/v1?style=for-the-badge&message=GitHub&color=181717&logo=GitHub&logoColor=FFFFFF&label=)

Add a GitHub Actions workflow file to your `.github/workflows/` folder similar
to the example shown below.

```yml
name: Publish wiki
on:
  push:
    branches: [main]
    paths:
      - wiki/**
      - .github/workflows/publish-wiki.yml
concurrency:
  group: publish-wiki
  cancel-in-progress: true
permissions:
  contents: write
jobs:
  publish-wiki:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: Andrew-Chen-Wang/github-wiki-action@v4
```

<img align="right" alt="Screenshot of 'Create the first page' button" src="https://i.imgur.com/ABKIS4h.png" />

⚠️ You must create a dummy page manually! This is what initially creates the
GitHub wiki Git-based storage backend that we then push to in this Action.

After creating your workflow file, now all you need is to put your Markdown
files in a `wiki/` folder (or whatever you set the `WIKI_DIR` option to) and
commit them to your default branch to trigger the workflow (or whatever other
trigger you set up).

💡 Each page has an auto-generated title. It is derived from the filename by
replacing every `-` (dash) character with a space. Name your files accordingly.
The `Home.md` file will automatically become the homepage, not `README.md`. This
is specific to GitHub wikis.

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

- **`strategy`:** Select from `clone` or `init` to determine which method to use
  to push changes to the GitHub wiki. `clone` will clone the `.wiki.git` repo
  and add an additional commit. `init` will create a new repo with a single
  commit and force push to the `.wiki.git`. `init` involves a force-push! The
  default is `clone`.

- **`repository`:** The repository housing the wiki. Use this if you're
  publishing to a wiki that's not the current repository. You can change the
  GitHub server with the `github-server-url` input. Default is
  `${{ github.repository }}`.

- **`token`:** `${{ github.token }}` is the default. This token is used when
  cloning and pushing wiki changes.

- **`path`:** The directory to use for your wiki contents. Default `wiki/`.

- **`commit-message`:** The message to use when committing new content. Default
  is `Update wiki ${{ github.sha }}`. You probably don't need to change this,
  since this only applies if you look really closely in your wiki.

- **`ignore`:** A multiline list of files that should be ignored when committing
  and pushing to the remote wiki. Each line is a pattern like `.gitignore`. Make
  sure these paths are relative to the path option! The default is none.

#### `strategy:` option

There are some specific usecases where using `strategy: init` might be better
than the default `strategy: clone`.

1. **Your wiki is enormous.** And I don't mean in terms of text. Text is nothing
   compared with images. If your wiki has a lot of included images, then you
   probably don't want to store the complete history of those large binary
   files. Instead, you can use `strategy: init` to create a single commit each
   time.

2. **You prefer the "deploy" semantics.** If you just like the feel of having
   your GitHub wiki act more like GitHub Pages, that's great! You can `--force`
   push using `strategy: init` on each wiki deployment and none of that pesky
   history will be saved.

<!-- prettier-ignore-start -->
[github.com/settings/personal-access-tokens]: https://github.com/settings/personal-access-tokens
[Decathlon/wiki-page-creator-action#11]: https://github.com/Decathlon/wiki-page-creator-action/issues/11
<!-- prettier-ignore-end -->
