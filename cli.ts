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
import { basename, dirname, join, relative, resolve, sep } from "node:path";

core.startGroup("process.env");
// The runner masks registered secrets in logs, but don't rely on it —
// redact anything credential-shaped (covers PATs passed as plain env).
console.table(
  Object.fromEntries(
    Object.entries(process.env).map(([key, value]) => [
      key,
      /token|secret|password|credential/i.test(key) ? "***" : value,
    ]),
  ),
);
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
const direction = core.getInput("direction") || "push";
if (direction !== "push" && direction !== "pull") {
  throw new DOMException("Unknown direction", "NotSupportedError");
}
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

// File extensions GitHub renders as wiki pages, in restore-priority order.
// https://github.com/github/markup
// deno-fmt-ignore
const pageExts = [
  "md", "markdown", "mdown", "mkdn", "mkd", "mdwn", "mkdown",
  "asciidoc", "adoc", "asc", "rst", "mediawiki", "wiki",
  "textile", "rdoc", "org", "creole", "pod",
];
const pageExtRe = new RegExp(`\\.(?:${pageExts.join("|")})$`);
// Only Markdown can be parsed by the remark-based link rewriter; the other
// page formats are synced verbatim but still count as link targets above.
const markdownExtRe = /\.(?:md|markdown|mdown|mkdn|mkd|mdwn|mkdown)$/;

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

// Every file under dir except the .git folder, sorted shallowest-first.
async function allFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === ".git") continue;
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await allFiles(path)));
    else out.push(path);
  }
  return out.sort((a, b) =>
    a.split(sep).length - b.split(sep).length || (a < b ? -1 : 1)
  );
}

// Rewrites link, image, and reference-definition URLs in every Markdown file
// under dir. rewrite() gets the URL, the directory of the file it appears
// in, and whether it renders as an image; it returns the new URL, or
// undefined to leave it untouched.
async function rewriteLinks(
  dir: string,
  rewrite: (
    url: string,
    fileDir: string,
    isImage: boolean,
  ) => string | undefined,
) {
  for (const file of await allFiles(dir)) {
    if (!markdownExtRe.test(basename(file))) continue;
    const fileDir = dirname(file);
    const plugin = () => (tree: any) => {
      // A definition backs both link and image references; classify each by
      // how it's actually referenced.
      const imageDefs = new Set<string>();
      visit(tree, "imageReference", (node: any) => {
        imageDefs.add(node.identifier);
      });
      visit(tree, ["link", "image", "definition"], (node: any) => {
        if (typeof node.url !== "string" || !isPathOnly(node.url)) return;
        const isImage = node.type === "image" ||
          (node.type === "definition" && imageDefs.has(node.identifier));
        const rewritten = rewrite(node.url, fileDir, isImage);
        if (rewritten == null || rewritten === node.url) return;
        console.log(`Rewrote ${node.url} to ${rewritten}`);
        node.url = rewritten;
      });
    };
    const md = await readFile(file, "utf-8");
    await writeFile(file, (await remark().use(plugin).process(md)).toString());
  }
}

