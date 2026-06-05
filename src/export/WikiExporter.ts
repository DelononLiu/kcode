import * as fs from 'fs';
import * as path from 'path';
import type { Task, ChatMessage, KnowledgeEntry, TimelineEntry, FileChange, PlanStep } from '../types';
import { WikiIndex } from './WikiIndex';

function sanitizeTitle(title: string): string {
    return title
        .replace(/[<>:"/\\|?*]/g, '_')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .substring(0, 50);
}

function fmtTime(ts: number): string {
    const d = new Date(ts);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fileChangeOperation(change: FileChange): '📄 新建' | '📝 修改' | '🗑️ 删除' {
    if (!change.original && change.modified) return '📄 新建';
    if (change.original && !change.modified) return '🗑️ 删除';
    return '📝 修改';
}

function typeIcon(type: string): string {
    const icons: Record<string, string> = { decision: '📐', pitfall: '🐛', pattern: '🔧', code_snippet: '💻' };
    return icons[type] || '📌';
}

function escapeMd(text: string): string {
    return text.replace(/\|/g, '\\|').replace(/\n/g, '<br>');
}

export interface WikiExporterStore {
    getTask(taskId: string): Task | undefined;
    getMessages(taskId: string): ChatMessage[];
    getTaskKnowledgeEntries(taskId: string): KnowledgeEntry[];
    getReviewChanges(taskId: string): FileChange[];
    getTaskTimeline(taskId: string): TimelineEntry[];
    getWikiDir(): string;
}

export interface WikiExportResult {
    markdown: string;
    filePath: string;
    fileName: string;
}

export class WikiExporter {
    constructor(private store: WikiExporterStore) {}

    generate(taskId: string): WikiExportResult {
        const task = this.store.getTask(taskId);
        if (!task) throw new Error(`Task ${taskId} not found`);

        const messages = this.store.getMessages(taskId);
        const knowledge = this.store.getTaskKnowledgeEntries(taskId);
        const changes = this.store.getReviewChanges(taskId);
        const timeline = this.store.getTaskTimeline(taskId);

        const phaseLabels: Record<string, string> = {
            demand: '需求', goal: '目标', plan: '计划',
            execute: '执行', self_verify: '自验', review: '验收',
        };
        const statusLabels: Record<string, string> = {
            pending: '⏳ 待确认', active: '⚡ 进行中',
            in_review: '✅ 待验收', completed: '🏁 已完成', cancelled: '❌ 已取消',
        };

        const lines: string[] = [];

        // Header
        lines.push(`# ${task.title}`);
        lines.push(`> 状态: ${statusLabels[task.status] || task.status} | 创建: ${fmtTime(task.createdAt)} | 阶段: ${phaseLabels[task.phase] || task.phase}`);
        if (task.category) lines.push(`> 分类: ${task.category}`);
        lines.push('');

        // Goal
        lines.push('---');
        lines.push('');
        lines.push('## 🎯 目标');
        lines.push('');
        if (task.goal) {
            lines.push(task.goal);
        } else {
            lines.push('_无明确目标_');
        }
        lines.push('');

        if (task.confirmedItems.length > 0) {
            lines.push('**已锁定共识:**');
            for (const item of task.confirmedItems) {
                lines.push(`- ✅ ${item}`);
            }
            lines.push('');
        }

        // Plan Steps
        if (task.planSteps.length > 0) {
            lines.push('---');
            lines.push('');
            lines.push('## 📋 计划步骤');
            lines.push('');
            const done = task.planSteps.filter(s => s.status === 'completed').length;
            lines.push(`> 进度: ${done}/${task.planSteps.length}\n`);
            for (const step of task.planSteps) {
                const icon = step.status === 'completed' ? '✅' : step.status === 'active' ? '🔄' : '⬜';
                lines.push(`- ${icon} ${step.content}`);
            }
            lines.push('');
        }

        // Timeline
        if (timeline.length > 0) {
            lines.push('---');
            lines.push('');
            lines.push('## 📋 时间线');
            lines.push('');
            lines.push('| 时间 | 类型 | 摘要 |');
            lines.push('|------|------|------|');
            for (const entry of timeline) {
                const typeLabels: Record<string, string> = {
                    phase_change: '🔄 阶段', message: '💬 消息',
                    file_change: '📄 文件', knowledge_extract: '📚 知识',
                };
                const tl = typeLabels[entry.type] || entry.type;
                lines.push(`| ${fmtTime(entry.timestamp)} | ${tl} | ${escapeMd(entry.summary)} |`);
            }
            lines.push('');
        }

        // Messages
        if (messages.length > 0) {
            lines.push('---');
            lines.push('');
            lines.push('## 💬 对话记录');
            lines.push('');
            for (const msg of messages) {
                const time = fmtTime(msg.timestamp);
                if (msg.role === 'user') {
                    lines.push(`### 👤 用户 — ${time}`);
                } else if (msg.role === 'agent') {
                    if (msg.type === 'goal_confirmation') {
                        lines.push(`### 🤖 AI (目标确认) — ${time}`);
                    } else if (msg.type === 'plan_proposal') {
                        lines.push(`### 🤖 AI (计划方案) — ${time}`);
                    } else if (msg.type === 'review_request') {
                        lines.push(`### 🤖 AI (验收请求) — ${time}`);
                    } else if (msg.type === 'todo') {
                        lines.push(`### 🤖 AI (待办清单) — ${time}`);
                    } else {
                        lines.push(`### 🤖 AI — ${time}`);
                    }
                } else if (msg.role === 'tool') {
                    lines.push(`### 🔧 工具调用 — ${time}`);
                }
                lines.push('');
                lines.push(msg.content);
                lines.push('');
                lines.push('---');
                lines.push('');
            }
        }

        // File Changes
        if (changes.length > 0) {
            lines.push('## 📄 文件变更');
            lines.push('');
            lines.push('| 文件 | 操作 | 类型 |');
            lines.push('|------|------|------|');
            for (const change of changes) {
                const op = fileChangeOperation(change);
                const ext = path.extname(change.filePath) || '?';
                lines.push(`| \`${change.filePath}\` | ${op} | ${ext} |`);
            }
            lines.push('');
        }

        // Knowledge
        if (knowledge.length > 0) {
            lines.push('---');
            lines.push('');
            lines.push('## 📚 知识沉淀');
            lines.push('');
            lines.push('| 类型 | 标题 | 来源阶段 | 标签 |');
            lines.push('|------|------|----------|------|');
            for (const k of knowledge) {
                const phase = k.phase ? (phaseLabels[k.phase] || k.phase) : '-';
                const tags = k.tags.join(', ');
                lines.push(`| ${typeIcon(k.type)} ${k.type} | ${escapeMd(k.title)} | ${phase} | ${escapeMd(tags)} |`);
            }
            lines.push('');
            for (const k of knowledge) {
                lines.push('<details>');
                lines.push(`<summary>${typeIcon(k.type)} ${k.title}</summary>`);
                lines.push('');
                lines.push(k.content);
                lines.push('');
                lines.push('</details>');
                lines.push('');
            }
        }

        // Footer
        lines.push('---');
        lines.push('');
        lines.push(`> 由 KCode 自动生成 · ${fmtTime(Date.now())}`);

        const fileName = `${task.id}_${sanitizeTitle(task.title)}.md`;
        return { markdown: lines.join('\n'), filePath: '', fileName };
    }

    writeToWiki(taskId: string): WikiExportResult {
        const result = this.generate(taskId);
        const wikiDir = this.store.getWikiDir();
        fs.mkdirSync(wikiDir, { recursive: true });

        const filePath = path.join(wikiDir, result.fileName);
        fs.writeFileSync(filePath, result.markdown, 'utf-8');

        result.filePath = filePath;

        const task = this.store.getTask(taskId);
        WikiIndex.append(wikiDir, {
            taskId,
            title: task?.title || '',
            status: task?.status || 'pending',
            fileName: result.fileName,
        });

        return result;
    }
}
