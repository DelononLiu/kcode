/**
 * AppShell — 临时壳布局
 *
 * 后续会被 cp 自 desktop-cc-gui 的完整 app-shell.tsx 替换。
 * 当前只用来验证 Vite + Tailwind 构建通过。
 */
export function AppShell() {
  return (
    <div className="h-full w-full flex items-center justify-center bg-[#0d0f14] text-[#e6e7ea]">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">KCode AI</h1>
        <p className="text-[#808080]">VS Code AI Workbench</p>
      </div>
    </div>
  );
}