if (direction === "pull") {
  // Sync the wiki back into the source tree: the exact inverse of the push
  // preprocess (issue #67). Clones the wiki, restores source-friendly
  // Markdown (Home.md -> README.md, bare page links -> .md links), and
  // mirrors it into the path folder. Nothing is committed or pushed; pair
  // this with a PR-creating action.
  await $`git config --global --add safe.directory ${d}`;
  await $`git clone ${wikiGitURL} .`;

  if (core.getBooleanInput("preprocess")) {
    // Only restore Home.md -> README.md when that doesn't clobber a real
    // README.md page (wikis synced without preprocess can have both).
    const renameHome = existsSync(resolve(d, "Home.md")) &&
      !existsSync(resolve(d, "README.md"));
    // The wiki serves pages flat by basename, so a link's textual path may
    // not point at the page's real location. Index page name -> file
    // (shallowest file wins a name collision).
    const pageIndex = new Map<string, string>();
    for (const file of await allFiles(d)) {
      const name = basename(file);
      if (!pageExtRe.test(name)) continue;
      const page = name.replace(pageExtRe, "");
      if (!pageIndex.has(page)) pageIndex.set(page, file);
    }
    const relativeTo = (fileDir: string, file: string) =>
      relative(fileDir, file).split(sep).join("/");

    await rewriteLinks(d, (url, fileDir, isImage) => {
      if (isImage) return;
      const [path, suffix] = splitPath(url);
      if (!path || path.startsWith("/") || pageExtRe.test(path)) return;
      const decoded = decodePath(path);
      if (decoded === undefined) return;
      const target = resolve(fileDir, decoded);
      if (!contains(d, target)) return;
      if (renameHome && basename(decoded) === "Home") {
        // Home.md is about to become README.md.
        if (target === resolve(d, "Home")) {
          return path.replace(/Home$/, "README") + ".md" + suffix;
        }
        return relativeTo(fileDir, resolve(d, "README.md")) + suffix;
      }
      // The textual path already points at the page's directory...
      for (const ext of pageExts) {
        if (existsSync(`${target}.${ext}`)) return `${path}.${ext}${suffix}`;
      }
      // ...otherwise it's a flat wiki-namespace link: point at the page's
      // actual file.
      const file = pageIndex.get(basename(decoded));
      if (file !== undefined) return relativeTo(fileDir, file) + suffix;
      return;
    });

    if (renameHome) {
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
  // Only promote README.md when the source has no Home.md of its own —
  // renaming over a real Home.md would silently drop a page.
  if (
    existsSync(resolve(d, "README.md")) && !existsSync(resolve(d, "Home.md"))
  ) {
    await rename(resolve(d, "README.md"), resolve(d, "Home.md"));
    console.log("Moved README.md to Home.md");
  }

  const sourceDir = resolve(workspacePath, core.getInput("path"));
  const readmeIsHome = existsSync(resolve(sourceDir, "README.md")) &&
    !existsSync(resolve(sourceDir, "Home.md"));
  // Links to source files point at the repo the workflow checked out, which
  // is not necessarily the wiki's repo (cross-repo publishing). Images need
  // the raw file (a blob page doesn't render inside <img>); the /raw/ route
  // works on github.com and GitHub Enterprise alike.
  const sourceRepoBase = `${process.env.GITHUB_SERVER_URL || serverURL}/${
    process.env.GITHUB_REPOSITORY || repo
  }`;
  const sourceRef = process.env.GITHUB_SHA || "HEAD";

  await rewriteLinks(d, (url, fileDir, isImage) => {
    const [path, suffix] = splitPath(url);
    if (!path) return;
    const decoded = decodePath(path);
    if (decoded === undefined) return;
    // fileDir is inside the wiki copy; resolve links against the matching
    // directory of the source tree, the way GitHub's repo Markdown view
    // resolves them (/-prefixed paths resolve against the repo root).
    const sourceFileDir = resolve(sourceDir, relative(d, fileDir));
    const target = path.startsWith("/")
      ? join(workspacePath, decoded)
      : resolve(sourceFileDir, decoded);
    if (contains(sourceDir, target)) {
      // Images and other assets ship with the wiki; only page links need to
      // become bare page links (issue #8).
      if (isImage || !pageExtRe.test(decoded)) return;
      if (readmeIsHome && target === resolve(sourceDir, "README.md")) {
        return "Home" + suffix;
      }
      // The wiki serves pages flat by basename. A same-directory link keeps
      // its textual form; anything else must link by page name.
      if (dirname(target) === sourceFileDir) {
        return path.replace(pageExtRe, "") + suffix;
      }
      return basename(target).replace(pageExtRe, "") + suffix;
    }
    // Links to other files in the repository become blob view URLs (or raw
    // URLs for images), the same transformation GitHub applies when
    // rendering in-repo Markdown (#78).
    if (contains(workspacePath, target) && existsSync(target)) {
      const parts = relative(workspacePath, target).split(sep);
      return `${sourceRepoBase}/${isImage ? "raw" : "blob"}/${sourceRef}/${
        parts.map(encodeURIComponent).join("/")
      }${suffix}`;
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
