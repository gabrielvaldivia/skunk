import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  Activity01Icon,
  Alert02Icon,
  CancelCircleIcon,
  CheckmarkCircle02Icon,
  InformationCircleIcon,
  Loading03Icon,
  Add01Icon,
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Camera01Icon,
  Cancel01Icon,
  ChampionIcon,
  CircleIcon,
  ComputerIcon,
  DicesIcon,
  Location01Icon,
  Moon02Icon,
  Edit03Icon,
  Image01Icon,
  Search01Icon,
  Share03Icon,
  Sun03Icon,
  Tick02Icon,
  UnfoldMoreIcon,
  UserMultiple02Icon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons";

interface IconProps {
  className?: string;
  size?: number | string;
  strokeWidth?: number;
  "aria-hidden"?: boolean | "true" | "false";
}

// Wrap a Hugeicons glyph so it drops in wherever an icon component is expected
function makeIcon(icon: IconSvgElement, displayName: string) {
  const Icon = ({ size = 24, strokeWidth = 1.8, ...props }: IconProps) => (
    <HugeiconsIcon icon={icon} size={size} strokeWidth={strokeWidth} color="currentColor" {...props} />
  );
  Icon.displayName = displayName;
  return Icon;
}

export const ActivityIcon = makeIcon(Activity01Icon, "ActivityIcon");
export const GamesIcon = makeIcon(DicesIcon, "GamesIcon");
export const ChevronDownIcon = makeIcon(ArrowDown01Icon, "ChevronDownIcon");
export const PlayersIcon = makeIcon(UserMultiple02Icon, "PlayersIcon");
export const AccountIcon = makeIcon(UserCircleIcon, "AccountIcon");
export const BackIcon = makeIcon(ArrowLeft01Icon, "BackIcon");
export const ChevronRightIcon = makeIcon(ArrowRight01Icon, "ChevronRightIcon");
export const CloseIcon = makeIcon(Cancel01Icon, "CloseIcon");
export const PlusIcon = makeIcon(Add01Icon, "PlusIcon");
export const EditIcon = makeIcon(Edit03Icon, "EditIcon");
export const SearchIcon = makeIcon(Search01Icon, "SearchIcon");
export const TrophyIcon = makeIcon(ChampionIcon, "TrophyIcon");
export const CameraIcon = makeIcon(Camera01Icon, "CameraIcon");
export const ImageIcon = makeIcon(Image01Icon, "ImageIcon");
export const LocationIcon = makeIcon(Location01Icon, "LocationIcon");
export const ShareIcon = makeIcon(Share03Icon, "ShareIcon");
export const SunIcon = makeIcon(Sun03Icon, "SunIcon");
export const MoonIcon = makeIcon(Moon02Icon, "MoonIcon");
export const SystemIcon = makeIcon(ComputerIcon, "SystemIcon");
export const CheckIcon = makeIcon(Tick02Icon, "CheckIcon");
export const DotIcon = makeIcon(CircleIcon, "DotIcon");
export const SelectorIcon = makeIcon(UnfoldMoreIcon, "SelectorIcon");
export const SuccessIcon = makeIcon(CheckmarkCircle02Icon, "SuccessIcon");
export const InfoIcon = makeIcon(InformationCircleIcon, "InfoIcon");
export const WarningIcon = makeIcon(Alert02Icon, "WarningIcon");
export const ErrorIcon = makeIcon(CancelCircleIcon, "ErrorIcon");
export const SpinnerIcon = makeIcon(Loading03Icon, "SpinnerIcon");

// Drawn here rather than from Hugeicons so it can fill in when a game is hearted
export function HeartIcon({ filled, className }: { filled?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} className={className} aria-hidden>
      <path
        d="M12 20.5s-7.5-4.6-9.2-9.6C1.7 7.6 3.8 4.5 7.2 4.5c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.4 0 5.5 3.1 4.4 6.4-1.7 5-9.2 9.6-9.2 9.6Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </svg>
  );
}
