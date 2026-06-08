/** 每个任务类型可按阶段自定义提示词，非必填，缺哪个阶段就用通用 prompt */
export interface TypePhasePrompts {
  goal?: string;
  plan?: string;
  execute?: string;
  self_verify?: string;
  review?: string;
}

/**
 * 类型提示词注册表
 * key = category（如 requirement_dev / problem_analysis）
 * value = 各阶段自定义提示词片段，附加在通用阶段 prompt 之后
 */
const registry = new Map<string, TypePhasePrompts>();

export function registerTypePrompt(category: string, prompts: TypePhasePrompts): void {
  registry.set(category, prompts);
}

export function getTypePrompt(category: string): TypePhasePrompts | undefined {
  return registry.get(category);
}

export function getAllRegisteredTypes(): string[] {
  return Array.from(registry.keys());
}

// ──── 注册分析类任务专属提示词 ────

import { PROBLEM_ANALYSIS_PROMPTS } from './problem_analysis';
import { DEFECT_ANALYSIS_PROMPTS } from './defect_analysis';
import { LOG_ANALYSIS_PROMPTS } from './log_analysis';

registerTypePrompt('problem_analysis', PROBLEM_ANALYSIS_PROMPTS);
registerTypePrompt('defect_analysis', DEFECT_ANALYSIS_PROMPTS);
registerTypePrompt('log_analysis', LOG_ANALYSIS_PROMPTS);
