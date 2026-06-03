// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { createCard, createCardMessageElement } from '../cardBuilder';



describe('createCardMessageElement', () => {
    it('creates agent message wrapper', () => {
        const el = createCardMessageElement('task_1');
        expect(el.className).toBe('chat-msg agent');
        expect(el.querySelector('.msg-sender')).toBeNull();
        const bubble = el.querySelector('.msg-bubble.card-bubble') as HTMLElement;
        expect(bubble).toBeTruthy();
        expect(bubble.dataset.taskId).toBe('task_1');
    });

    it('works without taskId', () => {
        const el = createCardMessageElement();
        const bubble = el.querySelector('.msg-bubble') as HTMLElement;
        expect(bubble.dataset.taskId).toBeUndefined();
    });
});

describe('createCard', () => {
    function basicDom() {
        document.body.innerHTML = '<div id="root"></div>';
    }

    it('renders header and body', () => {
        const card = createCard({
            headerHtml: '测试标题',
            bodyHtml: '<p>内容</p>',
        });
        expect(card.className).toBe('msg-card');
        expect(card.querySelector('.msg-card-header-text')?.innerHTML).toBe('测试标题');
        expect(card.querySelector('.msg-card-body')?.innerHTML).toBe('<p>内容</p>');
    });

    it('renders markdown body', () => {
        const card = createCard({
            headerHtml: '标题',
            bodyMarkdown: '**bold** text',
        });
        expect(card.querySelector('.msg-card-body')?.innerHTML).toContain('<strong>bold</strong>');
    });

    it('starts collapsed when defaultCollapsed is true', () => {
        const card = createCard({
            headerHtml: '标题',
            bodyHtml: '<p>内容</p>',
            defaultCollapsed: true,
        });
        expect(card.querySelector('.msg-card-body')?.className).toContain('collapsed');
        expect(card.querySelector('.msg-card-toggle')?.className).toContain('collapsed');
        expect(card.querySelector('.msg-card-header')?.getAttribute('aria-expanded')).toBe('false');
    });

    it('starts expanded when defaultCollapsed is false', () => {
        const card = createCard({
            headerHtml: '标题',
            bodyHtml: '<p>内容</p>',
            defaultCollapsed: false,
        });
        expect(card.querySelector('.msg-card-body')?.className).not.toContain('collapsed');
        expect(card.querySelector('.msg-card-header')?.getAttribute('aria-expanded')).toBe('true');
    });

    it('toggle click collapses and expands body', () => {
        const card = createCard({
            headerHtml: '标题',
            bodyHtml: '<p>内容</p>',
        });
        const header = card.querySelector('.msg-card-header')!;
        const body = card.querySelector('.msg-card-body')!;

        header.dispatchEvent(new MouseEvent('click'));
        expect(body.className).toContain('collapsed');

        header.dispatchEvent(new MouseEvent('click'));
        expect(body.className).not.toContain('collapsed');
    });

    it('renders actions as buttons', () => {
        const fn = vi.fn();
        const card = createCard({
            headerHtml: '标题',
            bodyHtml: '<p>内容</p>',
            actions: [{ text: '确认', className: 'primary', onClick: fn }],
        });
        const actionsDiv = card.querySelector('.msg-card-actions')!;
        expect(actionsDiv).toBeTruthy();
        const btn = actionsDiv.querySelector('.msg-card-btn.primary') as HTMLElement;
        expect(btn).toBeTruthy();
        expect(btn.textContent).toBe('确认');

        btn.click();
        expect(fn).toHaveBeenCalledOnce();
    });

    it('rawData adds copy button to header', () => {
        const card = createCard({
            headerHtml: '标题',
            bodyHtml: '<p>内容</p>',
            rawData: { key: 'value' },
        });
        const copyBtn = card.querySelector('.card-copy-raw-btn');
        expect(copyBtn).toBeTruthy();
    });

    it('copyable adds svg copy button', () => {
        const card = createCard({
            headerHtml: '标题',
            bodyHtml: '<p>内容</p>',
            copyable: true,
        });
        const copyBtn = card.querySelector('.card-copy-btn');
        expect(copyBtn).toBeTruthy();
        expect(copyBtn?.querySelector('svg')).toBeTruthy();
    });

    it('applies borderColor, headerBg, headerColor', () => {
        const card = createCard({
            headerHtml: '标题',
            bodyHtml: '<p>内容</p>',
            borderColor: '#ffff00',
            headerBg: '#111111',
            headerColor: '#eeeeee',
        });
        expect(card.style.borderColor).toBe('rgb(255, 255, 0)');
        const header = card.querySelector('.msg-card-header') as HTMLElement;
        expect(header.style.background).toBe('rgb(17, 17, 17)');
        expect(header.style.color).toBe('rgb(238, 238, 238)');
    });

    it('calls onExpand callback when toggled', () => {
        const onExpand = vi.fn();
        const card = createCard({
            headerHtml: '标题',
            bodyHtml: '<p>内容</p>',
            onExpand,
        });
        const header = card.querySelector('.msg-card-header')!;
        header.dispatchEvent(new MouseEvent('click'));
        expect(onExpand).toHaveBeenCalledWith(false);

        header.dispatchEvent(new MouseEvent('click'));
        expect(onExpand).toHaveBeenCalledWith(true);
    });

    it('click on action button does not toggle card', () => {
        const fn = vi.fn();
        const card = createCard({
            headerHtml: '标题',
            bodyHtml: '<p>内容</p>',
            actions: [{ text: '按钮', className: 'primary', onClick: fn }],
        });
        const body = card.querySelector('.msg-card-body')!;
        expect(body.className).not.toContain('collapsed');

        const btn = card.querySelector('.msg-card-btn')!;
        btn.dispatchEvent(new MouseEvent('click'));
        expect(body.className).not.toContain('collapsed');
        expect(fn).toHaveBeenCalledOnce();
    });
});
