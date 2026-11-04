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
import type { Table } from '@tanstack/react-table'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { DataTableBulkActions as BulkActionsToolbar } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { handleServerError } from '@/lib/handle-server-error'

import { batchDeleteAdminTokens } from '../api'
import type { AdminToken } from '../types'
import { useAdminTokens } from './admin-tokens-provider'

type Props = {
  table: Table<AdminToken>
}

export function AdminTokensBulkActions({ table }: Props) {
  const { t } = useTranslation()
  const { triggerRefresh } = useAdminTokens()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const selectedRows = table.getFilteredSelectedRowModel().rows
  const selectedIds = selectedRows.map((row) => row.original.id)

  const handleConfirm = async () => {
    if (selectedIds.length === 0) return
    setDeleting(true)
    try {
      const res = await batchDeleteAdminTokens(selectedIds)
      if (res.success) {
        toast.success(
          t('Successfully deleted {{count}} token(s)', {
            count: res.data ?? selectedIds.length,
          })
        )
        table.resetRowSelection()
        setConfirmOpen(false)
        triggerRefresh()
      } else {
        handleServerError(res)
      }
    } catch (error) {
      handleServerError(error, t('Failed to delete tokens'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <BulkActionsToolbar table={table} entityName={t('token')}>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant='destructive'
                size='icon'
                className='size-8'
                aria-label={t('Delete selected tokens')}
                disabled={deleting}
                onClick={() => setConfirmOpen(true)}
              />
            }
          >
            <Trash2 aria-hidden='true' />
          </TooltipTrigger>
          <TooltipContent>{t('Delete selected tokens')}</TooltipContent>
        </Tooltip>
      </BulkActionsToolbar>

      <ConfirmDialog
        destructive
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!open && !deleting) setConfirmOpen(false)
        }}
        title={t('Delete {{count}} tokens?', { count: selectedIds.length })}
        desc={t(
          'Clients using these {{count}} tokens will immediately get 401 Unauthorized. This is a soft delete and can be recovered from the database.',
          { count: selectedIds.length }
        )}
        confirmText={t('Delete')}
        isLoading={deleting}
        disabled={selectedIds.length === 0}
        handleConfirm={handleConfirm}
      />
    </>
  )
}
