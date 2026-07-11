#!/usr/bin/env -S deno run -A
// Copyright 2023 Jacob Hummer
// SPDX-License-Identifier: Apache-2.0
import process from "node:process";
import {
  readFile,
  writeFile,
  appendFile,
  readdir,
  rename,
  rm,
} from "node:fs/promises";
import { existsSync } from "node:fs";
import { copy } from "npm:fs-extra@^11.1.1";
import * as core from "npm:@actions/core@^1.10.0";
import { temporaryDirectory } from "npm:tempy@^3.1.0";
import { $, cd } from "npm:zx@^7.2.2";
import { remark } from "npm:remark@^14.0.3";
import { visit } from "npm:unist-util-visit@^5.0.0";
import { basename, join, relative, resolve, sep } from "node:path";

core.startGroup("process.env");
console.table(process.env);
core.endGroup();

const isProcessError = (
  err: unknown,
): err is { exitCode: number; stdout: string } => {
  return (
    typeof err === "object" &&
    err !== null &&
    "exitCode" in err &&
    typeof err.exitCode === "number" &&
    "stdout" in err &&
    typeof err.stdout === "string"
  );
};

const serverURL = core.getInput("github_server_url");
const repo = core.getInput("repository");
const wikiGitURL = `${serverURL}/${repo}.wiki.git`;
const workspacePath = process.cwd();
const d = temporaryDirectory();
// zx's cd() instead of process.chdir(): zx >=7.2 keeps process.cwd() pinned
// to its own snapshot via an AsyncHook, silently reverting a bare
// process.chdir() after every `await $` (see issue #90). cd() updates that
// snapshot. All fs calls below still use paths anchored at `d` so nothing
// depends on the process cwd.
cd(d);
$.cwd = d;

process.env.GH_TOKEN = core.getInput("token");
process.env.GH_HOST = new URL(core.getInput("github_server_url")).host;
await $`gh auth setup-git`;

// File extensions GitHub renders as Markdown pages.
// https://github.com/github/markup
const pageExtRe = /\.(?:md|markdown|mdown|mkdn|mkd|mdwn|mkdown|ron)$/;

// URLs that are plain paths: no scheme (https:, mailto:, ...) and no //host.
const isPathOnly = (url: string) =>
  !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url) && !url.startsWith("//");

