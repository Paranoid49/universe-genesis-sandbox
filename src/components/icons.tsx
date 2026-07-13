import type { HTMLAttributes } from "react";

export type IconProps = HTMLAttributes<HTMLSpanElement> & {
  size?: number;
};

function createIcon(glyph: string) {
  return function AppIcon({ size = 16, className, style, ...props }: IconProps) {
    return <span {...props} className={["app-icon", className].filter(Boolean).join(" ")} aria-hidden={props["aria-label"] ? undefined : true} style={{ ...style, fontSize: `${size}px`, width: `${size}px`, height: `${size}px` }}>{glyph}</span>;
  };
}

export const BarChart3 = createIcon("▥");
export const BookMarked = createIcon("▣");
export const BookOpen = createIcon("▤");
export const ChevronLeft = createIcon("‹");
export const ChevronRight = createIcon("›");
export const ChevronsLeft = createIcon("«");
export const ChevronsRight = createIcon("»");
export const Clipboard = createIcon("▧");
export const Dices = createIcon("◆");
export const Download = createIcon("↓");
export const History = createIcon("◷");
export const Link = createIcon("⌁");
export const ListFilter = createIcon("≡");
export const Orbit = createIcon("◎");
export const Radar = createIcon("◉");
export const RefreshCcw = createIcon("↻");
export const RotateCcw = createIcon("↶");
export const Scale = createIcon("⚖");
export const ScrollText = createIcon("▨");
export const Search = createIcon("⌕");
export const Sparkles = createIcon("✦");
export const Sprout = createIcon("♧");
export const Star = createIcon("★");
export const Telescope = createIcon("⌖");
export const Trash2 = createIcon("×");
export const Upload = createIcon("↑");
export const UsersRound = createIcon("♙");
