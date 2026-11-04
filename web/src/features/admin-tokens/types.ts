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
import { z } from 'zod'

import { apiKeySchema } from '@/features/keys/types'

// ============================================================================
// Admin Token Schema & Types
// ============================================================================

/**
 * 管理员视角的一条令牌：令牌本体（Key 由后端打码）+ 所属用户信息。
 */
export const adminTokenSchema = apiKeySchema.extend({
  user_id: z.number(),
  username: z.string().nullish().default(''),
  display_name: z.string().nullish().default(''),
})

export type AdminToken = z.infer<typeof adminTokenSchema>

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
}

export interface GetAdminTokensParams {
  p?: number
  page_size?: number
  keyword?: string
}

export interface GetAdminTokensResponse {
  success: boolean
  message?: string
  data?: {
    items: AdminToken[]
    total: number
    page: number
    page_size: number
  }
}
