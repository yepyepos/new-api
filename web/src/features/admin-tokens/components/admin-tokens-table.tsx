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
import { getRouteApi } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { DataTablePage, useDataTable } from '@/components/data-table'
import { useMediaQuery } from '@/hooks'
import { useTableUrlState } from '@/hooks/use-table-url-state'

import { getAdminTokens } from '../api'
import type { AdminToken } from '../types'
import { useAdminTokens } from './admin-tokens-provider'
import { AdminTokensBulkActions } from './admin-tokens-bulk-actions'
import { useAdminTokensColumns } from './admin-tokens-columns'

const route = getRouteApi('/_authenticated/admin-tokens/')

export function AdminTokensTable() {
  const { t } = useTranslation()
  const columns = useAdminTokensColumns()
  const { refreshTrigger } = useAdminTokens()
  const isMobile = useMediaQuery('(max-width: 640px)')

  const {
    globalFilter,
    onGlobalFilterChange,
    columnFilters,
    onColumnFiltersChange,
    pagination,
    onPaginationChange,
    ensurePageInRange,
  } = useTableUrlState({
    search: route.useSearch(),
    navigate: route.useNavigate(),
    pagination: { defaultPage: 1, defaultPageSize: isMobile ? 10 : 20 },
    globalFilter: { enabled: true, key: 'filter' },
  })

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      'admin-tokens',
      pagination.pageIndex + 1,
      pagination.pageSize,
      globalFilter,
      refreshTrigger,
    ],
    queryFn: async () => {
      const result = await getAdminTokens({
        p: pagination.pageIndex + 1,
        page_size: pagination.pageSize,
        keyword: globalFilter?.trim() || '',
      })

      if (!result.success) {
        toast.error(result.message || t('Failed to load tokens'))

        return { items: [], total: 0 }
      }

      return {
        items: result.data?.items || [],
        total: result.data?.total || 0,
      }
    },
    placeholderData: (previousData) => previousData,
  })

  const tokens = data?.items || []

  const { table } = useDataTable({
    data: tokens,
    columns,
    enableRowSelection: true,
    columnFilters,
    globalFilter,
    pagination,
    onPaginationChange,
    onGlobalFilterChange,
    onColumnFiltersChange,
    manualPagination: true,
    manualFiltering: true,
    totalCount: data?.total || 0,
    ensurePageInRange,
  })

  return (
    <DataTablePage<AdminToken>
      table={table}
      columns={columns}
      isLoading={isLoading}
      isFetching={isFetching}
      emptyTitle={t('No Tokens Found')}
      emptyDescription={t('No API tokens available.')}
      skeletonKeyPrefix='admin-tokens-skeleton'
      applyHeaderSize
      toolbarProps={{
        searchPlaceholder: t('Filter by username, token name or ID...'),
        searchDebounceMs: 500,
      }}
      bulkActions={<AdminTokensBulkActions table={table} />}
    />
  )
}
