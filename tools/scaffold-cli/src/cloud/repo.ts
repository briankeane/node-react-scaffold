// The GHCR image path for a repo. GHCR requires a lowercase path, but a GitHub
// owner/repo can contain uppercase — lowercase it once here (mirrors the CI
// workflows' derive step).
export function deriveImage(owner: string, repo: string): string {
  return `ghcr.io/${owner}/${repo}`.toLowerCase();
}
