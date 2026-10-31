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

import { buildDiscordOAuthUrl, buildOAuthAuthorizationUrl } from '../oauth'

describe('Discord authorization scopes', () => {
  it('requests only identity when community verification is disabled', () => {
    const url = new URL(buildDiscordOAuthUrl('client-id', 'state-value'))

    expect(url.searchParams.get('scope')).toBe('identify')
    expect(url.searchParams.get('state')).toBe('state-value')
    expect(url.searchParams.get('redirect_uri')).toBe(
      `${window.location.origin}/oauth/discord`
    )
  })

  it('requests current-user membership without bot or server-list permissions when configured', () => {
    const url = new URL(
      buildOAuthAuthorizationUrl('discord', 'state-value', {
        discord_client_id: 'client-id',
        discord_guild_check: true,
      })
    )

    expect(url.searchParams.get('scope')).toBe('identify guilds.members.read')
    expect(url.searchParams.get('client_id')).toBe('client-id')
  })
})
