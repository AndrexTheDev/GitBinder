/**
 * Icon layer.
 *
 * Lucide ships 2 000+ icons; importing `* as lucide` would put all of them in
 * the bundle. Instead we import the handful of nodes we use by name (Rollup
 * tree-shakes the rest) and render them with a tiny local factory.
 *
 * Note: Lucide v1 removed brand marks, so the GitHub octocat is defined here as
 * a plain IconNode using GitHub's own MIT-licensed octicon path.
 *
 * @module components/ui/Icon
 */

import {
  Archive,
  ArrowUpDown,
  BookMarked,
  BookOpenText,
  Bug,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  CircleX,
  Clock,
  CodeXml,
  Copy,
  Crown,
  Database,
  Download,
  FileText,
  ExternalLink,
  Eye,
  EyeOff,
  Feather,
  FileJson,
  Filter,
  GitFork,
  Globe,
  Hash,
  Heart,
  HeartHandshake,
  Info,
  KeyRound,
  Languages,
  Library,
  ListChecks,
  LoaderCircle,
  Lock,
  Mail,
  Minus,
  NotebookPen,
  PenLine,
  Printer,
  QrCode,
  RefreshCw,
  RotateCcw,
  Scale,
  ScrollText,
  Search,
  Server,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  SquareCheck,
  Star,
  Table,
  Tag,
  Trash2,
  TriangleAlert,
  Undo2,
  Upload,
  User,
  Wallet,
  X,
} from 'lucide';

/** GitHub octocat (GitHub octicons, MIT licensed), expressed as a Lucide IconNode. */
const GithubMark = [
  [
    'path',
    {
      d: 'M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z',
      fill: 'currentColor',
      stroke: 'none',
    },
  ],
];

const SVG_NS = 'http://www.w3.org/2000/svg';

const BASE_ATTRIBUTES = {
  xmlns: SVG_NS,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': '2',
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
};

/** Semantic name → IconNode. Components reference names, never Lucide imports. */
export const Icons = Object.freeze({
  // brand
  github: GithubMark,
  logo: BookMarked,

  // navigation / chrome
  settings: Settings2,
  language: Languages,
  globe: Globe,
  heart: Heart,
  support: HeartHandshake,
  close: X,
  menu: SlidersHorizontal,
  external: ExternalLink,
  printer: Printer,
  feather: Feather,
  pen: PenLine,
  book: BookOpenText,
  library: Library,
  notebook: NotebookPen,
  crown: Crown,

  // actions
  fetch: RefreshCw,
  download: Download,
  fileText: FileText,
  table: Table,
  upload: Upload,
  search: Search,
  filter: Filter,
  sort: ArrowUpDown,
  copy: Copy,
  check: Check,
  trash: Trash2,
  reset: RotateCcw,
  undo: Undo2,
  expand: ChevronDown,
  chevronDown: ChevronDown,
  collapse: ChevronRight,
  listChecks: ListChecks,
  selectAll: SquareCheck,
  selectNone: Minus,

  // repo metadata
  star: Star,
  fork: GitFork,
  code: CodeXml,
  tag: Tag,
  hash: Hash,
  clock: Clock,
  archive: Archive,
  user: User,
  mail: Mail,
  wallet: Wallet,
  bug: Bug,

  // state / feedback
  spinner: LoaderCircle,
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  error: CircleX,
  alert: CircleAlert,
  lock: Lock,
  key: KeyRound,
  shield: ShieldCheck,
  eye: Eye,
  eyeOff: EyeOff,
  database: Database,
  file: FileJson,
  sparkles: Sparkles,

  // info / legal surfaces
  help: CircleHelp,
  terms: Scale,
  disclaimer: ShieldAlert,
  contact: Mail,
  qr: QrCode,
  server: Server,
  document: ScrollText,
});

/** @type {Set<string>} names registered in {@link Icons} */
export const IconNames = Object.freeze(Object.keys(Icons));

function renderNode(node) {
  const [tag, attributes = {}, children = []] = node;
  const element = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, String(value));
  }
  for (const child of children) element.append(renderNode(child));
  return element;
}

/**
 * Create an `<svg>` element from an IconNode.
 *
 * @param {string|Array} nameOrNode  a key of {@link Icons} or a raw IconNode
 * @param {{ size?: number|string, class?: string, strokeWidth?: number, label?: string, spin?: boolean }} [options]
 * @returns {SVGSVGElement}
 */
export function icon(nameOrNode, options = {}) {
  const node = typeof nameOrNode === 'string' ? Icons[nameOrNode] : nameOrNode;
  if (!node) {
    console.warn(`[icon] unknown icon "${nameOrNode}"`);
    return document.createElementNS(SVG_NS, 'svg');
  }

  const { size = 18, class: className, strokeWidth = 2, label, spin = false } = options;

  const svg = document.createElementNS(SVG_NS, 'svg');
  for (const [name, value] of Object.entries(BASE_ATTRIBUTES)) svg.setAttribute(name, value);
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('stroke-width', String(strokeWidth));

  const classes = [className, spin ? 'animate-spin' : null].filter(Boolean).join(' ');
  if (classes) svg.setAttribute('class', classes);

  if (label) {
    // Decorative by default; a label makes it a real image for screen readers.
    svg.setAttribute('role', 'img');
    svg.removeAttribute('aria-hidden');
    svg.setAttribute('aria-label', label);
  } else {
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
  }

  for (const child of node) svg.append(renderNode(child));
  return svg;
}

/** Convenience wrapper: `iconNamed('settings', { size: 20 })`. */
export const iconNamed = (name, options) => icon(name, options);
