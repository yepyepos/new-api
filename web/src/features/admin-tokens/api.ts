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

import type {
  ApiResponse,
  GetAdminTokensParams,
  GetAdminTokensResponse,
} from './types'

// ============================================================================
// Admin Token Management APIs（跨用户）
// ============================================================================

/**
 * 列出全站令牌，可按用户名 / 显示名 / 令牌名 / 令牌 ID 检索。
 * Key 一律由后端打码。
 */
export async function getAdminTokens(
  params: GetAdminTokensParams = {}
): Promise<GetAdminTokensResponse> {
  const { p = 1, page_size = 20, keyword = '' } = params
  const queryParams = new URLSearchParams()
  queryParams.set('p', String(p))
  queryParams.set('page_size', String(page_size))
  if (keyword.trim()) queryParams.set('keyword', keyword.trim())
  const res = await api.get(`/api/admin/tokens/?${queryParams.toString()}`)
  return res.data
}

/**
 * 删除单个令牌（跨用户，软删除）。
 */
export async function deleteAdminToken(id: number): Promise<ApiResponse> {
  const res = await api.delete(`/api/admin/tokens/${id}`)
  return res.data
}

/**
 * 批量删除令牌（跨用户，软删除）。
 */
export async function batchDeleteAdminTokens(
  ids: number[]
): Promise<ApiResponse<number>> {
  const res = await api.post('/api/admin/tokens/batch', { ids })
  return res.data
}
