<!--
Copyright 2023 Andrew Chen Wang
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
name: Wiki
on:
  push:
    branches: [main]
    paths: [wiki/**, .github/workflows/wiki.yml]
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
          # Make sure this has a slash at the end! We use wiki/ by default.
          WIKI_DIR: my-octocat-wiki/
          # You MUST manually pass in the GitHub token.
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          # These are currently REQUIRED options
          GH_MAIL: actions@users.noreply.github.com
          GH_NAME: actions[bot]
```

☝ This workflow will mirror the `wiki/` folder in your GitHub repository to the
`user/repo.wiki.git` Git repo that houses the wiki documentation! You can use
any of the [supported markup languages] like MediaWiki, Markdown, or AsciiDoc.

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

⚠️ This action uses `env:` to supply these options, not `with:`!

- **`GH_TOKEN`:** The GitHub API token to use. This is usually
  `${{ secrets.GITHUB_TOKEN }}` or `${{ github.token }}` (they are the same).
  This is **required**.

- **`GH_MAIL`:** You must specify an email address to be associated with the
  commit that we make to the wiki. This is **required**.

- **`GH_NAME`:** In addition to an email, you must also specify a username to
  tie to the commit that we make. This is **required**.

- **`WIKI_DIR`:** This is the directory to process and publish to the wiki.
  Usually it's something like `wiki/` or `docs/`. The default is `wiki/`.

- **`EXCLUDED_FILES`:** The files or directories you want to exclude. This _can_
  be a glob pattern. By default, we include everything.

- **`REPO`:** The repository to push to. This is useful if you want to push to a
  different repository than the one that houses the workflow file. This should
  be in the format `owner/repo`. The default is `${{ github.repository }}` (the
  current repo).

- **`WIKI_PUSH_MESSAGE`:** The commit message to use when pushing to the wiki.
  This is useful if you want to customize the commit message. The default is the
  latest commit message from the main Git repo.

<!-- prettier-ignore-start -->
[github.com/settings/personal-access-tokens]: https://github.com/settings/personal-access-tokens
[Decathlon/wiki-page-creator-action#11]: https://github.com/Decathlon/wiki-page-creator-action/issues/11
[supported markup languages]: https://github.com/github/markup#markups
<!-- prettier-ignore-end -->
