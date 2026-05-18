import * as fs from 'fs';
import * as path from 'path';
import type { KCodeCommand } from './types';

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

function parseCommandFile(filePath: string, type: 'kilo' | 'opencode'): KCodeCommand | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const match = raw.match(FRONTMATTER_RE);
    if (!match) return null;

    const frontmatter = match[1];
    const body = match[2].trim();
    const name = path.basename(filePath, '.md');
    const descMatch = frontmatter.match(/description:\s*(.+)/);
    const description = descMatch ? descMatch[1].trim() : name;

    return { name, description, type, body: body || undefined };
  } catch {
    return null;
  }
}

function scanDir(dir: string, type: 'kilo' | 'opencode'): KCodeCommand[] {
  try {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter(f => f.endsWith('.md'))
      .map(f => parseCommandFile(path.join(dir, f), type))
      .filter((c): c is KCodeCommand => c !== null);
  } catch {
    return [];
  }
}

export function loadKiloCommands(workspaceRoot?: string): KCodeCommand[] {
  if (!workspaceRoot) return [];
  const results: KCodeCommand[] = [];

  const kiloDir = path.join(workspaceRoot, '.kilo', 'commands');
  results.push(...scanDir(kiloDir, 'kilo'));

  const opencodeDir = path.join(workspaceRoot, '.opencode', 'commands');
  results.push(...scanDir(opencodeDir, 'opencode'));

  return results;
}
