export const WORKSPACE_HOOK_HEADER = 'kcode-hooks:';

export function parseWorkspaceHooks(mdContent: string): Record<string, string[]> {
    const hooks: Record<string, string[]> = {};
    const phasePattern = /^##\s+kcode-hooks:(\w+)\s*$/gm;
    let match: RegExpExecArray | null;
    while ((match = phasePattern.exec(mdContent)) !== null) {
        const phase = match[1];
        const startIdx = match.index + match[0].length;
        const sectionEnd = mdContent.indexOf('\n## ', startIdx);
        const content = sectionEnd === -1 ? mdContent.substring(startIdx) : mdContent.substring(startIdx, sectionEnd);
        const lines: string[] = [];
        for (const line of content.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            if (/^##\s/.test(trimmed)) continue;
            const listMatch = trimmed.match(/^[-*]\s+(.+)$/);
            if (listMatch) {
                lines.push(listMatch[1].trim());
            } else {
                lines.push(trimmed);
            }
        }
        if (lines.length > 0) {
            hooks[phase] = lines;
        }
    }
    return hooks;
}
