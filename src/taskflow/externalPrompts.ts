import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

let externalDir = path.join(os.homedir(), '.kcode', 'taskflow');

export function setExternalDir(dir: string): void {
    externalDir = dir;
}

export function getExternalDir(): string {
    return externalDir;
}

export function extractPhaseSection(content: string, phase: string): string {
    const regex = new RegExp(`<${phase}>([\\s\\S]*?)<\\/${phase}>`, 'i');
    const match = regex.exec(content);
    return match ? match[1].trim() : '';
}

export function loadPhaseSection(fileName: string, phase: string): string {
    const filePath = path.join(externalDir, fileName);
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return extractPhaseSection(content, phase);
    } catch {
        return '';
    }
}

export function loadExternalPrompt(
    taskType: 'task',
    category: string | undefined,
    _subType: string | undefined,
    phase: string
): string {
    if (taskType !== 'task') return '';

    let content = '';

    if (category) {
        content = loadPhaseSection(`${category}.md`, phase);
    }

    if (!content) {
        content = loadPhaseSection('task.md', phase);
    }

    return content;
}
