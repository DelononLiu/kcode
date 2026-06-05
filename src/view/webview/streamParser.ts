/**
 * streamParser.ts — 前端流式行级解析器
 *
 * 职责：
 *   将 Agent 输出的原始文本行，实时分类为「信号」与「噪声」，
 *   提取文件资产、测试资产，让 UI 层做减法渲染。
 *
 * 使用方式：
 *   const result = parseLine(textLine);
 *   if (result.type === 'thinking') { /* 进 marquee *\/ }
 */

// ──────────── 文件资产 ────────────

export type FileOpStatus = 'reading' | 'edited' | 'deleted';

export interface FileAsset {
  path: string;
  status: FileOpStatus;
  mentions: number;
}

/** 前端文件资产表 — key=文件路径 */
export const fileMap = new Map<string, FileAsset>();

export function resetFileMap(): void {
  fileMap.clear();
}

function updateFile(path: string, status: FileOpStatus): void {
  const existing = fileMap.get(path);
  if (existing) {
    existing.status = status;
    existing.mentions++;
  } else {
    fileMap.set(path, { path, status, mentions: 1 });
  }
}

/** 提取文件路径：支持绝对路径 /a/b/c.ts 或相对路径 src/a.ts */
const FILE_PATH_RE = /((?:\/[^\s:])|(?:src\/[\w.\-/]+))\b/;

// ──────────── 测试资产 ────────────

export interface TestStatus {
  file: string;
  pass: boolean;
  total?: number;
  failed?: number;
}

/** 当前测试状态 */
export const testStatus: TestStatus = { file: '', pass: true };

export function resetTestStatus(): void {
  testStatus.file = '';
  testStatus.pass = true;
  testStatus.total = undefined;
  testStatus.failed = undefined;
}

// ──────────── 行类型判定 ────────────

export type LineType =
  | 'thinking'      // AI 思考过程（The user wants me to...）
  | 'terminal'      // 终端探测命令（ls / find / grep）
  | 'file_op'       // 文件读取/编辑/删除
  | 'test_output'   // 测试结果
  | 'normal';       // 普通正文

export interface ParseResult {
  type: LineType;
  /** 提取到的文件路径（file_op 时有效） */
  filePath?: string;
  /** 纯净文本（去掉前缀标记） */
  text: string;
}

// ──────────── 正则集 ────────────

/** 思考过程标记 */
const THINKING_RE = /^(The user wants me to|I need to|Let me|First,|Let's|I'll|I should|My plan|I'm thinking|让我|我需要|首先|我先|我想)/i;

/** 终端探测命令 */
const TERMINAL_PROBE_RE = /^(ls\b|find\b|grep\b|which\b|cat\b|head\b|tail\b|pwd\b|cd\b|mkdir\b|touch\b|npx\s+tsc\b|npx\s+eslint|npm\s+(run|test|install)\b)/i;

/** 文件操作 */
const FILE_READ_RE = /(?:Read(?:ing)?\s+(?:file\s+)?(?:`?)((?:\/[^\s:])|(?:src\/[\w.\-/]+)))/i;
const FILE_EDIT_RE = /(?:Edit(?:ed)?\s+(?:(src\/[\w.\-/]+)))/i;
const FILE_WRITE_RE = /(?:Writ(?:e|ing)\s+(?:(src\/[\w.\-/]+)))/i;
const FILE_RM_RE = /rm\s+(-rf\s+)?((?:\/[^\s:])|(?:src\/[\w.\-/]+))/;

/** 测试输出 */
const TEST_FAIL_RE = /FAIL\s+([\w.\-/]+\.test\.[a-z]+)/;
const TEST_PASS_RE = /PASS\s+([\w.\-/]+\.test\.[a-z]+)/;
const TEST_SUMMARY_RE = /Tests:\s*(\d+)\s+passed.*?(\d+)\s+failed/;

// ──────────── 导出解析函数 ────────────

export function parseLine(line: string): ParseResult {
  const trimmed = line.trim();
  if (!trimmed) return { type: 'normal', text: trimmed };

  // 1. 测试输出（优先匹配，因为包含 FAIL/PASS 关键词）
  let m: RegExpExecArray | null;

  const summaryMatch = TEST_SUMMARY_RE.exec(trimmed);
  if (summaryMatch) {
    const total = parseInt(summaryMatch[1], 10);
    const failed = parseInt(summaryMatch[2], 10);
    testStatus.total = total;
    testStatus.failed = failed;
    testStatus.pass = failed === 0;
    return { type: 'test_output', text: `Tests: ${total} passed, ${failed} failed` };
  }

  m = TEST_FAIL_RE.exec(trimmed);
  if (m) {
    testStatus.file = m[1];
    testStatus.pass = false;
    return { type: 'test_output', text: `FAIL ${m[1]}` };
  }

  m = TEST_PASS_RE.exec(trimmed);
  if (m) {
    testStatus.file = m[1];
    // pass stays true unless a FAIL already hit
    return { type: 'test_output', text: `PASS ${m[1]}` };
  }

  // 2. 文件操作
  m = FILE_READ_RE.exec(trimmed);
  if (m) {
    const path = m[1];
    updateFile(path, 'reading');
    return { type: 'file_op', filePath: path, text: `📖 ${path}` };
  }

  m = FILE_EDIT_RE.exec(trimmed);
  if (m) {
    const path = m[1];
    updateFile(path, 'edited');
    return { type: 'file_op', filePath: path, text: `✏️ ${path}` };
  }

  m = FILE_WRITE_RE.exec(trimmed);
  if (m) {
    const path = m[1];
    updateFile(path, 'edited');
    return { type: 'file_op', filePath: path, text: `✏️ ${path}` };
  }

  m = FILE_RM_RE.exec(trimmed);
  if (m) {
    const path = m[2];
    updateFile(path, 'deleted');
    return { type: 'file_op', filePath: path, text: `🗑️ ${path}` };
  }

  // 3. 思考过程
  if (THINKING_RE.test(trimmed)) {
    return { type: 'thinking', text: trimmed };
  }

  // 4. 终端探测
  if (TERMINAL_PROBE_RE.test(trimmed)) {
    return { type: 'terminal', text: trimmed };
  }

  // 5. 其他
  return { type: 'normal', text: trimmed };
}

/** 获取 fileMap 的摘要文本（用于 UI 展示） */
export function getFileSummaryText(): string {
  const entries = Array.from(fileMap.values());
  if (entries.length === 0) return '';
  const reading = entries.filter(e => e.status === 'reading').length;
  const edited = entries.filter(e => e.status === 'edited').length;
  const deleted = entries.filter(e => e.status === 'deleted').length;
  const parts: string[] = [];
  if (reading) parts.push(`📖 ${reading}`);
  if (edited) parts.push(`✏️ ${edited}`);
  if (deleted) parts.push(`🗑️ ${deleted}`);
  return `📄 ${entries.length} 个文件 (${parts.join(' ')})`;
}

/** 获取测试摘要文本 */
export function getTestSummaryText(): string {
  if (!testStatus.file && testStatus.total === undefined) return '';
  if (testStatus.total !== undefined) {
    return testStatus.pass
      ? `✅ ${testStatus.total} passed`
      : `❌ ${testStatus.failed} failed / ${testStatus.total}`;
  }
  return testStatus.pass ? `✅ ${testStatus.file}` : `❌ ${testStatus.file}`;
}
