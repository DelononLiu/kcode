import type { AppState, StreamResult, UserAction } from './types';

export interface ViewStrategy {
    renderHeader(state: AppState): void;
    onStreamDone(state: AppState, result: StreamResult): void;
    onUserAction(state: AppState, action: UserAction): void;
    showPhasePanel(): boolean;
    shouldFoldPhases(): boolean;
    showOutputPanel(): boolean;
}
