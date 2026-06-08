import type { Component } from "vue";
import {
  ActivityIcon,
  BarChart3Icon,
  BellIcon,
  BuildingIcon,
  CheckCircleIcon,
  CircleHelpIcon,
  ClipboardCheckIcon,
  FileTextIcon,
  HomeIcon,
  InboxIcon,
  PlusCircleIcon,
  ReceiptIcon,
  SearchIcon,
  ShieldIcon,
  TagIcon,
  UserCheckIcon,
  UsersIcon,
} from "lucide-vue-next";

/**
 * Maps the `icon` string stored on each {@link NavItem} to its lucide-vue-next
 * component, so the sidebar can render an icon alongside each label.
 */
const iconMap: Record<string, Component> = {
  "home": HomeIcon,
  "file-text": FileTextIcon,
  "plus-circle": PlusCircleIcon,
  "bar-chart": BarChart3Icon,
  "circle-help": CircleHelpIcon,
  "inbox": InboxIcon,
  "check-circle": CheckCircleIcon,
  "receipt": ReceiptIcon,
  "clipboard-check": ClipboardCheckIcon,
  "user-check": UserCheckIcon,
  "search": SearchIcon,
  "users": UsersIcon,
  "building": BuildingIcon,
  "tag": TagIcon,
  "shield": ShieldIcon,
  "activity": ActivityIcon,
  "bell": BellIcon,
};

export function navIcon(name: string): Component {
  return iconMap[name] ?? CircleHelpIcon;
}
