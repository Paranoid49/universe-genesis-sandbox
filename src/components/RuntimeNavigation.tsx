import { BookMarked, BookOpen, Dices, History, Link, Radar, Sparkles } from "./icons";

export type RuntimePageId = "universe" | "observe" | "entities" | "research" | "experiment" | "branches" | "history" | "archives";

const pages = [
  ["universe", "当前宇宙", "状态、时间控制与检查点", Sparkles],
  ["observe", "观察", "选择方式并获取证据", Radar],
  ["entities", "自主实体", "行为、关系与公开叙述", Sparkles],
  ["research", "研究记录", "关注、笔记与推测", BookMarked],
  ["experiment", "实验", "界外实验与宇宙内干预", Dices],
  ["branches", "历史分支", "切换、比较与保存", Link],
  ["history", "已发生历史", "浏览变化与因果", History],
  ["archives", "存档", "运行检查点与研究记录", BookMarked],
] as const;

export function RuntimeNavigation({ activePage, onChange, onOpenLegacy, hasEntities = false, disabled = false }: { activePage: RuntimePageId; onChange: (page: RuntimePageId) => void; onOpenLegacy: () => void; hasEntities?: boolean; disabled?: boolean }) {
  return <nav className="page-navigation" aria-label="主页面导航">
    {pages.filter(([id]) => id !== "entities" || hasEntities).map(([id, label, description, Icon]) => <button key={id} aria-current={activePage === id ? "page" : undefined} aria-label={`${label}：${description}`} className={activePage === id ? "active" : ""} type="button" onClick={() => onChange(id)}>
      <Icon size={17} /><span>{label}</span><small>{description}</small>
    </button>)}
    <button aria-label="旧版兼容：隔离查看步骤 1 静态宇宙" disabled={disabled} type="button" title="隔离查看步骤 1 静态宇宙" onClick={onOpenLegacy}>
      <BookOpen size={17} /><span>旧版兼容</span><small>隔离查看步骤 1 静态宇宙</small>
    </button>
  </nav>;
}
