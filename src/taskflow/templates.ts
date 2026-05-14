import type { CategoryDef, TaskCategory, TaskTemplate } from '../types';

const CATEGORIES: Record<TaskCategory, CategoryDef> = {
    requirement_dev: {
        key: 'requirement_dev',
        label: '需求开发',
        icon: '🧩',
        analysisFramework: '请遵循需求分析流程：先理解需求背景和业务价值，明确功能范围和边界；分析影响面，考虑对现有模块的兼容性；设计实现方案时评估可扩展性和可维护性；输出完整实现代码并补充必要的测试。',
        executionHints: ['先理清现有相关代码结构，再开始实现', '保持代码风格与项目现有代码一致'],
        acceptanceCriteria: ['功能符合需求描述', '边界情况已处理', '已有功能不受影响', '代码风格与项目一致'],
        subTypes: {
            feature_dev: {
                label: '新增功能开发',
                icon: '✨',
                inputPlaceholder: '描述需要开发的功能...',
                inputFields: [
                    { key: 'functionDesc', label: '功能描述', type: 'textarea', placeholder: '描述需要开发的功能、使用场景和预期行为', required: true },
                    { key: 'acceptanceStandard', label: '验收标准', type: 'textarea', placeholder: '功能完成后的验收标准', required: false },
                    { key: 'referenceInfo', label: '参考资料', type: 'textarea', placeholder: '相关文档、设计稿、竞品参考等', required: false },
                ],
                analysisFramework: '请遵循需求分析框架：1) 先理解需求背景和业务价值，明确功能范围和边界 2) 分析影响面，考虑对现有模块的兼容性 3) 设计实现方案时评估可扩展性和可维护性 4) 输出完整实现代码并补充必要的单元测试',
                executionHints: [
                    '先理清现有相关代码结构，再开始实现',
                    '保持代码风格与项目现有代码一致',
                    '补充必要的注释和类型定义',
                ],
                acceptanceCriteria: [
                    '功能符合需求描述',
                    '边界情况已处理（空值、异常输入等）',
                    '已有功能不受影响',
                    '代码风格与项目一致',
                ],
            },
            api_dev: {
                label: '接口开发',
                icon: '🔌',
                inputPlaceholder: '描述需要开发的接口...',
                inputFields: [
                    { key: 'apiPath', label: '接口路径', type: 'input', placeholder: '如 /api/v1/users', required: true },
                    { key: 'method', label: '请求方法', type: 'input', placeholder: 'GET / POST / PUT / DELETE', required: true },
                    { key: 'requestParams', label: '请求参数', type: 'textarea', placeholder: '参数名、类型、是否必填、说明', required: false },
                    { key: 'responseFormat', label: '返回格式', type: 'textarea', placeholder: '成功/失败响应的数据结构', required: false },
                ],
                analysisFramework: '请遵循接口开发规范：1) 遵循 RESTful 设计原则，URL 命名符合资源语义 2) 统一请求/响应格式，遵循项目已有的接口规范 3) 考虑鉴权、参数校验、错误码定义 4) 补充接口文档',
                executionHints: [
                    '先定义接口契约（请求/响应结构），再实现逻辑',
                    '统一错误码和错误消息格式',
                    '考虑接口的幂等性和并发安全',
                ],
                acceptanceCriteria: [
                    '接口路径和方法符合规范',
                    '请求参数校验完整',
                    '响应格式统一',
                    '错误码覆盖异常场景',
                    '接口文档已补充',
                ],
            },
            ui_component: {
                label: '页面/组件开发',
                icon: '🖥️',
                inputPlaceholder: '描述需要开发的页面或组件...',
                inputFields: [
                    { key: 'componentName', label: '页面/组件名', type: 'input', placeholder: '如 UserProfilePanel', required: true },
                    { key: 'functionDesc', label: '功能描述', type: 'textarea', placeholder: '页面/组件的功能和行为', required: true },
                    { key: 'referenceDesign', label: '设计稿/参考', type: 'textarea', placeholder: '设计稿链接、参考页面、布局说明等', required: false },
                ],
                analysisFramework: '请遵循前端开发规范：1) 拆解 UI 为可复用组件结构 2) 遵循项目的 UI 设计系统和现有组件模式 3) 考虑加载状态、空状态、错误状态 4) 确保响应式布局和可访问性',
                executionHints: [
                    '复用项目现有 UI 组件和样式变量',
                    '覆盖 loading / empty / error 三种状态',
                    '保持交互一致性和视觉一致性',
                ],
                acceptanceCriteria: [
                    'UI 符合设计规范',
                    '三种状态（加载/空/错误）均已处理',
                    '交互反馈流畅',
                    '代码复用项目现有组件',
                ],
            },
            biz_logic: {
                label: '业务逻辑迭代',
                icon: '🔄',
                inputPlaceholder: '描述需要迭代的业务逻辑...',
                inputFields: [
                    { key: 'bizScenario', label: '业务场景', type: 'textarea', placeholder: '业务场景描述、触发条件、预期结果', required: true },
                    { key: 'changeScope', label: '变更说明', type: 'textarea', placeholder: '需要修改的现有逻辑和执行方案', required: true },
                ],
                analysisFramework: '请遵循业务逻辑迭代规范：1) 先理解现有业务流程和代码逻辑 2) 分析变更影响面，列出所有需要修改的模块 3) 确保数据一致性和事务完整性 4) 补充业务日志便于排查',
                executionHints: [
                    '先理解现有业务流程的全貌，再动手修改',
                    '注意数据迁移和兼容性',
                    '补充关键节点的业务日志',
                ],
                acceptanceCriteria: [
                    '业务逻辑正确',
                    '边界条件和异常流程已处理',
                    '不影响已有业务场景',
                    '关键路径有日志记录',
                ],
            },
            doc_dev: {
                label: '文档补充开发',
                icon: '📝',
                inputPlaceholder: '描述需要补充的文档...',
                inputFields: [
                    { key: 'docScope', label: '文档范围', type: 'textarea', placeholder: '需要覆盖的内容范围和目标读者', required: true },
                    { key: 'docFormat', label: '文档格式', type: 'input', placeholder: 'Markdown / API 文档 / README / 设计文档', required: true },
                ],
                analysisFramework: '请遵循文档编写规范：1) 明确文档的目标读者和使用场景 2) 结构清晰，先总览后细节 3) 代码示例完整可运行 4) 保持与项目现有文档风格一致',
                executionHints: [
                    '先搭文档框架，再填充细节',
                    '代码示例确保可运行',
                    '补充常见问题和排查指引',
                ],
                acceptanceCriteria: [
                    '内容完整覆盖需求范围',
                    '结构清晰，便于查阅',
                    '代码示例可运行',
                    '与现有文档风格一致',
                ],
                flowOverride: ['demand', 'goal', 'execute', 'review'],
            },
        },
    },
    problem_analysis: {
        key: 'problem_analysis',
        label: '问题分析',
        icon: '🔍',
        analysisFramework: '请遵循问题诊断框架：收集完整的错误上下文（堆栈/日志/环境），提出根因假设并逐一排除，定位到最小可复现范围，输出修复方案并说明根因。',
        executionHints: ['先最小化复现问题，确认根因后再修改', '修改后验证边界情况是否引入新问题'],
        acceptanceCriteria: ['问题已修复不再复现', '根因已定位并明确说明', '回归测试通过无新增问题'],
        subTypes: {
            debug: {
                label: '代码 Debug 调试',
                icon: '🐛',
                inputPlaceholder: '描述 bug 现象...',
                inputFields: [
                    { key: 'errorInfo', label: '报错信息', type: 'textarea', placeholder: '完整的错误堆栈或异常信息', required: true },
                    { key: 'reproSteps', label: '复现步骤', type: 'textarea', placeholder: '复现 bug 的详细步骤', required: true },
                    { key: 'relatedCode', label: '相关代码', type: 'textarea', placeholder: '报错位置的代码片段', required: false },
                    { key: 'environment', label: '运行环境', type: 'input', placeholder: 'OS / Node 版本 / 浏览器 / 设备等', required: false },
                ],
                analysisFramework: '请遵循问题诊断框架：1) 收集完整的错误上下文（堆栈、输入、环境） 2) 提出根因假设，逐一验证排除 3) 定位到最小可复现范围 4) 输出修复方案并说明根因',
                executionHints: [
                    '先最小化复现问题，确认根因后再修改',
                    '修改后验证边界情况是否引入新问题',
                    '输出修复说明，方便后续排查',
                ],
                acceptanceCriteria: [
                    'bug 已修复，问题不再复现',
                    '根因已定位并明确说明',
                    '回归测试通过，无新增问题',
                ],
            },
            build_error: {
                label: '编译构建异常',
                icon: '🔨',
                inputPlaceholder: '描述编译/构建报错...',
                inputFields: [
                    { key: 'errorLog', label: '错误日志', type: 'textarea', placeholder: '完整的编译/构建错误输出', required: true },
                    { key: 'buildConfig', label: '构建配置', type: 'textarea', placeholder: 'tsconfig.json / webpack.config / pom.xml 等', required: false },
                    { key: 'environmentInfo', label: '环境信息', type: 'input', placeholder: 'Node 版本 / JDK 版本 / OS 等', required: false },
                ],
                analysisFramework: '请遵循构建诊断框架：1) 从错误日志的根因堆栈开始分析（非表象行） 2) 区分依赖问题、语法问题、配置问题三大类 3) 验证修复后的构建完整性',
                executionHints: [
                    '从错误堆栈的最底部根因往上排查',
                    '注意依赖版本冲突和 peerDependencies',
                    '修复后清理构建缓存再次验证',
                ],
                acceptanceCriteria: [
                    '编译/构建成功通过',
                    '构建产物正常可用',
                    '开发和生产环境均验证通过',
                ],
            },
            log_analysis: {
                label: '服务日志分析',
                icon: '📋',
                inputPlaceholder: '粘贴日志内容或描述日志异常...',
                inputFields: [
                    { key: 'logContent', label: '日志内容', type: 'textarea', placeholder: '服务报错日志或异常日志片段', required: true },
                    { key: 'serviceName', label: '服务名称', type: 'input', placeholder: '如 user-service / api-gateway', required: true },
                    { key: 'timeRange', label: '时间范围', type: 'input', placeholder: '如 2026-05-13 10:00 ~ 10:30', required: false },
                ],
                analysisFramework: '请遵循日志分析框架：1) 识别日志中的异常模式和时间规律 2) 关联上下游日志追踪调用链路 3) 区分根因和表象，定位故障源头 4) 输出根因结论和修复建议',
                executionHints: [
                    '关注 ERROR 级别以上的日志条目',
                    '分析日志的时间序列，看是否存在周期性规律',
                    '关联同一 traceId 的上下游日志',
                ],
                acceptanceCriteria: [
                    '异常根因已定位',
                    '修复方案已输出',
                    '监控告警规则优化建议已提供',
                ],
            },
            env_config: {
                label: '环境配置排查',
                icon: '⚙️',
                inputPlaceholder: '描述环境配置异常...',
                inputFields: [
                    { key: 'configContent', label: '当前配置', type: 'textarea', placeholder: '异常的配置文件内容', required: true },
                    { key: 'abnormalDesc', label: '异常现象', type: 'textarea', placeholder: '配置引发的具体异常表现', required: true },
                    { key: 'referenceConfig', label: '正常参考', type: 'textarea', placeholder: '正常环境或期望的配置值', required: false },
                ],
                analysisFramework: '请遵循配置排查框架：1) 逐项对比配置项与预期值 2) 检查配置引用链是否完整 3) 检查环境变量/密钥/路径等外部依赖 4) 给出修正配置方案',
                executionHints: [
                    '先确认配置文件的加载路径是否正确',
                    '检查环境变量覆盖和优先级',
                    '对比正常环境的配置差异',
                ],
                acceptanceCriteria: [
                    '配置问题已定位并修正',
                    '服务重启后配置生效',
                    '配置文档已同步更新',
                ],
            },
            api_fault: {
                label: '接口链路故障',
                icon: '🌐',
                inputPlaceholder: '描述接口故障现象...',
                inputFields: [
                    { key: 'apiAddress', label: '接口地址', type: 'input', placeholder: '请求的完整 URL', required: true },
                    { key: 'requestData', label: '请求数据', type: 'textarea', placeholder: '请求头、请求体参数', required: true },
                    { key: 'responseData', label: '返回数据', type: 'textarea', placeholder: '实际的返回内容和状态码', required: true },
                    { key: 'traceInfo', label: '链路追踪', type: 'textarea', placeholder: 'traceId、调用链各节点耗时', required: false },
                ],
                analysisFramework: '请遵循链路诊断框架：1) 确认请求是否到达目标服务 2) 逐跳分析调用链各节点的返回和耗时 3) 区分网络层、服务层、数据层故障 4) 定位故障节点并给出修复方案',
                executionHints: [
                    '从客户端请求开始，逐跳排查到数据层',
                    '关注超时设置和重试机制',
                    '检查上下游服务版本兼容性',
                ],
                acceptanceCriteria: [
                    '故障根因已定位',
                    '接口调用恢复正常',
                    '已补充监控和告警',
                ],
            },
        },
    },
    performance_opt: {
        key: 'performance_opt',
        label: '性能优化',
        icon: '⚡',
        analysisFramework: '请遵循性能优化方法论：先量化测量确认瓶颈位置，使用 profiling 分析热点路径，每次只改一处对比验证效果，保证不引入正确性问题和可维护性损失。',
        executionHints: ['优化前先做基准测量量化当前性能', '优先优化最大热点路径', '每次只改一处改完验证效果再改下一处'],
        acceptanceCriteria: ['性能指标达到优化目标', '功能正确性不受影响', '代码可维护性未明显降低'],
        subTypes: {
            perf_code: {
                label: '代码执行性能优化',
                icon: '⚡',
                inputPlaceholder: '描述需要优化的代码...',
                inputFields: [
                    { key: 'targetModule', label: '目标函数/模块', type: 'input', placeholder: '需要优化的具体函数或模块名', required: true },
                    { key: 'currentMetrics', label: '当前性能指标', type: 'textarea', placeholder: '执行耗时、调用频率、数据量级', required: true },
                    { key: 'targetMetrics', label: '优化目标', type: 'input', placeholder: '期望的耗时/吞吐量，如 &lt; 100ms', required: true },
                ],
                analysisFramework: '请遵循性能优化方法论：1) 先量化测量，确认瓶颈是否在目标代码 2) 使用 profiling 工具分析热点路径 3) 每次只改一处，对比验证效果 4) 保证优化不引入正确性问题和可维护性损失',
                executionHints: [
                    '优化前先做基准测量，量化当前性能',
                    '优先优化最大热点路径（二八原则）',
                    '每次只改一处，改完验证效果再改下一处',
                ],
                acceptanceCriteria: [
                    '性能指标达到优化目标',
                    '功能正确性不受影响',
                    '代码可维护性未明显降低',
                ],
            },
            perf_api: {
                label: '接口响应优化',
                icon: '🚀',
                inputPlaceholder: '描述需要优化响应速度的接口...',
                inputFields: [
                    { key: 'apiName', label: '接口名', type: 'input', placeholder: '如 GET /api/v1/orders', required: true },
                    { key: 'currentLatency', label: '当前响应时间', type: 'input', placeholder: '如 P50=200ms P99=2s', required: true },
                    { key: 'targetLatency', label: '目标响应时间', type: 'input', placeholder: '如 P99 &lt; 500ms', required: true },
                    { key: 'qps', label: 'QPS/调用量', type: 'input', placeholder: '如 1000 qps', required: false },
                ],
                analysisFramework: '请遵循接口优化框架：1) 分析耗时分布（网络/序列化/业务逻辑/数据查询） 2) 优先优化占比最大的环节 3) 评估缓存/批量/异步/索引等优化手段 4) 验证优化效果并关注长尾分布',
                executionHints: [
                    '先确认瓶颈在哪个环节（数据库查询 / 外部调用 / 计算逻辑）',
                    '考虑加缓存、批量查询、异步化等手段',
                    '对比优化前后的 P50/P95/P99',
                ],
                acceptanceCriteria: [
                    '接口响应时间达到目标值',
                    '长尾请求显著减少',
                    '高并发下性能稳定',
                ],
            },
            perf_resource: {
                label: '资源加载优化',
                icon: '📦',
                inputPlaceholder: '描述资源加载性能问题...',
                inputFields: [
                    { key: 'resourceList', label: '资源列表', type: 'textarea', placeholder: '需要优化的资源文件列表（JS/CSS/图片等）', required: true },
                    { key: 'loadStrategy', label: '当前加载策略', type: 'textarea', placeholder: '当前的加载方式：同步/异步/懒加载/预加载', required: false },
                    { key: 'perfData', label: '性能数据', type: 'textarea', placeholder: '资源大小、加载时间、LCP/FCP 等指标', required: false },
                ],
                analysisFramework: '请遵循资源优化框架：1) 分析资源加载 waterfall，识别阻塞资源 2) 按优先级分层：关键资源内联/预加载，非关键资源异步/懒加载 3) 评估压缩/代码分割/CDN 等手段',
                executionHints: [
                    '优先优化关键渲染路径上的资源',
                    '大文件考虑拆分为按需加载的 chunk',
                    '评估是否可以使用 CDN 加速',
                ],
                acceptanceCriteria: [
                    '加载时间显著降低',
                    '核心 Web 指标（LCP/FCP）达标',
                    '交互不受影响',
                ],
            },
            perf_memory: {
                label: '内存占用优化',
                icon: '💾',
                inputPlaceholder: '描述内存占用问题...',
                inputFields: [
                    { key: 'targetProcess', label: '目标进程/模块', type: 'input', placeholder: '具体进程或模块名', required: true },
                    { key: 'memoryData', label: '内存使用数据', type: 'textarea', placeholder: '堆内存/栈内存/GC 频率/内存快照分析', required: true },
                    { key: 'runtimeEnv', label: '运行环境', type: 'textarea', placeholder: '运行时长、并发量、数据规模', required: false },
                ],
                analysisFramework: '请遵循内存优化框架：1) 分析内存快照，识别泄露点和过度分配 2) 关注大对象、长生命周期对象、闭包引用 3) 优化数据结构和缓存策略 4) 验证优化后的 GC 行为',
                executionHints: [
                    '使用内存分析工具（如 heap dump）定位泄露',
                    '关注大数组/大对象的创建频率',
                    '检查缓存是否设置了过期策略',
                ],
                acceptanceCriteria: [
                    '内存占用恢复到正常水平',
                    'GC 频率明显降低',
                    '长时间运行无 OOM',
                ],
            },
            perf_arch: {
                label: '架构流程精简优化',
                icon: '🏗️',
                inputPlaceholder: '描述需要优化的架构或流程...',
                inputFields: [
                    { key: 'archDesc', label: '当前架构描述', type: 'textarea', placeholder: '现有架构流程的文字或图表说明', required: true },
                    { key: 'painPoints', label: '痛点/目标', type: 'textarea', placeholder: '当前架构的性能瓶颈或不合理的流程环节', required: true },
                ],
                analysisFramework: '请遵循架构精简框架：1) 梳理完整调用链和数据流，标记冗余环节 2) 评估各层的职责是否清晰合理 3) 识别可合并、简化或去除的中间层 4) 输出精简方案并评估影响面',
                executionHints: [
                    '区分「必要的复杂度」和「偶然的复杂度」',
                    '避免过度设计，优先消除明显的冗余环节',
                    '输出架构对比（优化前 vs 优化后）',
                ],
                acceptanceCriteria: [
                    '调用链路明显简化',
                    '性能有可量化的提升',
                    '不引入新的耦合和风险',
                ],
            },
        },
    },
    defect_analysis: {
        key: 'defect_analysis',
        label: '缺陷分析',
        icon: '🔍',
        analysisFramework: '请遵循缺陷分析框架：先理解缺陷的表现和触发条件，追溯全链路确认根因，评估影响范围和修复风险，输出修复方案并补充回归测试。',
        executionHints: ['确认缺陷可稳定复现后再分析根因', '区分表象和根因，避免只修表象不修根因'],
        acceptanceCriteria: ['缺陷根因已明确定位', '修复后缺陷不再复现', '回归测试通过', '影响面已评估'],
        subTypes: {
            logic_defect: {
                label: '逻辑缺陷分析',
                icon: '🧠',
                inputPlaceholder: '描述逻辑缺陷现象...',
                inputFields: [
                    { key: 'defectDesc', label: '缺陷描述', type: 'textarea', placeholder: '缺陷的具体表现和触发条件', required: true },
                    { key: 'relatedCode', label: '相关代码', type: 'textarea', placeholder: '怀疑有问题的代码片段或模块', required: true },
                    { key: 'expectedBehavior', label: '期望行为', type: 'textarea', placeholder: '正确的行为应该是什么', required: true },
                ],
                analysisFramework: '请遵循逻辑缺陷分析框架：1) 理解涉及的业务规则和代码逻辑 2) 沿代码执行路径追溯，标记判断分支和条件 3) 对比期望行为与实际行为，定位逻辑缺口 4) 修复后补充边界测试用例',
                executionHints: [
                    '画流程图或真值表辅助分析',
                    '注意条件覆盖和分支覆盖的完整性',
                    '修复后补充单元测试防止回归',
                ],
                acceptanceCriteria: [
                    '逻辑缺陷根因已定位',
                    '修复方案覆盖所有触发路径',
                    '边界条件和异常分支已处理',
                ],
            },
            boundary_defect: {
                label: '边界与异常缺陷',
                icon: '🚧',
                inputPlaceholder: '描述边界条件异常...',
                inputFields: [
                    { key: 'scenario', label: '触发场景', type: 'textarea', placeholder: '触发边界异常的具体场景和输入', required: true },
                    { key: 'actualResult', label: '实际结果', type: 'textarea', placeholder: '当前在不正常输入下的行为表现', required: true },
                    { key: 'expectedResult', label: '期望结果', type: 'textarea', placeholder: '正确的边界处理行为', required: false },
                ],
                analysisFramework: '请遵循边界分析框架：1) 梳理输入参数的有效范围、边界值和特殊值 2) 检查空值/零值/极值/越界情况下的处理 3) 评估异常捕获和错误提示的合理性 4) 输出边界值测试用例覆盖',
                executionHints: [
                    '关注输入为空、零、最大、最小、负值等边界',
                    '检查数组越界、除零、类型转换等常见边界异常',
                    '确保错误信息清晰且不泄露内部细节',
                ],
                acceptanceCriteria: [
                    '边界值输入有正确处理',
                    '异常输入不导致系统崩溃',
                    '错误提示信息友好',
                ],
            },
            concurrency_defect: {
                label: '并发与竞态缺陷',
                icon: '⚡',
                inputPlaceholder: '描述并发问题现象...',
                inputFields: [
                    { key: 'defectPhenomenon', label: '缺陷现象', type: 'textarea', placeholder: '并发场景下的异常表现（偶现、特定时序触发等）', required: true },
                    { key: 'affectedModule', label: '影响模块', type: 'input', placeholder: '涉及并发问题的模块或资源', required: true },
                    { key: 'triggerCondition', label: '触发条件', type: 'textarea', placeholder: '特定的并发量、时序或数据状态', required: false },
                ],
                analysisFramework: '请遵循并发分析框架：1) 识别共享资源和临界区 2) 分析读写冲突和原子性缺失 3) 检查锁机制、事务隔离级别或无锁设计 4) 验证修复后的并发正确性和性能',
                executionHints: [
                    '优先聚焦共享可变状态的访问路径',
                    '区分死锁、活锁、饥饿、数据竞争等类型',
                    '使用并发测试工具验证修复',
                ],
                acceptanceCriteria: [
                    '竞态条件已消除',
                    '数据一致性得到保障',
                    '并发性能未显著下降',
                ],
            },
            compatibility_defect: {
                label: '兼容性缺陷',
                icon: '🔗',
                inputPlaceholder: '描述兼容性问题...',
                inputFields: [
                    { key: 'environment', label: '环境信息', type: 'input', placeholder: '出现兼容性问题的平台/版本/浏览器/设备', required: true },
                    { key: 'normalEnv', label: '正常环境', type: 'input', placeholder: '无此问题的平台/版本', required: true },
                    { key: 'defectDesc', label: '缺陷现象', type: 'textarea', placeholder: '兼容性问题的具体表现', required: true },
                ],
                analysisFramework: '请遵循兼容性分析框架：1) 对比正常环境和异常环境的差异 2) 检查 API 版本差异、特性支持度、polyfill 覆盖 3) 定位到具体的不兼容点 4) 评估降级方案或适配方案的可行性',
                executionHints: [
                    '先确认是前端兼容还是后端版本兼容',
                    '检查特性检测 vs 版本检测的可靠性',
                    '优先使用渐进增强/优雅降级策略',
                ],
                acceptanceCriteria: [
                    '兼容性问题已定位',
                    '适配方案已验证通过',
                    '已有功能不受影响',
                ],
            },
        },
    },
};

export function getCategories(): CategoryDef[] {
    return Object.values(CATEGORIES);
}

export function getCategory(key: TaskCategory): CategoryDef | undefined {
    return CATEGORIES[key];
}

export function getTemplate(category: TaskCategory, subType: string): TaskTemplate | undefined {
    return CATEGORIES[category]?.subTypes[subType];
}
