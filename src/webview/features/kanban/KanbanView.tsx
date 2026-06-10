import { useCallback, useEffect, useState } from "react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { useTranslation } from "react-i18next";
import { bridge } from "../../services/bridge";

interface TaskItem {
  id: string;
  title: string;
  description?: string;
  phase: "goal" | "plan" | "execute" | "self_verify" | "review";
  createdAt: number;
}

const COLUMNS: Array<{ id: TaskItem["phase"]; title: string; limit: number }> = [
  { id: "goal", title: "📋 目标", limit: 10 },
  { id: "plan", title: "📝 计划", limit: 10 },
  { id: "execute", title: "⚡ 执行", limit: 10 },
  { id: "self_verify", title: "🔍 自验", limit: 10 },
  { id: "review", title: "🏁 验收", limit: 10 },
];

const PHASE_ORDER: TaskItem["phase"][] = ["goal", "plan", "execute", "self_verify", "review"];

export function KanbanView() {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<TaskItem[]>([]);

  useEffect(() => {
    bridge.invoke<TaskItem[]>("taskflow/list").then(setTasks).catch(() => {});
    bridge.on("taskflow:updated", (data: any) => {
      if (data?.tasks) setTasks(data.tasks);
    });
  }, []);

  const getColumnTasks = (phase: TaskItem["phase"]) =>
    tasks.filter((t) => t.phase === phase).sort((a, b) => a.createdAt - b.createdAt);

  const handleDragEnd = useCallback(async (result: DropResult) => {
    if (!result.destination) return;
    const { draggableId, destination } = result;
    const newPhase = PHASE_ORDER[destination.droppableIndex];
    if (!newPhase) return;

    setTasks((prev) => prev.map((t) => (t.id === draggableId ? { ...t, phase: newPhase } : t)));
    await bridge.invoke("taskflow/updatePhase", { taskId: draggableId, phase: newPhase }).catch(() => {});
  }, []);

  return (
    <div className="h-full flex flex-col p-3 gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">任务看板</h2>
        <button
          className="kanban-mode-btn"
          onClick={async () => {
            const newTask = await bridge.invoke<TaskItem>("taskflow/create", { title: "新任务" }).catch(() => null);
            if (newTask) setTasks((prev) => [...prev, newTask]);
          }}
        >
          + 新建任务
        </button>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex flex-1 gap-3 overflow-x-auto">
          {COLUMNS.map((col, colIndex) => {
            const colTasks = getColumnTasks(col.id);
            return (
              <Droppable droppableId={col.id} key={col.id} direction="vertical" index={colIndex}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="flex flex-col bg-[#121212] rounded-lg border border-[#252530] min-w-[200px] w-64"
                    style={{ background: snapshot.isDraggingOver ? "#1a1a20" : undefined }}
                  >
                    <div className="flex items-center justify-between px-3 py-2 border-b border-[#252530]">
                      <span className="text-xs font-semibold text-[#e6e7ea]">{col.title}</span>
                      <span className="text-[10px] text-[#808080] bg-[#1f1f25] px-1.5 py-0.5 rounded">
                        {colTasks.length}/{col.limit}
                      </span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[100px]">
                      {colTasks.map((task, index) => (
                        <Draggable key={task.id} draggableId={task.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className="bg-[#1f1f25] border border-[#252530] rounded-lg p-3 cursor-grab"
                              style={{
                                ...provided.draggableProps.style,
                                background: snapshot.isDragging ? "#2a2a30" : undefined,
                              }}
                            >
                              <div className="text-xs font-medium text-[#e6e7ea]">{task.title}</div>
                              {task.description && (
                                <div className="text-[10px] text-[#808080] mt-1 line-clamp-2">{task.description}</div>
                              )}
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  </div>
                )}
              </Droppable>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
}
