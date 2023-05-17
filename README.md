<!--
Copyright 2023 Andrew Chen Wang
Copyright 2023 Jacob Hummer
SPDX-License-Identifier: Apache-2.0
-->

# Publish to GitHub wiki

📖 GitHub Action to sync a folder to the GitHub wiki

<div align="center">

![](https://user-images.githubusercontent.com/61068799/231881220-2915f956-dbdb-4eee-8807-4eba9537523f.png)

</div>

📂 Keep your dev docs in sync with your code \
💡 Inspired by [Decathlon/wiki-page-creator-action#11] \
🔁 Able to open PRs with docs updates \
✨ Use the fancy GitHub wiki reader UI for docs \
🌐 Works across repositories (with a [PAT]) \
💻 Supports `runs-on: windows-*`

## Usage

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

☝ This workflow will mirror the `wiki/` folder in your GitHub repository to the
`user/repo.wiki.git` Git repo that houses the wiki documentation! You can use
any of the [supported markup languages] like MediaWiki, Markdown, or AsciiDoc.

<img align="right" alt="Screenshot of 'Create the first page' button" src="https://i.imgur.com/ABKIS4h.png" />

⚠️ You must create a dummy page manually! This is what initially creates the
GitHub wiki Git-based storage backend that we then push to in this Action.

After creating your workflow file, now all you need is to put your Markdown
files in a `wiki/` folder (or whatever you set the `wiki` option to) and commit
them to your default branch to trigger the workflow (or whatever other trigger
you set up).

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

- **`repository`:** The repository housing the wiki. Use this if you're
  publishing to a wiki that's not the current repository. You can change the
  GitHub server with the `github-server-url` input. Default is
  `${{ github.repository }}`.

- **`github-server-url`:** An alternate `https://github.com` URL, usually for
  GitHub Enterprise deployments under your own domain. Default is
  `${{ github.server_url }}` (usually `https://github.com`).

- **`token`:** `${{ github.token }}` is the default. This token is used when
  cloning and pushing wiki changes.

- **`path`:** The directory to use for your wiki contents. Default `wiki/`.

- **`commit-message`:** The message to use when committing new content. Default
  is `Update wiki ${{ github.sha }}`. You probably don't need to change this,
  since this only applies if you look really closely in your wiki.

- **`ignore`:** A multiline list of files that should be ignored when committing
  and pushing to the remote wiki. Each line is a pattern like `.gitignore`. Make
  sure these paths are relative to the path option! The default is none.

- **`dry-run`:** Whether or not to actually attempt to push changes back to the
  wiki itself. If this is set to `true`, we instead print the remote URL and do
  not push to the remote wiki. The default is `false`. This is useful for
  testing.

### Preprocessing

You may wish to strip the `[link](page.md)` `.md` suffix from your links to make
them viewable in GitHub source view (with the `.md`) _as well as_ in GitHub wiki
(without the `.md`; pretty URLs!). You can use a preprocessing action like
[Strip MarkDown extensions from links action] to remove those `.md` suffixes
before using this action. Here's an example:

```yml
publish-wiki:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v3
    - uses: impresscms-dev/strip-markdown-extensions-from-links-action@v1.0.0
      with:
        path: wiki
    - uses: Andrew-Chen-Wang/github-wiki-action@v4
```

❤️ If you have an awesome preprocessor action that you want to add here, let us
know! We'd love to add an example.

<!-- prettier-ignore-start -->
[github.com/settings/personal-access-tokens]: https://github.com/settings/personal-access-tokens
[Decathlon/wiki-page-creator-action#11]: https://github.com/Decathlon/wiki-page-creator-action/issues/11
[supported markup languages]: https://github.com/github/markup#markups
[Strip MarkDown extensions from links action]: https://github.com/marketplace/actions/strip-markdown-extensions-from-links-action
[PAT]: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token
<!-- prettier-ignore-end -->
