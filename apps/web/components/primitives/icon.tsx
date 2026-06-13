import {
  List,
  LineChart,
  User,
  SlidersHorizontal,
  GitFork,
  GitBranch,
  PanelLeft,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  X,
  Plus,
  Check,
  Sun,
  Moon,
  Filter,
  Clock,
  ExternalLink,
  RotateCcw,
  Shield,
  Zap,
  Activity,
  OctagonAlert,
  Search,
  Circle,
  type LucideIcon,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  releases: List,
  stats: LineChart,
  myruns: User,
  settings: SlidersHorizontal,
  repo: GitFork,
  branch: GitBranch,
  panel: PanelLeft,
  chevronDown: ChevronDown,
  chevronRight: ChevronRight,
  arrowLeft: ArrowLeft,
  arrowRight: ArrowRight,
  x: X,
  plus: Plus,
  check: Check,
  sun: Sun,
  moon: Moon,
  filter: Filter,
  clock: Clock,
  external: ExternalLink,
  rotate: RotateCcw,
  shield: Shield,
  zap: Zap,
  activity: Activity,
  incident: OctagonAlert,
  search: Search,
  dot: Circle,
};

export function Icon({
  name,
  size = 18,
  stroke = 1.5,
  className,
  style,
}: {
  name: string;
  size?: number;
  stroke?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const C = MAP[name] ?? List;
  return (
    <C
      size={size}
      strokeWidth={stroke}
      className={className}
      style={{ flexShrink: 0, display: "block", ...style }}
    />
  );
}
