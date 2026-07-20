import { insforge } from './insforge';

/**
 * Project repository — all `projects` table access lives here (AGENTS.md §14/§17:
 * keep database queries out of UI components). Runs in the browser against the
 * InsForge SDK; every row is guarded by the `projects` RLS policies, so a user
 * can only ever read or write their own projects.
 */

export interface Project {
  id: string;
  user_id: string;
  name: string;
  prompt: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

/** Derive a short, human-friendly project name from the first line of the prompt. */
function deriveProjectName(prompt: string): string {
  const firstLine = prompt.trim().split('\n')[0]?.trim() ?? '';
  if (!firstLine) return 'Untitled project';
  const clipped = firstLine.length > 60 ? `${firstLine.slice(0, 57)}…` : firstLine;
  return clipped;
}

/**
 * Create a project from a user prompt.
 *
 * The id is generated on the client so the caller can navigate to the editor
 * immediately without waiting for a round-trip value. `user_id` is filled in by
 * the column default (`auth.uid()`) and re-validated by the insert RLS policy.
 */
export async function createProject(prompt: string): Promise<Project> {
  const trimmed = prompt.trim();
  if (!trimmed) {
    throw new Error('A prompt is required to create a project.');
  }

  const id = crypto.randomUUID();

  const { data, error } = await insforge.database
    .from('projects')
    .insert([
      {
        id,
        name: deriveProjectName(trimmed),
        prompt: trimmed,
        status: 'draft',
      },
    ])
    .select();

  if (error) {
    throw new Error(error.message ?? 'Failed to create project.');
  }

  const project = Array.isArray(data) ? data[0] : data;
  if (!project) {
    throw new Error('Project was not returned after creation.');
  }

  return project as Project;
}

/** Fetch a single project by id. RLS guarantees it belongs to the current user. */
export async function getProject(id: string): Promise<Project | null> {
  const { data, error } = await insforge.database
    .from('projects')
    .select('*')
    .eq('id', id)
    .limit(1);

  if (error) {
    throw new Error(error.message ?? 'Failed to load project.');
  }

  const project = Array.isArray(data) ? data[0] : data;
  return (project as Project) ?? null;
}
