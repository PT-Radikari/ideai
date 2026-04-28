import { cp, mkdir, mkdtemp, readdir, rm, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const DEFAULT_REPO = "openai/skills";
const DEFAULT_PATH = "skills/.curated";
const DEFAULT_REF = "main";

class CliError extends Error {}

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

type ListArgs = {
  repo: string;
  path: string;
  ref: string;
  format: "text" | "json";
};

type InstallArgs = {
  url?: string;
  repo?: string;
  path?: string[];
  ref: string;
  dest?: string;
  name?: string;
  method: "auto" | "download" | "git";
};

type Source = {
  owner: string;
  repo: string;
  ref: string;
  paths: string[];
  repoUrl?: string;
};

function codexHome(): string {
  return process.env.CODEX_HOME ?? path.join(homedir(), ".codex");
}

function githubApiContentsUrl(repo: string, repoPath: string, ref: string): string {
  return `https://api.github.com/repos/${repo}/contents/${repoPath}?ref=${ref}`;
}

async function githubRequest(url: string, userAgent: string): Promise<Buffer> {
  const headers: Record<string, string> = {
    "User-Agent": userAgent,
    Accept: "application/vnd.github+json",
  };
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  if (token) {
    headers.Authorization = `token ${token}`;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new HttpError(response.status, `HTTP ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

function printGlobalHelp(): void {
  console.log("Usage:");
  console.log("  npx -y tsx tools/codex-skills/codex-skill.ts list [options]");
  console.log("  npx -y tsx tools/codex-skills/codex-skill.ts install [options]");
  console.log("");
  console.log("List options:");
  console.log(`  --repo <owner/repo>     Default: ${DEFAULT_REPO}`);
  console.log(`  --path <repo/path>      Default: ${DEFAULT_PATH}`);
  console.log(`  --ref <git-ref>         Default: ${DEFAULT_REF}`);
  console.log("  --format <text|json>    Default: text");
  console.log("");
  console.log("Install options:");
  console.log("  --repo <owner/repo>");
  console.log("  --url <github-url>");
  console.log("  --path <repo/path> [more paths...]");
  console.log(`  --ref <git-ref>         Default: ${DEFAULT_REF}`);
  console.log("  --dest <skills-dir>");
  console.log("  --name <skill-name>");
  console.log("  --method <auto|download|git>    Default: auto");
}

function consumeValue(argv: string[], index: number, flag: string): [string, number] {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new CliError(`Missing value for ${flag}`);
  }
  return [value, index + 2];
}

function consumeValues(argv: string[], index: number, flag: string): [string[], number] {
  const values: string[] = [];
  let cursor = index + 1;
  while (cursor < argv.length && !argv[cursor].startsWith("--")) {
    values.push(argv[cursor]);
    cursor += 1;
  }
  if (values.length === 0) {
    throw new CliError(`Missing value for ${flag}`);
  }
  return [values, cursor];
}

function parseListArgs(argv: string[]): ListArgs {
  const args: ListArgs = {
    repo: DEFAULT_REPO,
    path: DEFAULT_PATH,
    ref: DEFAULT_REF,
    format: "text",
  };

  let index = 0;
  while (index < argv.length) {
    const current = argv[index];
    if (current === "--help" || current === "-h") {
      printGlobalHelp();
      process.exit(0);
    }
    if (current === "--repo") {
      [args.repo, index] = consumeValue(argv, index, current);
      continue;
    }
    if (current === "--path") {
      [args.path, index] = consumeValue(argv, index, current);
      continue;
    }
    if (current === "--ref") {
      [args.ref, index] = consumeValue(argv, index, current);
      continue;
    }
    if (current === "--format") {
      const [format, nextIndex] = consumeValue(argv, index, current);
      if (format !== "text" && format !== "json") {
        throw new CliError("Invalid --format. Expected text or json.");
      }
      args.format = format;
      index = nextIndex;
      continue;
    }
    throw new CliError(`Unknown argument: ${current}`);
  }

  return args;
}

function parseInstallArgs(argv: string[]): InstallArgs {
  const args: InstallArgs = {
    ref: DEFAULT_REF,
    method: "auto",
  };

  let index = 0;
  while (index < argv.length) {
    const current = argv[index];
    if (current === "--help" || current === "-h") {
      printGlobalHelp();
      process.exit(0);
    }
    if (current === "--repo") {
      [args.repo, index] = consumeValue(argv, index, current);
      continue;
    }
    if (current === "--url") {
      [args.url, index] = consumeValue(argv, index, current);
      continue;
    }
    if (current === "--path") {
      [args.path, index] = consumeValues(argv, index, current);
      continue;
    }
    if (current === "--ref") {
      [args.ref, index] = consumeValue(argv, index, current);
      continue;
    }
    if (current === "--dest") {
      [args.dest, index] = consumeValue(argv, index, current);
      continue;
    }
    if (current === "--name") {
      [args.name, index] = consumeValue(argv, index, current);
      continue;
    }
    if (current === "--method") {
      const [method, nextIndex] = consumeValue(argv, index, current);
      if (method !== "auto" && method !== "download" && method !== "git") {
        throw new CliError("Invalid --method. Expected auto, download, or git.");
      }
      args.method = method;
      index = nextIndex;
      continue;
    }
    throw new CliError(`Unknown argument: ${current}`);
  }

  return args;
}

async function installedSkills(): Promise<Set<string>> {
  const root = path.join(codexHome(), "skills");
  if (!existsSync(root)) {
    return new Set();
  }

  const entries = await readdir(root, { withFileTypes: true });
  return new Set(entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name));
}

async function listSkills(args: ListArgs): Promise<void> {
  const apiUrl = githubApiContentsUrl(args.repo, args.path, args.ref);
  let payload: Buffer;

  try {
    payload = await githubRequest(apiUrl, "codex-skill-list");
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) {
      throw new CliError(`Skills path not found: https://github.com/${args.repo}/tree/${args.ref}/${args.path}`);
    }
    if (error instanceof HttpError) {
      throw new CliError(`Failed to fetch skills: HTTP ${error.status}`);
    }
    throw error;
  }

  const data = JSON.parse(payload.toString("utf8"));
  if (!Array.isArray(data)) {
    throw new CliError("Unexpected skills listing response.");
  }

  const skills = data
    .filter((item): item is { name: string; type: string } => typeof item?.name === "string" && typeof item?.type === "string")
    .filter((item) => item.type === "dir")
    .map((item) => item.name)
    .sort((left, right) => left.localeCompare(right));

  const installed = await installedSkills();
  if (args.format === "json") {
    console.log(JSON.stringify(skills.map((name) => ({ name, installed: installed.has(name) }))));
    return;
  }

  skills.forEach((name, idx) => {
    const suffix = installed.has(name) ? " (already installed)" : "";
    console.log(`${idx + 1}. ${name}${suffix}`);
  });
}

function tmpRoot(): string {
  return path.join(tmpdir(), "codex");
}

async function ensureTmpRoot(): Promise<void> {
  await mkdir(tmpRoot(), { recursive: true });
}

function parseGithubUrl(urlString: string, defaultRef: string): [string, string, string, string | undefined] {
  const parsed = new URL(urlString);
  if (parsed.hostname !== "github.com") {
    throw new CliError("Only GitHub URLs are supported for download mode.");
  }

  const parts = parsed.pathname.split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new CliError("Invalid GitHub URL.");
  }

  const [owner, repo] = parts;
  let ref = defaultRef;
  let repoPath = "";

  if (parts.length > 2) {
    if (parts[2] === "tree" || parts[2] === "blob") {
      if (parts.length < 4) {
        throw new CliError("GitHub URL missing ref or path.");
      }
      ref = parts[3];
      repoPath = parts.slice(4).join("/");
    } else {
      repoPath = parts.slice(2).join("/");
    }
  }

  return [owner, repo, ref, repoPath || undefined];
}

