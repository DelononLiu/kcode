import type { AppState, StreamResult, UserAction } from './types';

export interface ViewStrategy {
    /** 渲染该模式特有的 header/布局 */
    renderHeader(state: AppState): void;

    /** 流式输出完成后的处理 */
    onStreamDone(state: AppState, result: StreamResult): void;

    /** 用户交互处理 */
    onUserAction(state: AppState, action: UserAction): void;

    /** 该模式是否需要阶段面板 */
    showPhasePanel(): boolean;

    /** 该模式是否需要折叠历史阶段 */
    shouldFoldPhases(): boolean;

    /** 该模式是否需要右侧产出物面板 */
    showOutputPanel(): boolean;
}
