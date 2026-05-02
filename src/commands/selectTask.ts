import { Task } from '../types';

type TaskSelectCallback = (task: Task) => void;

let onTaskSelected: TaskSelectCallback | undefined;

export function setTaskSelectCallback(cb: TaskSelectCallback) {
    onTaskSelected = cb;
}

export function selectTask(task: Task): void {
    if (onTaskSelected) {
        onTaskSelected(task);
    }
}