function validateRelativePath(repoPath: string): void {
  if (path.isAbsolute(repoPath)) {
    throw new CliError("Skill path must be a relative path inside the repo.");
  }

  const normalized = path.posix.normalize(repoPath);
  if (normalized === ".." || normalized.startsWith("../")) {
    throw new CliError("Skill path must be a relative path inside the repo.");
  }
}

function validateSkillName(name: string): void {
  if (!name || name.includes("/") || name.includes("\\")) {
    throw new CliError("Skill name must be a single path segment.");
  }
  if (name === "." || name === "..") {
    throw new CliError("Invalid skill name.");
  }
}

function buildRepoUrl(owner: string, repo: string): string {
  return `https://github.com/${owner}/${repo}.git`;
}

function buildRepoSsh(owner: string, repo: string): string {
  return `git@github.com:${owner}/${repo}.git`;
}

async function runCommand(command: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  try {
    return await execFileAsync(command, args, { encoding: "utf8" });
  } catch (error) {
    const message =
      typeof error === "object" && error !== null && "stderr" in error && typeof error.stderr === "string"
        ? error.stderr.trim() || "Command failed."
        : error instanceof Error
          ? error.message
          : "Command failed.";
    throw new CliError(message);
  }
}

async function downloadRepoZip(owner: string, repo: string, ref: string, destDir: string): Promise<string> {
  const zipUrl = `https://codeload.github.com/${owner}/${repo}/zip/${ref}`;
  let payload: Buffer;

  try {
    payload = await githubRequest(zipUrl, "codex-skill-install");
  } catch (error) {
    if (error instanceof HttpError) {
      throw new CliError(`Download failed: HTTP ${error.status}`);
    }
    throw error;
  }

  const zipPath = path.join(destDir, "repo.zip");
  await writeFile(zipPath, payload);

  const { stdout } = await runCommand("unzip", ["-Z1", zipPath]);
  const entries = stdout.split("\n").map((entry) => entry.trim()).filter(Boolean);
  if (entries.length === 0) {
    throw new CliError("Downloaded archive was empty.");
  }

  for (const entry of entries) {
    const normalized = path.posix.normalize(entry);
    if (path.posix.isAbsolute(normalized) || normalized === ".." || normalized.startsWith("../")) {
      throw new CliError("Archive contains files outside the destination.");
    }
  }

  const topLevels = new Set(entries.map((entry) => entry.split("/")[0]).filter(Boolean));
  if (topLevels.size !== 1) {
    throw new CliError("Unexpected archive layout.");
  }

  await runCommand("unzip", ["-q", zipPath, "-d", destDir]);
  return path.join(destDir, [...topLevels][0]);
}

