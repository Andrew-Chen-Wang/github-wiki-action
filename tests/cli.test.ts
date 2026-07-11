// Integration tests for cli.ts.
//
// Each test builds a fake "GitHub wiki" as a local bare git repo, a fake
// workspace (a git checkout containing a wiki/ source directory), runs
// cli.ts as a subprocess against them via a file:// remote, and then
// verifies the exact file tree and contents that ended up in the wiki repo.
//
// Run with: deno test -A tests/cli.test.ts
import { assertEquals } from "jsr:@std/assert@^1.0.0";
import { delimiter, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const CLI_PATH = fileURLToPath(new URL("../cli.ts", import.meta.url));
const REPO = "test/test";

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

async function writeFiles(root: string, files: Record<string, string>) {
  for (const [rel, content] of Object.entries(files)) {
    const path = join(root, ...rel.split("/"));
    await Deno.mkdir(dirname(path), { recursive: true });
    await Deno.writeTextFile(path, content);
  }
}

interface Scenario {
  strategy?: "clone" | "init";
  /** Pre-existing wiki contents; "empty" = wiki repo exists but has no commits. */
  remote: Record<string, string> | "empty";
  /** Contents of the workspace's wiki/ source directory. */
  workspaceWiki: Record<string, string>;
  /** Exact expected wiki repo contents after the action runs. */
  expect: Record<string, string>;
  preprocess?: boolean;
}

async function runScenario(scenario: Scenario): Promise<void> {
  const root = await Deno.makeTempDir({ prefix: "wiki-action-test-" });
  try {
    // 1. Fake remote: a bare repo laid out so that
    //    `${server-url}/${repository}.wiki.git` resolves to it.
    const bare = join(root, "remote", ...`${REPO}.wiki.git`.split("/"));
    await Deno.mkdir(bare, { recursive: true });
    await git(bare, "init", "--bare", "-q");
    // GitHub wikis live on master; make the empty-repo case match too.
    await git(bare, "symbolic-ref", "HEAD", "refs/heads/master");
    if (scenario.remote !== "empty") {
      const seed = join(root, "seed");
      await Deno.mkdir(seed);
      await git(seed, "init", "-q", "-b", "master");
      await writeFiles(seed, scenario.remote);
      await git(seed, "add", "-A");
      await git(
        seed,
        "-c", "user.email=seed@example.com",
        "-c", "user.name=seed",
        "commit", "-qm", "existing wiki content",
      );
      await git(seed, "push", "-q", bare, "master");
    }

    // 2. Fake workspace: a git checkout (like actions/checkout) with the
    //    wiki source under wiki/.
    const workspace = join(root, "workspace");
    await Deno.mkdir(join(workspace, "wiki"), { recursive: true });
    await writeFiles(join(workspace, "wiki"), scenario.workspaceWiki);
    await git(workspace, "init", "-q", "-b", "main");
    await git(workspace, "add", "-A");
    await git(
      workspace,
      "-c", "user.email=ws@example.com",
      "-c", "user.name=ws",
      "commit", "-qm", "workspace",
    );

    // 3. Stub `gh` so `gh auth setup-git` is a no-op (file:// needs no auth).
    const bin = join(root, "bin");
    await Deno.mkdir(bin);
    await Deno.writeTextFile(join(bin, "gh"), "#!/bin/sh\nexit 0\n");
    if (Deno.build.os === "windows") {
      await Deno.writeTextFile(join(bin, "gh.cmd"), "@echo off\r\nexit /b 0\r\n");
    } else {
      await Deno.chmod(join(bin, "gh"), 0o755);
    }

    // 4. Isolated HOME so the cli's `git config --global` writes stay here.
    const home = join(root, "home");
    await Deno.mkdir(home);

    const env: Record<string, string> = { ...Deno.env.toObject() };
    for (const key of Object.keys(env)) {
      if (key.toUpperCase() === "PATH") delete env[key];
    }
    env.PATH = bin + delimiter + (Deno.env.get("PATH") ?? "");
    env.HOME = home;
    env.USERPROFILE = home;
    env.XDG_CONFIG_HOME = join(home, ".config");
    env.INPUT_STRATEGY = scenario.strategy ?? "clone";
    env.INPUT_REPOSITORY = REPO;
    env.INPUT_GITHUB_SERVER_URL = pathToFileURL(join(root, "remote")).href;
    env.INPUT_TOKEN = "test-token";
    env.INPUT_PATH = "wiki";
    env.INPUT_COMMIT_MESSAGE = "test commit";
    env.INPUT_IGNORE = "";
    env.INPUT_DRY_RUN = "false";
    env.INPUT_PREPROCESS = String(scenario.preprocess ?? true);
    env.INPUT_DISABLE_EMPTY_COMMITS = "false";

    const out = await new Deno.Command(Deno.execPath(), {
      args: ["run", "-A", CLI_PATH],
      cwd: workspace,
      env,
      clearEnv: true,
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

    // 5. Verify the wiki repo now contains exactly the expected files.
    const tree = (await git(bare, "ls-tree", "-r", "--name-only", "master"))
      .split("\n")
      .filter(Boolean)
      .sort();
    assertEquals(tree, Object.keys(scenario.expect).sort());
    for (const [path, content] of Object.entries(scenario.expect)) {
      assertEquals(
        await git(bare, "show", `master:${path}`),
        content.trim(),
        `content mismatch for ${path}`,
      );
    }

    // 6. Verify the workspace was not polluted (regression check for #90,
    //    where wiki files were copied into the workspace instead of the
    //    wiki clone).
    const workspaceEntries = [...Deno.readDirSync(workspace)]
      .map((e) => e.name)
      .sort();
    assertEquals(workspaceEntries, [".git", "wiki"]);
  } finally {
    await Deno.remove(root, { recursive: true }).catch(() => {});
  }
}

Deno.test("adds new files to an existing wiki", () =>
  runScenario({
    remote: { "Home.md": "old home" },
    workspaceWiki: {
      "Home.md": "updated home",
      "Usage.md": "how to use this project",
    },
    expect: {
      "Home.md": "updated home",
      "Usage.md": "how to use this project",
    },
  }));

Deno.test("works when the source has no Home.md", () =>
  runScenario({
    remote: { "Home.md": "default page" },
    workspaceWiki: {
      "Setup.md": "setup instructions",
      "Usage.md": "usage instructions",
    },
    expect: {
      "Setup.md": "setup instructions",
      "Usage.md": "usage instructions",
    },
  }));

Deno.test("removes files deleted from the source", () =>
  runScenario({
    remote: {
      "Home.md": "home",
      "Old-Page.md": "obsolete",
      "Deprecated.md": "obsolete too",
    },
    workspaceWiki: { "Home.md": "home" },
    expect: { "Home.md": "home" },
  }));

Deno.test("syncs adds and deletes in subdirectories 4 levels deep", () =>
  runScenario({
    remote: {
      "Home.md": "home",
      "docs/a.md": "a",
      "docs/api/b.md": "b",
      "docs/api/v1/c.md": "c",
      "docs/api/v1/internal/d.md": "d",
      "stale/gone.md": "should be deleted",
    },
    workspaceWiki: {
      "Home.md": "home v2",
      "docs/a.md": "a",
      "docs/api/v1/internal/d.md": "d v2",
      "docs/api/v1/internal/new-leaf.md": "new file 4 levels deep",
      "brand/new/deep/tree/leaf.md": "new subtree 4 levels deep",
    },
    expect: {
      "Home.md": "home v2",
      "docs/a.md": "a",
      "docs/api/v1/internal/d.md": "d v2",
      "docs/api/v1/internal/new-leaf.md": "new file 4 levels deep",
      "brand/new/deep/tree/leaf.md": "new subtree 4 levels deep",
    },
  }));

// When the wiki is first enabled, GitHub seeds it with its own Home.md (and
// people may have edited it in the UI since), so the wiki starts completely
// mis-synced with the source tree. The first sync must fully replace it.
Deno.test("initial setup: replaces a completely mis-synced wiki (clone strategy)", () =>
  runScenario({
    strategy: "clone",
    remote: {
      "Home.md": "Welcome to the wiki!",
      "Random-Notes.md": "created in the web UI",
      "scratch/ideas.md": "more UI-created content",
    },
    workspaceWiki: {
      "Home.md": "real home",
      "Getting-Started.md": "getting started",
      "guides/install/steps/advanced/tuning.md": "deep guide",
    },
    expect: {
      "Home.md": "real home",
      "Getting-Started.md": "getting started",
      "guides/install/steps/advanced/tuning.md": "deep guide",
    },
  }));

Deno.test("initial setup: replaces a completely mis-synced wiki (init strategy)", () =>
  runScenario({
    strategy: "init",
    remote: {
      "Home.md": "Welcome to the wiki!",
      "Random-Notes.md": "created in the web UI",
    },
    workspaceWiki: {
      "Home.md": "real home",
      "Getting-Started.md": "getting started",
    },
    expect: {
      "Home.md": "real home",
      "Getting-Started.md": "getting started",
    },
  }));

Deno.test("initial setup: first push to an empty wiki repository", () =>
  runScenario({
    remote: "empty",
    workspaceWiki: {
      "Home.md": "first ever home",
      "guides/setup.md": "setup guide",
    },
    expect: {
      "Home.md": "first ever home",
      "guides/setup.md": "setup guide",
    },
  }));

Deno.test("preprocess renames README.md to Home.md and rewrites .md links", () =>
  runScenario({
    preprocess: true,
    remote: { "Home.md": "old" },
    workspaceWiki: {
      "README.md": "# Title\n\n[Usage](Usage.md)\n",
      "Usage.md": "usage",
    },
    expect: {
      "Home.md": "# Title\n\n[Usage](Usage)",
      "Usage.md": "usage",
    },
  }));
