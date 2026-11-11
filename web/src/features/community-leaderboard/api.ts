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
import { api } from '@/lib/api'
import { requireServerSuccess } from '@/lib/server-error-message'

export type LeaderboardPeriod = 'today' | 'week' | 'all'

export type CheckinLeaderboardRow = {
  user_id: number
  username: string
  quota_awarded: number
  rank?: number
}

export type UsageLeaderboardRow = {
  user_id: number
  username: string
  total_quota: number
  rank?: number
}

/** Both ends of a ranking plus how many rows it has in total. */
export type LeaderboardEnds<T> = {
  top: T[]
  bottom: T[]
  total: number
}

/** The whole ranking, from first place down, returned by expanded=true. */
export type LeaderboardRows<T> = {
  rows: T[]
  total: number
  truncated: boolean
}

export type CheckinLeaderboard = LeaderboardEnds<CheckinLeaderboardRow> & {
  date: string
}

export type CheckinLeaderboardExpanded =
  LeaderboardRows<CheckinLeaderboardRow> & {
    date: string
  }

export type UsageLeaderboard = LeaderboardEnds<UsageLeaderboardRow> & {
  period: LeaderboardPeriod
}

export type UsageLeaderboardExpanded = LeaderboardRows<UsageLeaderboardRow> & {
  period: LeaderboardPeriod
}

type LeaderboardResponse<T> = {
  success: boolean
  message?: string
  data: T
}

export async function getCheckinLeaderboard(): Promise<CheckinLeaderboard> {
  const res = await api.get<LeaderboardResponse<CheckinLeaderboard>>(
    '/api/community/checkin-leaderboard'
  )
  return requireServerSuccess(res.data).data
}

export async function getExpandedCheckinLeaderboard(): Promise<CheckinLeaderboardExpanded> {
  const res = await api.get<LeaderboardResponse<CheckinLeaderboardExpanded>>(
    '/api/community/checkin-leaderboard',
    { params: { expanded: true } }
  )
  return requireServerSuccess(res.data).data
}

export async function getUsageLeaderboard(
  period: LeaderboardPeriod
): Promise<UsageLeaderboard> {
  const res = await api.get<LeaderboardResponse<UsageLeaderboard>>(
    '/api/community/usage-leaderboard',
    { params: { period } }
  )
  return requireServerSuccess(res.data).data
}

export async function getExpandedUsageLeaderboard(
  period: LeaderboardPeriod
): Promise<UsageLeaderboardExpanded> {
  const res = await api.get<LeaderboardResponse<UsageLeaderboardExpanded>>(
    '/api/community/usage-leaderboard',
    { params: { period, expanded: true } }
  )
  return requireServerSuccess(res.data).data
}
