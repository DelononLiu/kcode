import * as fs from 'fs';
import * as path from 'path';

export interface WikiIndexEntry {
    taskId: string;
    title: string;
    status: string;
    fileName: string;
}

export class WikiIndex {
    static load(wikiDir: string): WikiIndexEntry[] {
        const indexPath = path.join(wikiDir, 'INDEX.md');
        if (!fs.existsSync(indexPath)) return [];
        try {
            const content = fs.readFileSync(indexPath, 'utf-8');
            const entries: WikiIndexEntry[] = [];
            const regex = /-\s+\[([^\]]+)\]\(([^)]+)\)\s+—\s+(\S+)/g;
            let match;
            while ((match = regex.exec(content)) !== null) {
                const title = match[1];
                const fileName = match[2];
                const statusEmoji = match[3];
                const statusMap: Record<string, string> = {
                    '🏁': 'completed', '✅': 'in_review', '⚡': 'active',
                    '⏳': 'pending', '❌': 'cancelled',
                };
                const status = statusMap[statusEmoji] || 'pending';
                const taskId = fileName.replace(/\.md$/, '').replace(/^[^_]+_/, '');
                entries.push({ taskId, title, status, fileName });
            }
            return entries;
        } catch {
            return [];
        }
    }

    static append(wikiDir: string, entry: WikiIndexEntry): void {
        const indexPath = path.join(wikiDir, 'INDEX.md');
        let content = '';
        const statusEmoji: Record<string, string> = {
            completed: '🏁', in_review: '✅', active: '⚡',
            pending: '⏳', cancelled: '❌',
        };

        if (fs.existsSync(indexPath)) {
            content = fs.readFileSync(indexPath, 'utf-8');

            const entryRegex = new RegExp(`-\\s+\\[${escapeRegex(entry.title)}\\]\\(${escapeRegex(entry.fileName)}\\)`);
            if (entryRegex.test(content)) {
                content = content.replace(entryRegex, `- [${entry.title}](${entry.fileName}) — ${statusEmoji[entry.status] || entry.status}`);
            } else {
                content += `- [${entry.title}](${entry.fileName}) — ${statusEmoji[entry.status] || entry.status}\n`;
            }
        } else {
            content = `# KCode Wiki 索引\n`;
            content += `> 最后更新: ${new Date().toISOString().slice(0, 16).replace('T', ' ')}\n\n`;
            content += `## 任务\n\n`;
            content += `- [${entry.title}](${entry.fileName}) — ${statusEmoji[entry.status] || entry.status}\n`;
        }

        fs.writeFileSync(indexPath, content, 'utf-8');
    }

    static remove(wikiDir: string, fileName: string): void {
        const indexPath = path.join(wikiDir, 'INDEX.md');
        if (!fs.existsSync(indexPath)) return;
        let content = fs.readFileSync(indexPath, 'utf-8');
        const lineRegex = new RegExp(`-\\s+\\[[^\\]]+\\]\\(${escapeRegex(fileName)}\\)[^\n]*\n?`);
        content = content.replace(lineRegex, '');
        fs.writeFileSync(indexPath, content, 'utf-8');
    }
}

function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
