#!/usr/bin/env -S deno run -Aq
// Copyright 2023 Jacob Hummer
// SPDX-License-Identifier: Apache-2.0
import process from "node:process";
import { readFile, writeFile, appendFile, readdir } from "node:fs/promises";
import { copy } from "npm:fs-extra@^11.1.1"
import * as core from "npm:@actions/core@^1.10.0";
import { temporaryDirectory } from "npm:tempy@^3.1.0";
import { $ } from "npm:zx@^7.2.2";
import { remark } from "npm:remark@^14.0.3";
import { visit } from "npm:unist-util-visit@^5.0.0";
import { resolve } from "node:path";

$.verbose = false;
if (core.isDebug()) {
  $.verbose = true;
}

const serverURL = core.getInput("github_server_url");
const repo = core.getInput("repository");
const wikiGitURL = `${serverURL}/${repo}.wiki.git`;
$.cwd = temporaryDirectory();

if (core.isDebug()) {
  console.table({ serverURL, repo, wikiGitURL, "$.cwd": $.cwd });
}

process.env.GH_TOKEN = core.getInput("token");
process.env.GH_HOST = new URL(core.getInput("github_server_url")).host;
await $`gh auth setup-git`;

// https://github.com/stefanzweifel/git-auto-commit-action/blob/master/action.yml#L35-L42
await $`git config user.name github-actions[bot]`;
await $`git config user.email 41898282+github-actions[bot]@users.noreply.github.com`;

if (core.getInput("strategy") === "clone") {
  await $`git config --global --add safe.directory ${$.cwd}`;
  await $`git clone ${wikiGitURL} .`;
} else if (core.getInput("strategy") === "init") {
  await $`git init -b master`;
  await $`git remote add origin ${wikiGitURL}`;
  await $`git fetch`;
} else {
  throw new DOMException("Unknown strategy", "NotSupportedError");
}

await appendFile(resolve($.cwd!, ".git/info/exclude"), core.getInput("ignore"));
await copy(core.getInput("path"), $.cwd!, { recursive: true });

function plugin() {
  function visitor(node: any) {
    if (/\.md$/.test(node.url)) {
      node.url = node.url.replace(/\.md$/, "");

      if (core.isDebug()) {
        console.log(`Rewrote to ${node.url}`);
      }
    }
  }
  return (tree: any) => visit(tree, ["link", "linkReference"], visitor);
}

if (["true", "1"].includes(core.getInput("preprocess_links"))) {
  for (const file of await readdir($.cwd!)) {
    if (!/\.(?:md|markdown|mdown|mkdn|mkd|mdwn|mkdown|ron)$/.test(file)) {
      continue;
    }

    let md = await readFile(resolve($.cwd!, file), "utf-8");
    md = (await remark().use(plugin).process(md)).toString();
    await writeFile(resolve($.cwd!, file), md);
  }
}

await $`git add -Av`;
await $`git commit --allow-empty -m ${core.getInput("message")}`;

if (["true", "1"].includes(core.getInput("dry_run"))) {
  await $`git show`;
  await $`git push -f origin master --dry-run`;
} else {
  await $`git push -f origin master`;
}

const wikiURL = `${serverURL}/${repo}/wiki`;
await appendFile(`wiki_url=${wikiURL}`, process.env.GITHUB_OUTPUT!);
