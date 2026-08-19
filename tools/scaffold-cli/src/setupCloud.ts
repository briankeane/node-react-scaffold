import { loadConfig } from './config.js';
import type { CloudContext, Env, Mode } from './cloud/types.js';
import { deriveImage } from './cloud/repo.js';
import { RenderApi } from './cloud/clients/render.js';
import { GitHubCli } from './cloud/clients/github.js';
import { NetlifyCli } from './cloud/clients/netlify.js';
import { realIO } from './cloud/io.js';
import { buildSteps } from './cloud/steps.js';
import { runSteps } from './cloud/orchestrator.js';

// Build the real CloudContext (config -> envs/jobs, gh -> repo, env -> tokens,
// real clients + terminal IO) and run the ordered steps. Returns the exit code.
export async function setupCloud(rootDir: string, opts: { mode: Mode }): Promise<number> {
  const config = loadConfig(rootDir);
  const envs: Env[] = config.features.staging ? ['production', 'staging'] : ['production'];
  const jobs = config.features.jobs;

  const github = new GitHubCli();
  let repo: { owner: string; name: string };
  try {
    repo = await github.currentRepo();
  } catch (err) {
    console.error(
      `Could not determine the GitHub repo (is gh authenticated and this a repo?): ${(err as Error).message}`,
    );
    return 2;
  }

  const ctx: CloudContext = {
    rootDir,
    mode: opts.mode,
    envs,
    jobs,
    repo: { owner: repo.owner, name: repo.name, image: deriveImage(repo.owner, repo.name) },
    tokens: {
      renderApiKey: process.env.RENDER_API_KEY,
      netlifyAuthToken: process.env.NETLIFY_AUTH_TOKEN,
    },
    render: new RenderApi(process.env.RENDER_API_KEY ?? ''),
    github,
    netlify: new NetlifyCli(),
    io: realIO(),
  };

  return runSteps(ctx, buildSteps());
}
