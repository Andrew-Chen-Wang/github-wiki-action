# Publish to GitHub wiki

📖 GitHub Action to sync a folder to the GitHub wiki

<div align="center">

![](https://user-images.githubusercontent.com/61068799/210448771-8926fa1d-eabb-4d92-8fa0-56468c05f3b2.png)

<!-- FUTURE: Add more links here like "🆕 v4" or "Real-world workflow" -->

[Awesome GitHub wikis](https://github.com/MyHoneyBadger/awesome-github-wiki)

</div>

<!-- FUTURE: Add "📕 Utilizes `git subtree` to preserve commit history" -->

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

<!-- FUTURE: Change this to be as simple as possible (all defaults) -->

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
    environment:
      name: github-wiki
      url: https://github.com/${{ github.repository }}/wiki
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: Andrew-Chen-Wang/github-wiki-action@v3
        # ⚠️ We use the env: key to provide our inputs! See #27.
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

<!--
FUTURE: Add this paragraph:

⚠️ Make sure that any changes made to the Markdown files in the GitHub Action
_are also committed_! This GitHub Action uses `git subtree` which takes the
state of the latest Git commit, not the current state of the working directory.
You can use [EndBug/add-and-commit] or `git add -A` and
`git commit --amend --no-edit` to commit changes inside your workflow.

-->

<!--
FUTURE: Add a second example

```yml
name: Publish to GitHub wiki
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
    environment:
      name: github-wiki
      url: ${{ steps.github-wiki-action.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: date > my-wiki/Todays-date.md
      - uses: EndBug/add-and-commit@v9
      - uses: Andrew-Chen-Wang/github-wiki-action@v4
        id: github-wiki-action
        with:
          path: my-wiki
```
-->

<!-- FUTURE: Change this to `path` instead of `WIKI_DIR` -->

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

<!--
FUTURE: Add outputs?

### Outputs

TODO: Add outputs table. Remove this if there are no outputs.
-->

<!--
FUTURE: Add "Development" section

## Development

![Codespaces](https://img.shields.io/static/v1?style=for-the-badge&message=Codespaces&color=181717&logo=GitHub&logoColor=FFFFFF&label=)
![Devcontainers](https://img.shields.io/static/v1?style=for-the-badge&message=Devcontainers&color=2496ED&logo=Docker&logoColor=FFFFFF&label=)

This project consists of a single file. If you're making a small change, you
probably don't need a full dev environment and can just edit the file in the
GitHub web editor or [GitHub.dev].

But, if you really want some of that Bash intellisense, this project comes with
a devcontainer config equipped with a Bash extension pack and some other GitHub
Actions helpers like [`act`] and a few intellisense extensions for
`actions.yml`.

🧪 This project is tested is directly on this repository. Check out the
`test.yml` workflow and the <kbd>Wiki</kbd> tab to see it in action!

🧙‍♂️ Make sure you format your code! We use [Prettier] to format Markdown and
[shfmt] to format Bash code. 🌋 To avoid catastorophic failure, we also use
[shellcheck] to lint our Bash code for common errors.

-->

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
