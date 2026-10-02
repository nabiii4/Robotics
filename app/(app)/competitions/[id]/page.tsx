import { EventPage } from './EventPage';

// The GitHub Pages export renders one placeholder page per dynamic route and the service worker maps every id onto it
// (browser-server/sw.ts); the page reads the real id from the URL. Server builds leave this undefined, otherwise they
// would treat these session-dependent pages as static.
export const generateStaticParams = process.env.STATIC_EXPORT ? async () => [{ id: '_' }] : undefined;

export default function Page() {
  return <EventPage />;
}
