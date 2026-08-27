import { Outlet, useLocation } from 'react-router-dom'

/**
 * Page outlet — no animated wrapper here.
 * Opacity/transform on a parent breaks backdrop-filter on sticky/fixed glass chrome.
 * Use PageContent inside pages for safe enter motion below the header.
 */
export function AnimatedOutlet() {
  const { pathname } = useLocation()
  return <Outlet key={pathname} />
}