async function gitSparseCheckout(repoUrl: string, ref: string, repoPaths: string[], destDir: string): Promise<string> {
  const repoDir = path.join(destDir, "repo");
  try {
    await runCommand("git", [
      "clone",
      "--filter=blob:none",
      "--depth",
      "1",
      "--sparse",
      "--single-branch",
      "--branch",
      ref,
      repoUrl,
      repoDir,
    ]);
  } catch {
    await runCommand("git", [
      "clone",
      "--filter=blob:none",
      "--depth",
      "1",
      "--sparse",
      "--single-branch",
      repoUrl,
      repoDir,
    ]);
  }

  await runCommand("git", ["-C", repoDir, "sparse-checkout", "set", ...repoPaths]);
  await runCommand("git", ["-C", repoDir, "checkout", ref]);
  return repoDir;
}

async function validateSkill(skillPath: string): Promise<void> {
  const stats = await stat(skillPath).catch(() => undefined);
  if (!stats?.isDirectory()) {
    throw new CliError(`Skill path not found: ${skillPath}`);
  }

  const skillMd = path.join(skillPath, "SKILL.md");
  const skillStats = await stat(skillMd).catch(() => undefined);
  if (!skillStats?.isFile()) {
    throw new CliError("SKILL.md not found in selected skill directory.");
  }
}

