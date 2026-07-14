import { BarChart3, BookMarked, BookOpen, Clipboard, Dices, History, Link, Radar, ScrollText, Sparkles, Telescope, UsersRound } from "./icons";
import { RULESET_VERSION, UNIVERSE_TEMPLATES, type UniverseTemplateId } from "../sim";
import type { AppPageId } from "../ui/appPages";

const appPageOptions: Array<{ id: AppPageId; label: string; description: string; icon: typeof BarChart3 }> = [
  { id: "runtime", label: "运行", description: "持续演化、时间控制与检查点", icon: Sparkles },
  { id: "overview", label: "概览", description: "宇宙摘要与指标", icon: BarChart3 },
  { id: "causality", label: "因果", description: "结果、原因与影响链路", icon: Link },
  { id: "observe", label: "观察台", description: "二维宇宙投影与时间浏览", icon: Radar },
  { id: "space", label: "星系", description: "星系、恒星系与行星", icon: Telescope },
  { id: "civilizations", label: "文明", description: "文明演化与神话", icon: UsersRound },
  { id: "miracles", label: "干预", description: "造物主干预与奇迹", icon: Sparkles },
  { id: "timeline", label: "纪元", description: "时间线与阶段影响", icon: History },
  { id: "laws", label: "法则", description: "法则、关系与对比", icon: BookOpen },
  { id: "logs", label: "日志", description: "观察记录与终局", icon: ScrollText },
  { id: "library", label: "图书馆", description: "本地存档、收藏与恢复", icon: BookMarked },
];

export function UniverseToolbar({
  draftSeed,
  templateId,
  copyState,
  inputError,
  onDraftSeedChange,
  onTemplateChange,
  onCreate,
  onRandomize,
  onCopy,
  showShare = true,
}: {
  draftSeed: string;
  templateId: UniverseTemplateId;
  copyState: string;
  inputError?: string;
  onDraftSeedChange: (value: string) => void;
  onTemplateChange: (value: UniverseTemplateId) => void;
  onCreate: () => void;
  onRandomize: () => void;
  onCopy: () => void;
  showShare?: boolean;
}) {
  return (
    <section className="topbar" aria-label="创世工具栏">
      <div className="brand-block">
        <span className="brand-mark"><Sparkles size={18} /></span>
        <div>
          <h1>Universe Genesis Sandbox</h1>
          <p>{RULESET_VERSION}</p>
        </div>
      </div>
      <div className="tool-strip">
        <label className="seed-field">
          <span>Seed</span>
          <input aria-invalid={Boolean(inputError)} aria-describedby={inputError ? "seed-input-error" : undefined} value={draftSeed} onChange={(event) => onDraftSeedChange(event.target.value)} />
        </label>
        <label className="template-field">
          <span>模板</span>
          <select value={templateId} onChange={(event) => onTemplateChange(event.target.value as UniverseTemplateId)}>
            {UNIVERSE_TEMPLATES.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
          </select>
        </label>
        <button className="primary-action" type="button" onClick={onCreate} title="按当前 seed 创世">
          <Sparkles size={17} />创世
        </button>
        <button className="icon-action" type="button" onClick={onRandomize} title="随机 seed">
          <Dices size={17} />随机
        </button>
        {showShare && <button className="icon-action" type="button" onClick={onCopy} title="复制旧版分享文本和链接">
          <Clipboard size={17} />{copyState}
        </button>}
        {inputError && <p className="input-error" id="seed-input-error" role="alert">{inputError}</p>}
      </div>
    </section>
  );
}

export function PageNavigation({ activePage, onChange }: { activePage: AppPageId; onChange: (page: AppPageId) => void }) {
  return (
    <nav className="page-navigation" aria-label="旧版隔离兼容导航">
      {appPageOptions.filter((page) => page.id !== "runtime").map((page) => {
        const Icon = page.icon;
        return (
          <button aria-current={activePage === page.id ? "page" : undefined} aria-label={`${page.label}：${page.description}`} className={activePage === page.id ? "active" : ""} key={page.id} type="button" onClick={() => onChange(page.id)} title={page.description}>
            <Icon size={17} />
            <span>{page.label}</span>
            <small>{page.description}</small>
          </button>
        );
      })}
    </nav>
  );
}

export function RuntimeNavigation({ onOpenLegacy, disabled = false }: { onOpenLegacy: () => void; disabled?: boolean }) {
  return <nav className="page-navigation" aria-label="主页面导航">
    <button aria-current="page" aria-label="运行：持续演化、时间控制与检查点" className="active" type="button" title="持续演化、时间控制与检查点">
      <Sparkles size={17} /><span>运行</span><small>持续演化、时间控制与检查点</small>
    </button>
    <button aria-label="旧版兼容：隔离查看步骤 1 静态宇宙" disabled={disabled} type="button" title="隔离查看步骤 1 静态宇宙" onClick={onOpenLegacy}>
      <BookOpen size={17} /><span>旧版兼容</span><small>隔离查看步骤 1 静态宇宙</small>
    </button>
  </nav>;
}
