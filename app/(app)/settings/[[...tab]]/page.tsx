import { SettingsPage } from './SettingsPage';

// every tab is exported as its own page for the static GitHub Pages build (only there: with it, a server build
// would treat this session-dependent page as static)
const TABS = ['profile', 'appearance', 'ai', 'notifications', 'security', 'team', 'season', 'printers', 'ai-usage', 'knowledge', 'data'];
export const generateStaticParams = process.env.STATIC_EXPORT ? async () => [{ tab: [] }, ...TABS.map((t) => ({ tab: [t] }))] : undefined;

export default function Page() {
  return <SettingsPage />;
}
