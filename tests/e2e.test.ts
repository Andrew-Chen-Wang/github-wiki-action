// Live end-to-end tests for cli.ts against the repository's real wiki.
//
// The push test publishes wiki/ to the actual GitHub wiki, clones it back to
// verify the pushed contents, and then verifies the *published* result over
// HTTP: the pages GitHub renders, that every link on the Home page resolves,
// and that the in-wiki anchor link targets a heading that exists. The pull
// test then syncs the live wiki back into a scratch workspace and verifies
// the inverse preprocess transforms.
//
// These tests write to the real wiki, so they only run when a token is
// available AND we're either in GitHub Actions or explicitly opted in:
//
//   E2E=1 GITHUB_TOKEN=$(gh auth token) deno test -A tests/e2e.test.ts
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
// cli.ts pins blob links to GITHUB_SHA and falls back to HEAD outside CI.
const SHA = Deno.env.get("GITHUB_SHA") ?? "HEAD";
const BLOB_BASE = `https://github.com/${REPO}/blob/${SHA}`;
const WIKI_BASE = `https://github.com/${REPO}/wiki`;

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
// real gh, GITHUB_* vars) is inherited.
async function runCli(cwd: string, inputs: Record<string, string>) {
  const home = await Deno.makeTempDir({ prefix: "wiki-e2e-home-" });
  const out = await new Deno.Command(Deno.execPath(), {
    args: ["run", "-A", CLI_PATH],
    cwd,
    env: {
      HOME: home,
      USERPROFILE: home,
      XDG_CONFIG_HOME: join(home, ".config"),
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
  name: "e2e push: publishes the wiki and every Home page link resolves",
  ignore: !ENABLED,
  fn: async () => {
    await runCli(ROOT, {});

    // Clone the wiki back: the pushed tree must mirror the wiki/ source
    // directory with README.md renamed to Home.md.
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

    // Preprocess transforms: page links went bare (#8) and repo-file links
    // became blob URLs pinned to this commit (#78).
    const home = await Deno.readTextFile(join(clone, "Home.md"));
    assertStringIncludes(home, "(./another-page)");
    assert(!home.includes("(./another-page.md)"), "page link kept .md");
    assertStringIncludes(home, `${BLOB_BASE}/cli.ts`);
    assertStringIncludes(home, `${BLOB_BASE}/tests/cli.test.ts`);

    // Navigate every link on the published Home page: in-wiki links resolve
    // relative to the wiki, blob links are absolute. All must load.
    const links = [...home.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1]);
    assert(links.length >= 4, `only found ${links.length} links on Home`);
    for (const link of links) {
      const path = link.split("#")[0];
      if (!path) continue; // same-page anchor
      assert(
        path.startsWith("./") || path.startsWith("https://"),
        `unexpected link on Home: ${link}`,
      );
      const target = path.startsWith("./")
        ? `${WIKI_BASE}/${path.slice(2)}`
        : path;
      await fetchOk(target);
    }

    // The rendered Home page shows the blob link, and the in-wiki anchor
    // link targets a heading that exists on the rendered destination page.
    assertStringIncludes(await fetchOk(WIKI_BASE), `${BLOB_BASE}/cli.ts`);
    assertStringIncludes(
      await fetchOk(`${WIKI_BASE}/another-page`),
      "some＿impꗝrtant＿stuff-",
    );
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
    assertStringIncludes(
      readme,
      "(./another-page.md#some＿impꗝrtant＿stuff-)",
    );
    assertStringIncludes(readme, `${BLOB_BASE}/cli.ts`);
  },
});
