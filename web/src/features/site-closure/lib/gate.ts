/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { ROLE } from '@/lib/roles'

/**
 * Routes that stay reachable while the site is closed.
 *
 * The closure page replaces the routed page and carries no login form, so
 * without these two an operator who is signed out — for example after "sign
 * out all users" — could never reach the console that reopens the site.
 *
 * This only exposes the form, never access: the server refuses ordinary
 * accounts before it issues a session (`SiteClosureDeniesUser`), and a signed
 * in administrator is already let through by the role check below.
 */
const CLOSURE_SIGN_IN_ROUTES = new Set(['/sign-in', '/otp'])

/**
 * Whether the closure notice replaces the page for this visitor.
 *
 * Administrators keep the console because the switch that reopens the site
 * lives there. Everyone else sees the notice, except on the sign-in route they
 * need to prove they are that administrator.
 */
export function closureHidesRoute(
  closed: boolean,
  role: number | undefined,
  pathname: string
): boolean {
  if (!closed) return false
  if (typeof role === 'number' && role >= ROLE.ADMIN) return false
  return !CLOSURE_SIGN_IN_ROUTES.has(pathname)
}
