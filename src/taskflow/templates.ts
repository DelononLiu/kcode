import type { CategoryDef, TaskCategory } from '../types';

const CATEGORIES: Record<TaskCategory, CategoryDef> = {
    requirement_dev: {
        key: 'requirement_dev',
        label: '需求开发',
        icon: '🧩',
        inputPlaceholder: '描述需要开发的功能...',
        inputFields: [
            { key: 'functionDesc', label: '功能描述', type: 'textarea', placeholder: '描述需要开发的功能、使用场景和预期行为', required: true },
            { key: 'acceptanceStandard', label: '验收标准', type: 'textarea', placeholder: '功能完成后的验收标准', required: false },
            { key: 'referenceInfo', label: '参考资料', type: 'textarea', placeholder: '相关文档、设计稿、竞品参考等', required: false },
        ],
        analysisFramework: '请遵循需求分析流程：先理解需求背景和业务价值，明确功能范围和边界；分析影响面，考虑对现有模块的兼容性；设计实现方案时评估可扩展性和可维护性；输出完整实现代码并补充必要的测试。',
        executionHints: ['先理清现有相关代码结构，再开始实现', '保持代码风格与项目现有代码一致'],
        acceptanceCriteria: ['功能符合需求描述', '边界情况已处理', '已有功能不受影响', '代码风格与项目一致'],
    },
    problem_analysis: {
        key: 'problem_analysis',
        label: '问题分析',
        icon: '🔍',
        inputPlaceholder: '描述 bug 或异常现象...',
        inputFields: [
            { key: 'errorInfo', label: '报错信息', type: 'textarea', placeholder: '完整的错误堆栈或异常信息', required: true },
            { key: 'reproSteps', label: '复现步骤', type: 'textarea', placeholder: '复现问题的详细步骤', required: true },
            { key: 'relatedCode', label: '相关代码', type: 'textarea', placeholder: '报错位置的代码片段', required: false },
            { key: 'environment', label: '运行环境', type: 'input', placeholder: 'OS / 运行时版本 / 浏览器 / 设备等', required: false },
        ],
        analysisFramework: '请遵循问题诊断框架：收集完整的错误上下文（堆栈/日志/环境），提出根因假设并逐一排除，定位到最小可复现范围，输出修复方案并说明根因。',
        executionHints: ['先最小化复现问题，确认根因后再修改', '修改后验证边界情况是否引入新问题'],
        acceptanceCriteria: ['问题已修复不再复现', '根因已定位并明确说明', '回归测试通过无新增问题'],
    },
    code_review: {
        key: 'code_review',
        label: '代码评审',
        icon: '👁️',
        inputPlaceholder: '提供需要评审的代码或 PR 链接...',
        inputFields: [
            { key: 'codeScope', label: '审查范围', type: 'textarea', placeholder: '需要审查的代码文件、函数或 PR 链接', required: true },
            { key: 'bizContext', label: '业务上下文', type: 'textarea', placeholder: '业务场景、输入输出预期', required: false },
        ],
        analysisFramework: '请遵循代码评审框架：从正确性、性能、安全、可维护性、可测试性五个维度逐项检查；关注边界条件和异常处理；指出具体问题所在行和修改建议，优先阻断性问题。',
        executionHints: ['评审前先理解代码的整体功能和上下文', '区分阻断性问题和非阻断性建议', '每条评审意见附带具体代码位置和修改建议'],
        acceptanceCriteria: ['所有阻断性问题已定位', '性能/安全风险已评估', '改进建议具体可行'],
        // @ts-ignore 过渡字段，Iteration 2 清理
        flowOverride: ['goal', 'review'],
    },
    log_analysis: {
        key: 'log_analysis',
        label: '日志分析',
        icon: '📋',
        inputPlaceholder: '粘贴日志内容或描述日志异常...',
        inputFields: [
            { key: 'logContent', label: '日志内容', type: 'textarea', placeholder: '服务报错日志或异常日志片段', required: true },
            { key: 'serviceName', label: '服务名称', type: 'input', placeholder: '如 user-service / api-gateway', required: true },
            { key: 'timeRange', label: '时间范围', type: 'input', placeholder: '如 2026-06-05 10:00 ~ 10:30', required: false },
        ],
        analysisFramework: '请遵循日志分析框架：先收集完整日志上下文，识别异常模式和时间规律；关联上下游日志追踪调用链路；区分根因和表象，定位故障源头；输出根因结论和修复建议。',
        executionHints: ['关注 ERROR 级别以上的日志条目', '分析日志的时间序列和周期性规律', '关联同一 traceId 的上下游日志'],
        acceptanceCriteria: ['异常根因已定位', '修复方案已输出', '日常值班排查效率已优化'],
    },
    defect_analysis: {
        key: 'defect_analysis',
        label: '缺陷分析',
        icon: '🔍',
        inputPlaceholder: '描述缺陷现象...',
        inputFields: [
            { key: 'defectDesc', label: '缺陷描述', type: 'textarea', placeholder: '缺陷的具体表现和触发条件', required: true },
            { key: 'relatedCode', label: '相关代码', type: 'textarea', placeholder: '怀疑有问题的代码片段或模块', required: true },
            { key: 'expectedBehavior', label: '期望行为', type: 'textarea', placeholder: '正确的行为应该是什么', required: true },
        ],
        analysisFramework: '请遵循缺陷分析框架：先理解缺陷的表现和触发条件，追溯全链路确认根因，评估影响范围和修复风险，输出修复方案并补充回归测试。',
        executionHints: ['确认缺陷可稳定复现后再分析根因', '区分表象和根因，避免只修表象不修根因'],
        acceptanceCriteria: ['缺陷根因已明确定位', '修复后缺陷不再复现', '回归测试通过', '影响面已评估'],
    },
};

export function getCategories(): CategoryDef[] {
    return Object.values(CATEGORIES);
}

export function getCategory(key: TaskCategory): CategoryDef | undefined {
    return CATEGORIES[key];
}
