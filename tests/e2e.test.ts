// Live end-to-end tests for cli.ts against the repository's real wiki.
//
// The push test publishes wiki/ to the actual GitHub wiki, clones it back to
// verify the pushed contents, and then verifies the *published* result the
// way a wiki reader would: it fetches the rendered Home page HTML, extracts
// the links GitHub actually rendered, navigates every one of them, and
// asserts both that they load (no 404s) and that the destination shows the
// expected content (the anchor's target heading, the real file at the pinned
// commit). The pull test then syncs the live wiki back into a scratch
// workspace and verifies the inverse preprocess transforms.
//
// These tests write to the real wiki, so they only run when a token is
// available AND we're either in GitHub Actions or explicitly opted in:
//
//   E2E=1 GITHUB_TOKEN=$(gh auth token) deno test -A tests/e2e.test.ts
//
// Outside CI the current commit is used for blob links, so HEAD must be
// pushed for the navigation checks to pass.
import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "jsr:@std/assert@^1.0.0";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CLI_PATH = join(ROOT, "cli.ts");

const REPO = Deno.env.get("GITHUB_REPOSITORY") ??
  "Andrew-Chen-Wang/github-wiki-action";
const SHA = Deno.env.get("GITHUB_SHA") ?? gitSync(ROOT, "rev-parse", "HEAD");
const BLOB_BASE = `https://github.com/${REPO}/blob/${SHA}`;
const WIKI_BASE = `https://github.com/${REPO}/wiki`;

// Distinctive text expected inside each repository file the wiki links to.
const FILE_MARKERS: Record<string, string> = {
  "cli.ts": "gh auth setup-git",
  "tests/cli.test.ts": "Integration tests for cli.ts",
};
const ANCHOR = "some＿impꗝrtant＿stuff-";
const PAGE_MARKER = "we gotta give this a try";

function gitSync(cwd: string, ...args: string[]): string {
  const out = new Deno.Command("git", {
    args,
    cwd,
    stdout: "piped",
    stderr: "piped",
  }).outputSync();
  if (!out.success) {
    throw new Error(
      `git ${args.join(" ")} failed:\n${new TextDecoder().decode(out.stderr)}`,
    );
  }
  return new TextDecoder().decode(out.stdout).trim();
}

function ghToken(): string {
  const env = Deno.env.get("GITHUB_TOKEN") ?? Deno.env.get("GH_TOKEN");
  if (env) return env;
  try {
    const out = new Deno.Command("gh", {
      args: ["auth", "token"],
      stdout: "piped",
      stderr: "null",
    }).outputSync();
    if (out.success) return new TextDecoder().decode(out.stdout).trim();
  } catch {
    // gh isn't installed; fall through
  }
  return "";
}

const TOKEN = ghToken();
const ENABLED = TOKEN !== "" &&
  (Deno.env.get("GITHUB_ACTIONS") === "true" || Deno.env.get("E2E") === "1");

async function git(cwd: string, ...args: string[]): Promise<string> {
  const out = await new Deno.Command("git", {
    args,
    cwd,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!out.success) {
    throw new Error(
      `git ${args.join(" ")} failed:\n${new TextDecoder().decode(out.stderr)}`,
    );
  }
  return new TextDecoder().decode(out.stdout).trim();
}

// Runs cli.ts against the real wiki. HOME is sandboxed so the cli's global
// git config writes don't leak into the host; everything else (PATH with the
// real gh) is inherited. GITHUB_* vars are pinned so the cli and this test
// agree on the source repo and commit.
async function runCli(cwd: string, inputs: Record<string, string>) {
  const home = await Deno.makeTempDir({ prefix: "wiki-e2e-home-" });
  const out = await new Deno.Command(Deno.execPath(), {
    args: ["run", "-A", CLI_PATH],
    cwd,
    env: {
      HOME: home,
      USERPROFILE: home,
      XDG_CONFIG_HOME: join(home, ".config"),
      GITHUB_SERVER_URL: "https://github.com",
      GITHUB_REPOSITORY: REPO,
      GITHUB_SHA: SHA,
      INPUT_STRATEGY: "clone",
      INPUT_REPOSITORY: REPO,
      INPUT_GITHUB_SERVER_URL: "https://github.com",
      INPUT_TOKEN: TOKEN,
      INPUT_PATH: "wiki",
      INPUT_COMMIT_MESSAGE: `Update wiki ${SHA} (e2e test)`,
      INPUT_IGNORE: "",
      INPUT_DRY_RUN: "false",
      INPUT_PREPROCESS: "true",
      INPUT_DISABLE_EMPTY_COMMITS: "false",
      ...inputs,
    },
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!out.success) {
    throw new Error(
      "cli.ts failed\n--- stdout ---\n" +
        new TextDecoder().decode(out.stdout) +
        "\n--- stderr ---\n" +
        new TextDecoder().decode(out.stderr),
    );
  }
}

// GETs a URL like a wiki reader would, retrying transient failures.
async function fetchOk(url: string): Promise<string> {
  let lastStatus = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 2000 * attempt));
    const res = await fetch(url);
    const body = await res.text();
    if (res.ok) return body;
    lastStatus = res.status;
    if (res.status < 429) break; // 4xx (except rate limit) won't heal
  }
  throw new Error(`GET ${url} failed with HTTP ${lastStatus}`);
}

