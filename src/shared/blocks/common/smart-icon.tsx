import {
  Activity,
  ArrowLeft,
  Brain,
  Coins,
  CreditCard,
  DollarSign,
  FileText,
  Folder,
  Frame,
  Github,
  HelpCircle,
  History,
  Home,
  Image,
  Key,
  Lock,
  Mail,
  MessageCircle,
  Plus,
  Settings,
  ShieldCheck,
  Sparkles,
  User,
  UserCheck,
  Users,
} from 'lucide-react';
import {
  RiChat2Line,
  RiDiscordFill,
  RiDropLine,
  RiEyeLine,
  RiFlashlightFill,
  RiFolderImageLine,
  RiGiftLine,
  RiHeart3Line,
  RiKeyLine,
  RiLayoutGridLine,
  RiLeafLine,
  RiMagicLine,
  RiPaletteLine,
  RiQuillPenLine,
  RiTaskLine,
  RiTwitterXFill,
  RiVipCrownLine,
} from 'react-icons/ri';

/**
 * Curated icon map. Both libraries declare `sideEffects: false`, so named
 * imports tree-shake in production — the bundle only contains icons that
 * are actually referenced below. The previous implementation lazy-loaded
 * the *entire* react-icons/ri and lucide-react packages at runtime, which
 * pulled ~2.2 MB of icon code into every landing page (the full
 * Remix Icon set, ~3 000 icons, plus the lucide barrel) even though only
 * ~40 icons are referenced anywhere in the app's locale configs.
 *
 * To support a new icon: import it above, add an entry here, done. Unknown
 * names fall through to `HelpCircle` (matches the previous behavior).
 */
const ICON_MAP: Record<string, React.ComponentType<any>> = {
  // lucide
  Activity,
  ArrowLeft,
  Brain,
  Coins,
  CreditCard,
  DollarSign,
  FileText,
  Folder,
  Frame,
  Github,
  History,
  Home,
  Image,
  Key,
  Lock,
  Mail,
  MessageCircle,
  Plus,
  Settings,
  ShieldCheck,
  Sparkles,
  User,
  UserCheck,
  Users,
  // react-icons /ri
  RiChat2Line,
  RiDiscordFill,
  RiDropLine,
  RiEyeLine,
  RiFlashlightFill,
  RiFolderImageLine,
  RiGiftLine,
  RiHeart3Line,
  RiKeyLine,
  RiLayoutGridLine,
  RiLeafLine,
  RiMagicLine,
  RiPaletteLine,
  RiQuillPenLine,
  RiTaskLine,
  RiTwitterXFill,
  RiVipCrownLine,
};

export function SmartIcon({
  name,
  size = 24,
  className,
  ...props
}: {
  name: string;
  size?: number;
  className?: string;
  [key: string]: any;
}) {
  const Icon = ICON_MAP[name] ?? HelpCircle;

  if (!ICON_MAP[name]) {
    // Keep the previous console.warn so a typo in a JSON config still
    // surfaces during development.
    console.warn(
      `[SmartIcon] unknown icon "${name}", using HelpCircle fallback`
    );
  }

  return <Icon size={size} className={className} {...props} />;
}
