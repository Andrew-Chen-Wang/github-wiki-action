<!--
Copyright 2023 Jacob Hummer
SPDX-License-Identifier: Apache-2.0
-->

When you interact with GitHub stuff, you need to be authenticated. In a GitHub
Action, this means using the `${{ github.token }}`.

The `${{ github.token }}` is a special access token that you can use to
authenticate on behalf of GitHub Actions. GitHub automatically creates
a `${{ github.token }}` secret for you to use in your workflow, and you can use
it to authenticate in a workflow run.

The way this works is that when you enable GitHub Actions in a repository,
GitHub installs a GitHub App on your repository.
The `${{ github.token }}` secret is a GitHub App installation access token. You
can use the installation access token to authenticate on behalf of the GitHub
App installed on your repository. The token's permissions are limited to the
repository that contains your workflow.

Before each job begins, GitHub fetches an installation access token for the
job. The `${{ github.token }}` expires when a job finishes or after a maximum of
24 hours.

The token is also available as the `$GITHUB_TOKEN` env variable in most places
without needing to be explicitly passed around.

## Best practices

You can use the `${{ github.token }}` by using the standard syntax for
referencing secrets: `${{ secrets.GITHUB_TOKEN }}`. You can pass the token as an
input to an action, or use it to make an authenticated GitHub API request. If
you are using a custom PAT, you should also avoid hardcoding the token value in
your workflow file or scripts. Instead, use `${{ secrets.MY_PAT }}`.

Modern GitHub Actions will also default to using the current workflow's
`${{ github.token }}` value if non is provided by the user. This implicit token
passing makes workflows drasticly simpler. As a good security practice, you
should always make sure that actions only have the minimum access they require
by limiting the permissions granted to the `${{ github.token }}`.

## How it's generated

The `${{ github.token }}` is not a personal access token. It is a GitHub App
installation access token that is automatically created by GitHub when you
enable GitHub Actions in a repository.

You do not need to create or manage the token yourself. You also do not need to
renew or rotate the token, as GitHub does that for you before each job.

## Permissions

| Scope               | Permissive | Restricted | Max fork perms |
| ------------------- | ---------- | ---------- | -------------- |
| actions             | read/write |            | read           |
| checks              | read/write |            | read           |
| contents            | read/write | read       | read           |
| deployments         | read/write |            | read           |
| id-token            |            |            | read           |
| issues              | read/write |            | read           |
| metadata            | read       | read       | read           |
| packages            | read/write | read       | read           |
| pages               | read/write |            | read           |
| pull-requests       | read/write |            | read           |
| repository-projects | read/write |            | read           |
| security-events     | read/write |            | read           |
| statuses            | read/write |            | read           |

You can change any of these permissions using the `permissions:` option in your
workflow `.yml` files.

```yaml
permissions:
  issues: write
  contents: read
```

## Authentication

You can use the `${{ github.token }}` to authenticate on the command line when
cloning a repository. You can enter the token instead of your password when
performing Git operations over HTTPS.

For example, on the command line you would enter the following:

```sh
git clone https://github.com/username/repo.git
```

```
Username: your_username
Password: your_token
```

You can also use the token as part of the URL, like this:

```sh
git clone https://your_username:your_token@github.com/username/repo.git
```

However, this is less secure and not recommended, as the token may be exposed in
plain text or in your shell history.

If you are not prompted for your username and password, your credentials may be
cached on your computer. You can update your credentials in the Keychain or
Credential Manager to replace your old password with the token.

Alternatively, you can use a credential helper to cache your token with a Git
client.

```sh
gh auth setup-git
```

You can use the runner builtin `gh` CLI to configure `git` to use GitHub CLI as
a credential helper for all authenticated hosts. Alternatively, you can use
the `--hostname` flag to specify a single host to be configured.

📚 Further reading: [Git - gitcredentials Documentation]

[Git - gitcredentials Documentation]: https://git-scm.com/docs/gitcredentials