async function copySkill(src: string, destDir: string): Promise<void> {
  await mkdir(path.dirname(destDir), { recursive: true });
  if (existsSync(destDir)) {
    throw new CliError(`Destination already exists: ${destDir}`);
  }
  await cp(src, destDir, { recursive: true });
}

async function prepareRepo(source: Source, method: InstallArgs["method"], tempDir: string): Promise<string> {
  if (method === "download" || method === "auto") {
    try {
      return await downloadRepoZip(source.owner, source.repo, source.ref, tempDir);
    } catch (error) {
      if (method === "download") {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("HTTP 401") && !message.includes("HTTP 403") && !message.includes("HTTP 404")) {
        throw error;
      }
    }
  }

  if (method === "git" || method === "auto") {
    const repoUrl = source.repoUrl ?? buildRepoUrl(source.owner, source.repo);
    try {
      return await gitSparseCheckout(repoUrl, source.ref, source.paths, tempDir);
    } catch {
      return gitSparseCheckout(buildRepoSsh(source.owner, source.repo), source.ref, source.paths, tempDir);
    }
  }

  throw new CliError("Unsupported method.");
}

function resolveSource(args: InstallArgs): Source {
  if (args.url) {
    const [owner, repo, ref, urlPath] = parseGithubUrl(args.url, args.ref);
    const paths = args.path ? [...args.path] : urlPath ? [urlPath] : [];
    if (paths.length === 0) {
      throw new CliError("Missing --path for GitHub URL.");
    }
    return { owner, repo, ref, paths };
  }

  if (!args.repo) {
    throw new CliError("Provide --repo or --url.");
  }

  if (args.repo.includes("://")) {
    return resolveSource({ ...args, url: args.repo, repo: undefined });
  }

  const repoParts = args.repo.split("/").filter(Boolean);
  if (repoParts.length !== 2) {
    throw new CliError("--repo must be in owner/repo format.");
  }
  if (!args.path || args.path.length === 0) {
    throw new CliError("Missing --path for --repo.");
  }

  return {
    owner: repoParts[0],
    repo: repoParts[1],
    ref: args.ref,
    paths: [...args.path],
  };
}

function defaultDest(): string {
  return path.join(codexHome(), "skills");
}

async function installSkills(args: InstallArgs): Promise<void> {
  const source = resolveSource(args);
  source.paths.forEach(validateRelativePath);
  const destRoot = args.dest ?? defaultDest();

  await ensureTmpRoot();
  const tempDir = await mkdtemp(path.join(tmpRoot(), "skill-install-"));
  const installed: Array<{ skillName: string; destDir: string }> = [];

  try {
    const repoRoot = await prepareRepo(source, args.method, tempDir);

    for (const repoPath of source.paths) {
      const skillName = (source.paths.length === 1 ? args.name : undefined) ?? path.basename(repoPath.replace(/\/+$/, ""));
      if (!skillName) {
        throw new CliError("Unable to derive skill name.");
      }
      validateSkillName(skillName);

      const destDir = path.join(destRoot, skillName);
      if (existsSync(destDir)) {
        throw new CliError(`Destination already exists: ${destDir}`);
      }

      const skillSrc = path.join(repoRoot, repoPath);
      await validateSkill(skillSrc);
      await copySkill(skillSrc, destDir);
      installed.push({ skillName, destDir });
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }

  installed.forEach(({ skillName, destDir }) => {
    console.log(`Installed ${skillName} to ${destDir}`);
  });
}

async function main(): Promise<number> {
  const [command, ...rest] = process.argv.slice(2);

  if (!command || command === "--help" || command === "-h") {
    printGlobalHelp();
    return command ? 0 : 1;
  }

  if (command === "list") {
    await listSkills(parseListArgs(rest));
    return 0;
  }

  if (command === "install") {
    await installSkills(parseInstallArgs(rest));
    return 0;
  }

  throw new CliError(`Unknown command: ${command}`);
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    process.exitCode = 1;
  });
