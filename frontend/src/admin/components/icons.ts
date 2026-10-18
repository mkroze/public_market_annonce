// One lucide icon registry for the whole admin space, so nav items and stage
// descriptors can name an icon as a string and both the sidebar and the stage
// shell resolve it the same way.
import {
  LayoutDashboard, DownloadCloud, Table2, ScrollText, Users, ShieldCheck,
  Settings, Plug, Receipt, Database, FileSearch, Clock, Workflow,
  Archive, Video, FileCheck2, Mail,
} from "lucide-react";

export const ICONS: Record<string, typeof LayoutDashboard> = {
  LayoutDashboard, DownloadCloud, Table2, ScrollText, Users, ShieldCheck,
  Settings, Plug, Receipt, Database, FileSearch, Clock, Workflow,
  Archive, Video, FileCheck2, Mail,
};

export const resolveIcon = (name: string): typeof LayoutDashboard =>
  ICONS[name] ?? LayoutDashboard;
