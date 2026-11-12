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
import { describe, expect, it } from 'vitest'

import { ROLE } from '@/lib/roles'

import { closureHidesRoute } from '../lib/gate'

describe('closureHidesRoute', () => {
  it('leaves every route alone while the site is open', () => {
    for (const pathname of ['/', '/sign-in', '/dashboard', '/console']) {
      expect(closureHidesRoute(false, ROLE.USER, pathname)).toBe(false)
    }
    expect(closureHidesRoute(false, undefined, '/dashboard')).toBe(false)
  })

  it('keeps the console for administrators and the root account', () => {
    for (const role of [ROLE.ADMIN, ROLE.SUPER_ADMIN]) {
      for (const pathname of ['/', '/sign-in', '/dashboard', '/console']) {
        expect(closureHidesRoute(true, role, pathname)).toBe(false)
      }
    }
  })

  it('keeps the sign-in and one-time-code routes reachable for everyone else', () => {
    for (const role of [undefined, ROLE.GUEST, ROLE.USER]) {
      expect(closureHidesRoute(true, role, '/sign-in')).toBe(false)
      expect(closureHidesRoute(true, role, '/otp')).toBe(false)
    }
  })

  it('shows the notice instead of every other route', () => {
    for (const pathname of [
      '/',
      '/dashboard',
      '/console',
      '/sign-up',
      '/setup',
    ]) {
      expect(closureHidesRoute(true, ROLE.USER, pathname)).toBe(true)
    }
    expect(closureHidesRoute(true, undefined, '/dashboard')).toBe(true)
  })

  it('treats a partial path as a different route', () => {
    // The check is an exact pathname match, so a route that merely starts with
    // a reachable one stays closed.
    expect(closureHidesRoute(true, ROLE.USER, '/sign-in/help')).toBe(true)
  })
})
