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
import type { Row } from '@tanstack/react-table'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { DataTableRowActionMenu } from '@/components/data-table'
import {
  DropdownMenuItem,
  DropdownMenuShortcut,
} from '@/components/ui/dropdown-menu'
import { handleServerError } from '@/lib/handle-server-error'

import { deleteAdminToken } from '../api'
import type { AdminToken } from '../types'
import { useAdminTokens } from './admin-tokens-provider'

interface Props<TData> {
  row: Row<TData>
}

export function AdminTokenRowActions<TData>({ row }: Props<TData>) {
  const { t } = useTranslation()
  const { triggerRefresh } = useAdminTokens()
  const token = row.original as AdminToken
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await deleteAdminToken(token.id)
      if (res.success) {
        toast.success(t('Deleted'))
        setConfirmOpen(false)
        row.toggleSelected(false)
        triggerRefresh()
      } else {
        handleServerError(res)
      }
    } catch (error) {
      handleServerError(error, t('Operation failed'))
    } finally {
      setDeleting(false)
    }
  }

  const label = token.name?.trim() || `#${token.id}`

  return (
    <>
      <DataTableRowActionMenu ariaLabel={t('Actions')}>
        <DropdownMenuItem
          variant='destructive'
          onClick={() => setConfirmOpen(true)}
        >
          {t('Delete')}
          <DropdownMenuShortcut>
            <Trash2 size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
      </DataTableRowActionMenu>

      {confirmOpen && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setConfirmOpen(false)}
          title={t('Delete token')}
          desc={t(
            'Delete token "{{name}}" of user {{username}}? The client using this key will immediately get 401 Unauthorized. This is a soft delete and can be recovered from the database.',
            { name: label, username: token.username || `#${token.user_id}` }
          )}
          confirmText={t('Delete')}
          destructive
          isLoading={deleting}
          handleConfirm={handleDelete}
        />
      )}
    </>
  )
}