Deno.test({
  name: "e2e push: publishes the wiki and the rendered Home page links work",
  ignore: !ENABLED,
  fn: async () => {
    await runCli(ROOT, {});

    // --- The wiki repo: the pushed tree must mirror the wiki/ source
    // directory with README.md renamed to Home.md, and the preprocess must
    // have rewritten the links (#8, #78).
    const clone = await Deno.makeTempDir({ prefix: "wiki-e2e-clone-" });
    await git(
      clone,
      "clone",
      "--depth=1",
      `https://github.com/${REPO}.wiki.git`,
      ".",
    );
    const sourceFiles = [...Deno.readDirSync(join(ROOT, "wiki"))]
      .map((e) => (e.name === "README.md" ? "Home.md" : e.name))
      .sort();
    const wikiFiles = [...Deno.readDirSync(clone)]
      .map((e) => e.name)
      .filter((name) => name !== ".git")
      .sort();
    assertEquals(wikiFiles, sourceFiles);

    const home = await Deno.readTextFile(join(clone, "Home.md"));
    assertStringIncludes(home, "(./another-page)");
    assert(!home.includes("(./another-page.md)"), "page link kept .md");
    assertStringIncludes(home, `${BLOB_BASE}/cli.ts`);
    assertStringIncludes(home, `${BLOB_BASE}/tests/cli.test.ts`);

    // --- The rendered Home page: extract the links GitHub actually rendered
    // in the page HTML. Gollum emits in-wiki page links as "wiki/./<page>"
    // and leaves the blob URLs absolute.
    const homeHtml = await fetchOk(WIKI_BASE);
    const hrefs = [...homeHtml.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    const pageLinks = [
      ...new Set(hrefs.filter((h) => h.startsWith("wiki/"))),
    ].map((h) => new URL(h, WIKI_BASE)); // resolve like a browser would
    const blobLinks = [
      ...new Set(
        hrefs.filter((h) => h.startsWith(`https://github.com/${REPO}/blob/`)),
      ),
    ];

    // The repo-file links must be rendered pinned to this exact commit.
    assertEquals(blobLinks.sort(), [
      `${BLOB_BASE}/cli.ts`,
      `${BLOB_BASE}/tests/cli.test.ts`,
    ]);
    // The in-wiki links must lead to the other page, one with the anchor.
    assert(
      pageLinks.some((u) => u.href === `${WIKI_BASE}/another-page`),
      `no rendered link to another-page in ${pageLinks.map((u) => u.href)}`,
    );
    assert(
      pageLinks.some(
        (u) =>
          u.href ===
            `${WIKI_BASE}/another-page#${encodeURIComponent(ANCHOR)}`,
      ),
      "no rendered link carrying the section anchor",
    );

    // --- Navigate every rendered link and verify the destination content.
    for (const page of new Set(pageLinks.map((u) => u.origin + u.pathname))) {
      const html = await fetchOk(page);
      // The linked page really is another-page...
      assertStringIncludes(html, PAGE_MARKER);
      // ...and the heading the anchor link points at exists on it.
      assertStringIncludes(html, ANCHOR);
    }
    for (const blob of blobLinks) {
      const path = blob.slice(`${BLOB_BASE}/`.length);
      // The blob view loads and shows this file at this commit...
      assertStringIncludes(
        await fetchOk(blob),
        `<title>${REPO.split("/")[1]}/${path} at ${SHA}`,
      );
      // ...and the file content at that exact ref is the real file.
      assertStringIncludes(
        await fetchOk(
          `https://raw.githubusercontent.com/${REPO}/${SHA}/${path}`,
        ),
        FILE_MARKERS[path] ?? "",
        `unexpected content for ${path}`,
      );
    }
  },
});

Deno.test({
  name: "e2e pull: syncs the live wiki back with inverse transforms",
  ignore: !ENABLED,
  fn: async () => {
    // A scratch workspace standing in for a fresh actions/checkout, with a
    // stale page that no longer exists in the wiki.
    const workspace = await Deno.makeTempDir({ prefix: "wiki-e2e-pull-" });
    await git(workspace, "init", "-q", "-b", "main");
    await Deno.mkdir(join(workspace, "wiki"));
    await Deno.writeTextFile(
      join(workspace, "wiki", "Stale-Page.md"),
      "deleted from the wiki",
    );

    await runCli(workspace, { INPUT_DIRECTION: "pull" });

    // Inverse transforms: Home.md -> README.md, bare page links get their
    // .md extension back (anchors preserved), absolute URLs untouched, and
    // deleted pages are mirrored away.
    const readme = await Deno.readTextFile(
      join(workspace, "wiki", "README.md"),
    );
    assert(!existsSync(join(workspace, "wiki", "Home.md")), "Home.md kept");
    assert(
      !existsSync(join(workspace, "wiki", "Stale-Page.md")),
      "stale page kept",
    );
    assert(existsSync(join(workspace, "wiki", "another-page.md")));
    assertStringIncludes(readme, "(./another-page.md)");
    assertStringIncludes(readme, `(./another-page.md#${ANCHOR})`);
    assertStringIncludes(readme, `${BLOB_BASE}/cli.ts`);
  },
});
