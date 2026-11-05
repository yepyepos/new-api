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
import { useStatus } from '@/hooks/use-status'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

/**
 * Whether the community leaderboards may be shown to the signed-in user.
 *
 * Administrators always see them; everybody else only after the operator turns
 * on the public switch in the check-in settings. The backend enforces the same
 * rule on both leaderboard endpoints, so this only decides what to render.
 */
export function useCommunityLeaderboardVisible(): boolean {
  const { status } = useStatus()
  const role = useAuthStore((state) => state.auth.user?.role) ?? ROLE.GUEST
  return role >= ROLE.ADMIN || status?.community_leaderboard_public === true
}
