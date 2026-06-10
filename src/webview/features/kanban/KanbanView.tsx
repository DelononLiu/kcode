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

const PHASE_LABELS: Record<string, string> = {
  goal: "目标",
  plan: "计划",
  execute: "执行",
  self_verify: "自验",
  review: "验收",
};

const PHASE_COLORS: Record<string, string> = {
  goal: "#58a6ff",
  plan: "#bc8cff",
  execute: "#3fb950",
  self_verify: "#d29922",
  review: "#f78166",
};

const COLUMNS: Array<{ id: TaskItem["phase"]; title: string; phases: string }> = [
  { id: "goal", title: "📋 目标", phases: "goal" },
  { id: "plan", title: "📝 计划", phases: "plan" },
  { id: "execute", title: "⚡ 执行", phases: "execute" },
  { id: "self_verify", title: "🔍 自验", phases: "self_verify" },
  { id: "review", title: "🏁 验收", phases: "review" },
];

const taskPhaseColor = (phase: string) => PHASE_COLORS[phase] || "#808080";
const taskPhaseLabel = (phase: string) => PHASE_LABELS[phase] || phase;

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
    const colIndex = destination.droppableIndex;
    if (colIndex < 0 || colIndex >= COLUMNS.length) return;
    const newPhase = COLUMNS[colIndex].id;

    setTasks((prev) => prev.map((t) => (t.id === draggableId ? { ...t, phase: newPhase } : t)));
    await bridge.invoke("taskflow/updatePhase", { taskId: draggableId, phase: newPhase }).catch(() => {});
  }, []);

  return (
    <div className="h-full flex flex-col p-3 gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">5 阶段管线</h2>
        <button
          className="px-3 py-1 rounded text-xs bg-[#04d361] text-black hover:bg-[#00e676]"
          onClick={async () => {
            const newTask = await bridge.invoke<TaskItem>("taskflow/create", { title: "新任务" }).catch(() => null);
            if (newTask) setTasks((prev) => [...prev, newTask]);
          }}
        >
          + 新建任务
        </button>
      </div>

      {/* 阶段流程指示器 */}
      <div className="flex items-center gap-0 px-1">
        {(["goal", "plan", "execute", "self_verify", "review"] as const).map((phase, i) => (
          <div key={phase} className="flex items-center">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium"
              style={{ background: `${PHASE_COLORS[phase]}20`, color: PHASE_COLORS[phase] }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: PHASE_COLORS[phase] }} />
              {PHASE_LABELS[phase]}
            </div>
            {i < 4 && <span className="text-[#353540] mx-1">→</span>}
          </div>
        ))}
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
                    className="flex flex-col bg-[#121212] rounded-lg border border-[#252530] min-w-[220px] w-72"
                    style={{ background: snapshot.isDraggingOver ? "#1a1a20" : undefined }}
                  >
                    <div className="flex items-center justify-between px-3 py-2 border-b border-[#252530]">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ background: taskPhaseColor(col.id) }} />
                        <span className="text-xs font-semibold text-[#e6e7ea]">{col.title}</span>
                      </div>
                      <span className="text-[10px] text-[#808080] bg-[#1f1f25] px-1.5 py-0.5 rounded">
                        {colTasks.length}
                      </span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[80px]">
                      {colTasks.map((task, index) => (
                        <Draggable key={task.id} draggableId={task.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className="bg-[#1f1f25] border border-[#252530] rounded-lg p-3 cursor-grab space-y-1.5"
                              style={{
                                ...provided.draggableProps.style,
                                background: snapshot.isDragging ? "#2a2a30" : undefined,
                              }}
                            >
                              <div className="text-xs font-medium text-[#e6e7ea]">{task.title}</div>
                              <div className="flex items-center gap-1">
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                                  style={{ background: `${taskPhaseColor(task.phase)}20`, color: taskPhaseColor(task.phase) }}>
                                  {taskPhaseLabel(task.phase)}
                                </span>
                                <span className="text-[9px] text-[#808080]">
                                  {new Date(task.createdAt).toLocaleDateString()}
                                </span>
                              </div>
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
