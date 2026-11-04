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
import type { ColumnDef } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'

import { StatusBadge } from '@/components/status-badge'
import { TableId } from '@/components/table-id'
import { Checkbox } from '@/components/ui/checkbox'
import { API_KEY_STATUSES } from '@/features/keys/constants'
import { formatQuota, formatTimestamp } from '@/lib/format'

import type { AdminToken } from '../types'
import { AdminTokenRowActions } from './admin-tokens-row-actions'

export function useAdminTokensColumns(): ColumnDef<AdminToken>[] {
  const { t } = useTranslation()
  return [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label={t('Select all')}
          className='translate-y-[2px]'
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label={t('Select row')}
          className='translate-y-[2px]'
        />
      ),
      enableSorting: false,
      enableHiding: false,
      size: 40,
    },
    {
      accessorKey: 'id',
      header: t('ID'),
      meta: { mobileHidden: true },
      cell: ({ row }) => (
        <TableId value={row.getValue('id') as number} className='w-[60px]' />
      ),
      size: 80,
    },
    {
      id: 'owner',
      header: t('User'),
      meta: { mobileTitle: true },
      cell: ({ row }) => {
        const token = row.original
        const display = token.display_name?.trim()

        return (
          <div className='min-w-0'>
            <div className='truncate font-medium'>
              {token.username || t('Unknown user')}
            </div>
            <div className='text-muted-foreground truncate text-xs'>
              {display ? `${display} · ` : ''}ID: {token.user_id}
            </div>
          </div>
        )
      },
      size: 180,
    },
    {
      accessorKey: 'name',
      header: t('Name'),
      meta: { mobileTitle: true },
      cell: ({ row }) => {
        const name = String(row.getValue('name') || '').trim()

        return (
          <span className='font-medium'>
            {name || `#${row.original.id}`}
          </span>
        )
      },
      size: 180,
    },
    {
      id: 'key',
      accessorKey: 'key',
      header: t('Key'),
      meta: { mobileHidden: true },
      cell: ({ row }) => (
        <code className='text-muted-foreground font-mono text-xs'>
          sk-{row.getValue('key')}
        </code>
      ),
      size: 200,
    },
    {
      accessorKey: 'status',
      header: t('Status'),
      meta: { mobileBadge: true },
      cell: ({ row }) => {
        const statusConfig = API_KEY_STATUSES[row.getValue('status') as number]

        if (!statusConfig) {
          return null
        }

        return (
          <StatusBadge
            label={t(statusConfig.label)}
            variant={statusConfig.variant}
            copyable={false}
          />
        )
      },
      size: 110,
    },
    {
      id: 'quota',
      header: t('Total Quota'),
      meta: { mobileHidden: true },
      cell: ({ row }) => {
        const token = row.original
        if (token.unlimited_quota) {
          return <span className='text-sm'>{t('Unlimited')}</span>
        }

        return (
          <div className='text-sm'>
            <div>
              {t('Remaining')}: {formatQuota(Number(token.remain_quota || 0))}
            </div>
            <div className='text-muted-foreground'>
              {t('Used')}: {formatQuota(Number(token.used_quota || 0))}
            </div>
          </div>
        )
      },
      size: 170,
    },
    {
      id: 'created',
      header: t('Created At'),
      meta: { mobileHidden: true },
      cell: ({ row }) => {
        const token = row.original

        return (
          <div className='text-sm'>
            <div>{formatTimestamp(token.created_time)}</div>
            <div className='text-muted-foreground'>
              {t('Last used')}:{' '}
              {token.accessed_time ? formatTimestamp(token.accessed_time) : '-'}
            </div>
          </div>
        )
      },
      size: 170,
    },
    {
      id: 'expires',
      header: t('Expires'),
      meta: { mobileHidden: true },
      cell: ({ row }) => {
        const { expired_time: expiredTime } = row.original

        return (
          <span className='text-sm'>
            {expiredTime === -1 ? t('Never') : formatTimestamp(expiredTime)}
          </span>
        )
      },
      size: 150,
    },
    {
      id: 'actions',
      header: t('Actions'),
      cell: ({ row }) => <AdminTokenRowActions row={row} />,
      enableSorting: false,
      enableHiding: false,
      size: 60,
    },
  ]
}