// Splits "docs/a.md#frag" into ["docs/a.md", "#frag"].
const splitPath = (url: string): [string, string] => {
  const i = url.search(/[?#]/);
  return i === -1 ? [url, ""] : [url.slice(0, i), url.slice(i)];
};

const decodePath = (path: string): string | undefined => {
  try {
    return decodeURIComponent(path);
  } catch {
    return undefined;
  }
};

const contains = (parent: string, child: string) =>
  child === parent || child.startsWith(parent + sep);

// Rewrites link URLs in every top-level Markdown file in dir. rewrite()
// returns the new URL, or undefined to leave the link untouched.
async function rewriteLinks(
  dir: string,
  rewrite: (url: string) => string | undefined,
) {
  const plugin = () => (tree: any) =>
    visit(tree, ["link", "linkReference"], (node: any) => {
      if (typeof node.url !== "string" || !isPathOnly(node.url)) return;
      const rewritten = rewrite(node.url);
      if (rewritten == null || rewritten === node.url) return;
      console.log(`Rewrote ${node.url} to ${rewritten}`);
      node.url = rewritten;
    });
  for (const file of await readdir(dir)) {
    if (!pageExtRe.test(file)) continue;
    const path = resolve(dir, file);
    const md = await readFile(path, "utf-8");
    await writeFile(path, (await remark().use(plugin).process(md)).toString());
  }
}

if (core.getInput("direction") === "pull") {
  // Sync the wiki back into the source tree: the exact inverse of the push
  // preprocess (issue #67). Clones the wiki, restores source-friendly
  // Markdown (Home.md -> README.md, bare page links -> .md links), and
  // mirrors it into the path folder. Nothing is committed or pushed; pair
  // this with a PR-creating action.
  await $`git config --global --add safe.directory ${d}`;
  await $`git clone ${wikiGitURL} .`;

  if (core.getBooleanInput("preprocess")) {
    const hasHome = existsSync(resolve(d, "Home.md"));
    await rewriteLinks(d, (url) => {
      const [path, suffix] = splitPath(url);
      if (!path || path.startsWith("/") || pageExtRe.test(path)) return;
      const decoded = decodePath(path);
      if (decoded === undefined) return;
      const target = resolve(d, decoded);
      if (!contains(d, target)) return;
      if (hasHome && target === resolve(d, "Home")) {
        return path.replace(/Home$/, "README") + ".md" + suffix;
      }
      if (existsSync(target + ".md")) return path + ".md" + suffix;
      return;
    });

    if (hasHome) {
      await rename(resolve(d, "Home.md"), resolve(d, "README.md"));
      console.log("Moved Home.md to README.md");
    }
  }

  const dest = resolve(workspacePath, core.getInput("path"));
  if (core.getBooleanInput("dry_run")) {
    console.log(`Would sync these wiki files to ${dest}:`);
    await $`git ls-files`;
  } else {
    // Mirror semantics: files deleted from the wiki disappear from the
    // destination too. Keep .git so path: '.' stays a valid checkout.
    if (existsSync(dest)) {
      await Promise.all(
        (await readdir(dest))
          .filter((entry) => entry !== ".git")
          .map((entry) => rm(resolve(dest, entry), { recursive: true, force: true })),
      );
    }
    await copy(d, dest, {
      filter: (src) => {
        return basename(src) !== ".git";
      },
    });
  }

  core.setOutput("wiki_url", `${serverURL}/${repo}/wiki`);
  process.exit(0);
}

if (core.getInput("strategy") === "clone") {
  await $`git config --global --add safe.directory ${d}`;
  await $`git clone ${wikiGitURL} .`;
} else if (core.getInput("strategy") === "init") {
  await $`git init -b master`;
  await $`git remote add origin ${wikiGitURL}`;
  await $`git fetch`;
} else {
  throw new DOMException("Unknown strategy", "NotSupportedError");
}

// https://github.com/stefanzweifel/git-auto-commit-action/blob/master/action.yml#L35-L42
await $`git config user.name github-actions[bot]`;
await $`git config user.email 41898282+github-actions[bot]@users.noreply.github.com`;
await $`git config --global user.name github-actions[bot]`;
await $`git config --global user.email 41898282+github-actions[bot]@users.noreply.github.com`;

await appendFile(resolve(d, ".git/info/exclude"), core.getInput("ignore"));

// Remove all files/dirs (except .git) from the wiki clone so that files
// deleted from the source wiki directory are also removed in the wiki repo.
await Promise.all(
  (await readdir(d))
    .filter((entry) => entry !== ".git")
    .map((entry) => rm(resolve(d, entry), { recursive: true, force: true }))
);

await copy(
  resolve(workspacePath, core.getInput("path")),
  d,
  {
    filter: (src) => {
      return basename(src) !== ".git";
    }
  },
);

if (core.getBooleanInput("preprocess")) {
  // https://github.com/nodejs/node/issues/39960
  if (existsSync(resolve(d, "README.md"))) {
    await rename(resolve(d, "README.md"), resolve(d, "Home.md"));
    console.log("Moved README.md to Home.md");
  }

  const sourceDir = resolve(workspacePath, core.getInput("path"));
  // Links to source files point at the repo the workflow checked out, which
  // is not necessarily the wiki's repo (cross-repo publishing).
  const blobBase = `${process.env.GITHUB_SERVER_URL || serverURL}/${
    process.env.GITHUB_REPOSITORY || repo
  }/blob/${process.env.GITHUB_SHA || "HEAD"}`;

  await rewriteLinks(d, (url) => {
    const [path, suffix] = splitPath(url);
    if (!path) return;
    const decoded = decodePath(path);
    if (decoded === undefined) return;
    // GitHub's repo Markdown view resolves plain relative paths against the
    // file's directory and /-prefixed paths against the repo root.
    const target = path.startsWith("/")
      ? join(workspacePath, decoded)
      : resolve(sourceDir, decoded);
    if (contains(sourceDir, target)) {
      // Links between wiki pages become bare page links (issue #8).
      if (!pageExtRe.test(decoded)) return;
      if (target === resolve(sourceDir, "README.md")) return "Home" + suffix;
      return path.replace(pageExtRe, "") + suffix;
    }
    // Links to other files in the repository become blob view URLs, the same
    // transformation GitHub applies when rendering in-repo Markdown (#78).
    if (contains(workspacePath, target) && existsSync(target)) {
      const parts = relative(workspacePath, target).split(sep);
      return `${blobBase}/${parts.map(encodeURIComponent).join("/")}${suffix}`;
    }
    return;
  });
}

await $`git add -Av`;
if (core.getBooleanInput("disable_empty_commits")) {
  try {
    await $`git commit -m ${core.getInput("commit_message")}`;
  } catch (e: unknown) {
    if (
      !isProcessError(e) ||
      e.exitCode !== 1 ||
      !e.stdout.includes("nothing to commit")
    ) {
      throw e; // Unexpected error
    }

    console.log("nothing to commit, working tree clean");
  }
} else {
  await $`git commit --allow-empty -m ${core.getInput("commit_message")}`;
}

if (core.getBooleanInput("dry_run")) {
  await $`git show`;
  await $`git push -f origin master --dry-run`;
} else {
  await $`git push -f origin master`;
}

core.setOutput("wiki_url", `${serverURL}/${repo}/wiki`);
