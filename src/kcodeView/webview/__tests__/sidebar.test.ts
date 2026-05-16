// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

let sidebarLoaded = false;

describe('sidebar renderSidebar', () => {
    beforeEach(async () => {
        document.body.innerHTML = `
            <div id="project-list"></div>
            <div id="assistant-entry"></div>
            <div id="__sidebarData"></div>
        `;
        (window as any).acquireVsCodeApi = () => ({
            postMessage: vi.fn(),
            getState: () => ({}),
            setState: () => {},
        });
        if (!sidebarLoaded) {
            // @ts-ignore — sidebar.ts is a script, loaded for side effects
            await import('../sidebar');
            sidebarLoaded = true;
        }
    });

    it('empty state shows placeholder text', () => {
        (window as any).renderSidebar([], []);
        const el = document.getElementById('project-list');
        expect(el?.innerHTML).toContain('暂无任务');
    });

    it('renders unassigned tasks as virtual project', () => {
        const tasks: any[] = [
            { id: 't1', title: 'Task One', status: 'active', phase: 'execute', archived: false },
        ];
        (window as any).renderSidebar(tasks, []);
        const list = document.getElementById('project-list');
        expect(list?.textContent).toContain('Task One');
    });

    it('renders project section with nested tasks', () => {
        const project = { id: 'p1', name: 'My Project', type: 'project' };
        const tasks: any[] = [
            { id: 't1', title: 'Project Task', status: 'active', phase: 'plan', containerId: 'p1', archived: false },
        ];
        (window as any).renderSidebar(tasks, [project]);
        const list = document.getElementById('project-list');
        expect(list?.textContent).toContain('My Project');
        expect(list?.textContent).toContain('Project Task');
    });
});
