import { G } from './state';
import { escapeHtml } from './messageRenderer';
import { getChatMessages, getChatScroll } from './domContainers';

export function getCategoryDef(catKey: string): any {
    return G.categoryDefs.find((c: any) => c.key === catKey);
}

export function renderCategorySelection() {
    const container = getChatMessages();
    if (!container) return;
    const scrollContainer = getChatScroll();
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

    const selectorChanged = () => {
        G.selectedCategory = selCat.value || null;
        renderCategorySelection();
    };
    selCat.addEventListener('change', selectorChanged);

    container.appendChild(wrapper);

    if (!G.selectedCategory) return;

    const cat = getCategoryDef(G.selectedCategory);
    if (!cat) return;

    const form = document.createElement('div');
    form.className = 'template-form';

    const templateDesc = document.createElement('div');
    templateDesc.className = 'template-flow-desc';
    templateDesc.textContent = cat.inputPlaceholder || '';
    form.appendChild(templateDesc);

    const formFields: Record<string, string> = {};

    for (const field of (cat.inputFields || [])) {
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
        startTaskFromForm(cat, formFields, notesInput.value);
    });

    btnRow.appendChild(startBtn);
    container.appendChild(btnRow);
}

export function startTaskFromForm(cat: any, formFields: Record<string, string>, notes: string) {
    const parts: string[] = [];
    for (const field of (cat.inputFields || [])) {
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
    });

    G.selectedCategory = null;

    const input = document.getElementById('chat-input') as HTMLTextAreaElement;
    if (input) input.placeholder = '提出后续修改要求';
}

export function initTemplateChips() {
    const bar = document.getElementById('input-template-bar');
    if (!bar) return;
    bar.innerHTML = '';
}

export function focusChatInput() {
    const el = document.getElementById('chat-input') as HTMLTextAreaElement;
    if (el) el.focus();
}
