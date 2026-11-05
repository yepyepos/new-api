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
import { useQuery } from '@tanstack/react-query'

import {
  getCheckinLeaderboard,
  getUsageLeaderboard,
  type LeaderboardPeriod,
} from '../api'

export function useCheckinLeaderboard() {
  return useQuery({
    queryKey: ['community-leaderboard', 'checkin'],
    queryFn: getCheckinLeaderboard,
    staleTime: 60 * 1000,
  })
}

export function useUsageLeaderboard(period: LeaderboardPeriod) {
  return useQuery({
    queryKey: ['community-leaderboard', 'usage', period],
    queryFn: () => getUsageLeaderboard(period),
    staleTime: 60 * 1000,
  })
}
