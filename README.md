# Andrew-Chen-Wang/github-wiki-action
Updates your GitHub wiki by using rsync.

This action updates your repository's wiki
based on a single directory that matches with
your Wiki's git. You can use a Wiki directory
from any repository you wish.

_**It is recommended that you still have a Home.md
or whatever extension you want instead of MD.**_ This
is so that GitHub doesn't automatically make a Home.md
for you again.

Table of Contents:
- [Features](#features)
- [Usage](#usage)
- [Inputs](#inputs)
- [Inspiration](#inspiration)
- [License](#license)
- [Non-Affiliation with Github Inc.](#non-affiliation-with-github-inc)

---
### Features

- rsync all your files from one directory (either from the current or other repository) to your GitHub's repo's wiki.
    - rsyncing from a different repository requires a [GitHub PAT](https://github.com/settings/tokens/new?scopes=repo&description=wiki%20page%20creator%20token)
    - If you use a private repository, you may have to use a GitHub PAT.
- Use the commit message from your repository's git's commit. You can specify a custom one if you want.
- Be able to exclude files and directories based on an input of a list.

---
### Usage

You must have a single wiki page available from the beginning.
It can be blank, but there must be at least one page that exists.
You must also have a directory where all your wiki files will
be located (the default directory is "wiki/"). To include the
mandatory homepage, have a file in your wiki/ directory
called Home.md or with any other extension (e.g. rst).

```yaml
name: Deploy Wiki

on:
  push:
    paths:
      # Trigger only when wiki directory changes
      - 'wiki/**'
    branches:
      # And only on master branch
      - master

jobs:
  deploy-wiki:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2

    - name: Push Wiki Changes
      uses: Andrew-Chen-Wang/github-wiki-action@v2
      env:
        # Make sure you have that / at the end. We use rsync 
        # WIKI_DIR's default is wiki/
        WIKI_DIR: wiki/
        GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        GH_MAIL: ${{ secrets.YOUR_EMAIL }}
        GH_NAME: ${{ github.repository_owner }}
        EXCLUDED_FILES: "a/ b.md"
```

If you plan on having a different repository host your wiki
directory, you're going to need a Personal Access Token instead of the `GITHUB_TOKEN`
with the minimal scopes [seen here.](https://github.com/settings/tokens/new?scopes=repo&description=wiki%20page%20creator%20token). If you are using a private
repository, the same rule applies.

---
### Inputs

| Argument | Required | Default value | Description |
|----------|----------|---------------|-------------|
| WIKI_DIR | No | wiki/ | Directory to rsync files to the wiki.(https://github.com/settings/tokens/new?scopes=repo). |
| GH_TOKEN | Yes | | The GitHub Token for this action to use. Specify `${{ secrets.GITHUB_TOKEN }}` for public repositories. If you're commiting to a different repository or a private repository, create a [GitHub PAT](https://github.com/settings/tokens/new?scopes=repo&description=wiki%20page%20creator%20token) and save it in GitHub secrets as `GH_TOKEN`. Then, specify in your action `${{ secrets.GH_TOKEN }}`. |
| GH_MAIL | Yes | | The email associated with the token. |
| GH_NAME | Yes | | The username associated with the token. |
| EXCLUDED_FILES | No | | The files or directories you want to exclude. Note, we use rsync |
| REPO | No | `${{ github.repository }}` | The target repository. Default is the current repo. If you specify a different repository (e.g. Andrew-Chen-Wang/github-wiki-action), then you must use a PAT. |
| WIKI_PUSH_MESSAGE | No | Your commit's message | The message to add to your commit to the wiki git |

---
### Inspiration
This intended usage was to avoid hosting a private ReadTheDocs
and instead just use GitHub wiki.

Largely inspired by [wiki-page-creator-action](https://github.com/Decathlon/wiki-page-creator-action)
and the [issue that arose from it](https://github.com/Decathlon/wiki-page-creator-action/issues/11),
this GitHub action tries to update the entire wiki based on a single
directory.

---
### License

```
   Copyright 2020 Andrew Chen Wang

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
```

---
### Non-Affiliation with GitHub Inc.

This repository/action and its creator is not affiliated with
GitHub Inc.
