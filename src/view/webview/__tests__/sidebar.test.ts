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

    it('empty state renders unassigned section header', () => {
        (window as any).renderSidebar([], []);
        const el = document.getElementById('project-list');
        expect(el?.textContent).toContain('未分类任务');
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

    describe('DOM structure', () => {
        it('task item has correct CSS classes and data attributes', () => {
            const tasks = [
                { id: 't1', title: 'Task One', status: 'active', phase: 'execute', archived: false },
                { id: 't2', title: 'Task Two', status: 'completed', phase: 'review', archived: false },
                { id: 't3', title: 'Task Three', status: 'pending', phase: 'demand', archived: false },
            ];
            (window as any).renderSidebar(tasks, []);
            const items = document.querySelectorAll('.task-item');
            expect(items.length).toBe(3);
            items.forEach((item, i) => {
                expect((item as HTMLElement).dataset.taskId).toBe(tasks[i].id);
                expect((item as HTMLElement).draggable).toBe(true);
                expect(item.querySelector('.task-title')?.textContent).toBe(tasks[i].title);
            });
        });

        it('active task gets .active class', () => {
            const tasks = [
                { id: 't1', title: 'Task One', status: 'active', phase: 'execute', archived: false },
                { id: 't2', title: 'Task Two', status: 'completed', phase: 'review', archived: false },
            ];
            (window as any).renderSidebar(tasks, [], 't1');
            const items = document.querySelectorAll('.task-item');
            expect(items[0].classList.contains('active')).toBe(true);
            expect(items[1].classList.contains('active')).toBe(false);
        });

        it('status completed shows checkmark, active shows phase letter', () => {
            const tasks = [
                { id: 't1', title: 'Done', status: 'completed', phase: 'review', archived: false },
                { id: 't2', title: 'Running', status: 'active', phase: 'execute', archived: false },
                { id: 't3', title: 'Cancelled', status: 'cancelled', phase: 'execute', archived: false },
                { id: 't4', title: 'Pending Review', status: 'in_review', phase: 'review', archived: false },
                { id: 't5', title: 'Waiting', status: 'pending', phase: 'demand', archived: false },
            ];
            (window as any).renderSidebar(tasks, []);
            // completed → checkmark
            expect(document.querySelector('.s-completed')?.textContent).toBe('\u2713');
            // active → phase letter (E for execute)
            expect(document.querySelector('.s-active')?.textContent).toBe('E');
            // cancelled → X
            expect(document.querySelector('.s-cancelled')?.textContent).toBe('\u2715');
            // in_review → hourglass
            expect(document.querySelector('.s-waiting')?.textContent).toBe('\u23F3');
            // pending → no status indicator
            expect(document.querySelectorAll('.task-item')[4].querySelector('.task-status-icon')).toBeNull();
        });

        it('unassigned section has proper structure with project-section > project-header > project-name', () => {
            (window as any).renderSidebar([], []);
            const section = document.querySelector('.project-section');
            expect(section).not.toBeNull();
            const header = section!.querySelector('.project-header');
            expect(header).not.toBeNull();
            const name = header!.querySelector('.project-name');
            expect(name?.textContent).toContain('未分类任务');
            const arrow = header!.querySelector('.arrow');
            expect(arrow).not.toBeNull();
        });
    });
});
