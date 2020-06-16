# github-wiki-action
Updates your GitHub wiki by finding diffs.

Repo is WIP!

Largely inspired by https://github.com/Decathlon/wiki-page-creator-action
and the [issue that arose from it](https://github.com/Decathlon/wiki-page-creator-action/issues/11),
this GitHub action tries to update the entire wiki based on all your
files' diffs, additions, and removals.

---
### Usage

You must have a single wiki page available from the beginning.
It can be blank, but there must be at least one page that exists.

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
    steps:
    - uses: actions/checkout@v2

    - name: Push Wiki Changes
      uses: Andrew-Chen-Wang/github-wiki-action
      env:
        MD_FOLDER: wiki
        GH_PAT: ${{ secrets.GH_PAT }}
        ACTION_MAIL: youremail@mail.com
        ACTION_NAME: ${{ github.repository_owner }}
        REPO: ${{ github.repository }}
```

You're going to need a Personal Access Token with the minimal scopes of
[seen here.](https://github.com/settings/tokens/new?scopes=repo&description=wiki%20page%20creator%20token)

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