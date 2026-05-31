import { G } from './state';
import { escapeHtml } from './messageRenderer';

export function getCategoryDef(catKey: string): any {
    return G.categoryDefs.find((c: any) => c.key === catKey);
}

export function getTemplateDef(catKey: string, subKey: string): any {
    const cat = getCategoryDef(catKey);
    return cat?.subTypes?.[subKey];
}

export function renderCategorySelection() {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    const scrollContainer = document.getElementById('chat-scroll');
    if (scrollContainer) scrollContainer.classList.remove('chat-empty');
    container.innerHTML = '';
    const chatHeader = document.getElementById('chat-header');
    if (chatHeader) chatHeader.style.display = 'none';
    document.getElementById('chat-body')?.classList.add('showing-categories');

    const wrapper = document.createElement('div');
    wrapper.className = 'template-flow-wrapper';

    const titleLine = document.createElement('div');
    titleLine.className = 'template-flow-title';
    titleLine.textContent = '📋 按模板新建任务';
    wrapper.appendChild(titleLine);

    const selCat = document.createElement('select');
    selCat.className = 'template-flow-select';
    const opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = '— 选择任务大类 —';
    opt0.disabled = true;
    selCat.appendChild(opt0);
    for (const cat of G.categoryDefs) {
        const opt = document.createElement('option');
        opt.value = cat.key;
        opt.textContent = `${cat.icon} ${cat.label}`;
        selCat.appendChild(opt);
    }
    if (G.selectedCategory) selCat.value = G.selectedCategory;
    wrapper.appendChild(selCat);

    const selSub = document.createElement('select');
    selSub.className = 'template-flow-select';
    const subOpt0 = document.createElement('option');
    subOpt0.value = '';
    subOpt0.textContent = G.selectedCategory ? '— 选择任务子类 —' : '— 请先选择大类 —';
    subOpt0.disabled = true;
    selSub.appendChild(subOpt0);
    if (G.selectedCategory) {
        selSub.disabled = false;
        for (const [key, st] of Object.entries(getCategoryDef(G.selectedCategory)?.subTypes || {})) {
            const t = st as any;
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = `${t.icon} ${t.label}`;
            selSub.appendChild(opt);
        }
        if (G.selectedSubType) selSub.value = G.selectedSubType;
    } else {
        selSub.disabled = true;
    }
    wrapper.appendChild(selSub);

    const selectorChanged = () => {
        G.selectedCategory = selCat.value || null;
        G.selectedSubType = selSub.value || null;
        renderCategorySelection();
    };
    selCat.addEventListener('change', () => {
        G.selectedSubType = null;
        selSub.value = '';
        selectorChanged();
    });
    selSub.addEventListener('change', selectorChanged);

    container.appendChild(wrapper);

    if (!G.selectedCategory || !G.selectedSubType) return;

    const cat = getCategoryDef(G.selectedCategory);
    const template = cat?.subTypes?.[G.selectedSubType];
    if (!template) return;

    const form = document.createElement('div');
    form.className = 'template-form';

    const templateDesc = document.createElement('div');
    templateDesc.className = 'template-flow-desc';
    templateDesc.textContent = template.inputPlaceholder || '';
    form.appendChild(templateDesc);

    const formFields: Record<string, string> = {};

    for (const field of (template.inputFields || [])) {
        const fieldGroup = document.createElement('div');
        fieldGroup.className = 'form-field-group';

        const label = document.createElement('label');
        label.className = 'form-field-label';
        label.textContent = field.label;
        if (field.required) {
            const req = document.createElement('span');
            req.className = 'form-field-required';
            req.textContent = ' *';
            label.appendChild(req);
        }
        fieldGroup.appendChild(label);

        let input: HTMLInputElement | HTMLTextAreaElement;
        if (field.type === 'textarea') {
            input = document.createElement('textarea');
            input.className = 'form-field-textarea';
            input.rows = 3;
        } else {
            input = document.createElement('input');
            input.className = 'form-field-input';
            input.type = 'text';
        }
        input.placeholder = field.placeholder;
        input.dataset.fieldKey = field.key;
        input.addEventListener('input', () => {
            formFields[field.key] = input.value;
        });

        fieldGroup.appendChild(input);
        form.appendChild(fieldGroup);
    }

    const notesField = document.createElement('div');
    notesField.className = 'form-field-group';
    const notesLabel = document.createElement('label');
    notesLabel.className = 'form-field-label';
    notesLabel.textContent = '补充说明（可选）';
    notesField.appendChild(notesLabel);
    const notesInput = document.createElement('textarea');
    notesInput.className = 'form-field-textarea';
    notesInput.rows = 2;
    notesInput.placeholder = '额外的说明和上下文...';
    notesField.appendChild(notesInput);
    form.appendChild(notesField);

    container.appendChild(form);

    const btnRow = document.createElement('div');
    btnRow.className = 'form-btn-row';

    const startBtn = document.createElement('button');
    startBtn.className = 'start-task-btn';
    startBtn.textContent = '开始任务';
    startBtn.addEventListener('click', () => {
        startTaskFromForm(template, formFields, notesInput.value);
    });

    btnRow.appendChild(startBtn);
    container.appendChild(btnRow);
}

export function startTaskFromForm(template: any, formFields: Record<string, string>, notes: string) {
    const parts: string[] = [];
    for (const field of (template.inputFields || [])) {
        const val = formFields[field.key] || '';
        if (val.trim()) {
            parts.push(`${field.label}：${val.trim()}`);
        }
    }
    if (notes.trim()) {
        parts.push(`补充说明：${notes.trim()}`);
    }
    const text = parts.join('\n\n');

    G.vscode.postMessage({
        type: 'sendMessage',
        text,
        taskId: G.activeTaskId,
        category: G.selectedCategory,
        subType: G.selectedSubType
    });

    G.selectedCategory = null;
    G.selectedSubType = null;

    const input = document.getElementById('chat-input') as HTMLTextAreaElement;
    if (input) input.placeholder = '提出后续修改要求';
}

export function initTemplateChips() {
    const bar = document.getElementById('input-template-bar');
    if (!bar || !G.categoryDefs || G.categoryDefs.length === 0) return;
    bar.innerHTML = '';
    const importChip = document.createElement('span');
    importChip.className = 'template-chip import-chip';
    importChip.innerHTML = '<span class="tmpl-icon">⤓</span> 导入任务';
    importChip.addEventListener('click', () => {
        G.selectedCategory = null;
        bar.querySelectorAll('.template-chip').forEach(c => c.classList.remove('active'));
        G.vscode.postMessage({ type: 'importGitHubIssue' });
    });
    bar.appendChild(importChip);
    const sep = document.createElement('span');
    sep.className = 'template-chip-sep';
    sep.textContent = '|';
    bar.appendChild(sep);
    for (const cat of G.categoryDefs) {
        const chip = document.createElement('span');
        chip.className = 'template-chip' + (G.selectedCategory === cat.key ? ' active' : '');
        chip.innerHTML = `<span class="tmpl-icon">${cat.icon}</span> ${cat.label}`;
        chip.addEventListener('click', () => {
            if (G.selectedCategory === cat.key) {
                G.selectedCategory = null;
                bar.querySelectorAll('.template-chip').forEach(c => c.classList.remove('active'));
            } else {
                G.selectedCategory = cat.key;
                G.selectedSubType = null;
                bar.querySelectorAll('.template-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
            }
        });
        bar.appendChild(chip);
    }
}

export function focusChatInput() {
    const el = document.getElementById('chat-input') as HTMLTextAreaElement;
    if (el) el.focus();
}
