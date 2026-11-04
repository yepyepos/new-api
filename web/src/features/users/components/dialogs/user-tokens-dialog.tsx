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
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import {
  DataTableRowActionMenu,
  StaticDataTable,
} from '@/components/data-table'
import {
  sideDrawerContentClassName,
  sideDrawerFormClassName,
  sideDrawerHeaderClassName,
} from '@/components/drawer-layout'
import { StatusBadge } from '@/components/status-badge'
import { TableId } from '@/components/table-id'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenuItem,
  DropdownMenuShortcut,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { API_KEY_STATUSES } from '@/features/keys/constants'
import type { ApiKey } from '@/features/keys/types'
import { formatQuota, formatTimestamp } from '@/lib/format'
import { handleServerError } from '@/lib/handle-server-error'

import { deleteUserToken, deleteUserTokensBatch, getUserTokens } from '../../api'

const PAGE_SIZE = 50

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: { id: number; username?: string } | null
  onSuccess?: () => void
}

export function UserTokensDialog(props: Props) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [tokens, setTokens] = useState<ApiKey[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [confirmToken, setConfirmToken] = useState<ApiKey | null>(null)
  const [batchConfirmOpen, setBatchConfirmOpen] = useState(false)

  const loadData = useCallback(
    async (targetPage: number) => {
      if (!props.user?.id) return
      setLoading(true)
      try {
        const res = await getUserTokens(props.user.id, {
          p: targetPage,
          size: PAGE_SIZE,
        })
        if (res.success) {
          setTokens(res.data?.items ?? [])
          setTotal(res.data?.total ?? 0)
        } else {
          handleServerError(res)
        }
      } catch (error) {
        handleServerError(error, t('Loading failed'))
      } finally {
        setLoading(false)
      }
    },
    [props.user?.id, t]
  )

  useEffect(() => {
    if (props.open && props.user?.id) {
      setPage(1)
      setConfirmToken(null)
      setBatchConfirmOpen(false)
      setSelectedIds(new Set())
      loadData(1)
    }
  }, [props.open, props.user?.id, loadData])

  const goToPage = (nextPage: number) => {
    setPage(nextPage)
    setSelectedIds(new Set())
    loadData(nextPage)
  }

  const pageIds = useMemo(() => tokens.map((token) => token.id), [tokens])
  const selectedOnPageCount = pageIds.filter((id) =>
    selectedIds.has(id)
  ).length
  const allSelected =
    pageIds.length > 0 && selectedOnPageCount === pageIds.length
  const someSelected = selectedOnPageCount > 0 && !allSelected

  const toggleRow = (id: number, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(id)
      } else {
        next.delete(id)
      }
      return next
    })
  }

  const toggleAll = (checked: boolean) => {
    setSelectedIds(() => (checked ? new Set(pageIds) : new Set()))
  }

  const handleConfirmDelete = async () => {
    if (!props.user?.id || !confirmToken) return
    setDeleting(true)
    try {
      const res = await deleteUserToken(props.user.id, confirmToken.id)
      if (res.success) {
        toast.success(t('Deleted'))
        setConfirmToken(null)
        setSelectedIds((prev) => {
          const next = new Set(prev)
          next.delete(confirmToken.id)
          return next
        })
        const nextPage = tokens.length === 1 && page > 1 ? page - 1 : page
        setPage(nextPage)
        await loadData(nextPage)
        props.onSuccess?.()
      } else {
        handleServerError(res)
      }
    } catch (error) {
      handleServerError(error, t('Operation failed'))
    } finally {
      setDeleting(false)
    }
  }

  const handleConfirmBatchDelete = async () => {
    if (!props.user?.id || selectedIds.size === 0) return
    const ids = Array.from(selectedIds)
    setDeleting(true)
    try {
      const res = await deleteUserTokensBatch(props.user.id, ids)
      if (res.success) {
        toast.success(
          t('Successfully deleted {{count}} API key(s)', {
            count: res.data ?? ids.length,
          })
        )
        setBatchConfirmOpen(false)
        setSelectedIds(new Set())
        const removedOnPage = ids.filter((id) => pageIds.includes(id)).length
        const remainsOnPage = pageIds.length - removedOnPage
        const nextPage = remainsOnPage === 0 && page > 1 ? page - 1 : page
        setPage(nextPage)
        await loadData(nextPage)
        props.onSuccess?.()
      } else {
        handleServerError(res)
      }
    } catch (error) {
      handleServerError(error, t('Operation failed'))
    } finally {
      setDeleting(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <>
      <Sheet open={props.open} onOpenChange={props.onOpenChange}>
        <SheetContent className={sideDrawerContentClassName('sm:max-w-3xl')}>
          <SheetHeader className={sideDrawerHeaderClassName()}>
            <SheetTitle>{t('User API Keys')}</SheetTitle>
            <SheetDescription>
              {props.user?.username || '-'} (ID: {props.user?.id || '-'})
            </SheetDescription>
          </SheetHeader>

          <div className={sideDrawerFormClassName()}>
            {selectedIds.size > 0 && (
              <div className='flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm'>
                <span>
                  {t('{{count}} selected', { count: selectedIds.size })}
                </span>
                <div className='flex gap-2'>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => setSelectedIds(new Set())}
                  >
                    {t('Clear selection')}
                  </Button>
                  <Button
                    variant='destructive'
                    size='sm'
                    disabled={deleting}
                    onClick={() => setBatchConfirmOpen(true)}
                  >
                    <Trash2 className='mr-1 h-4 w-4' />
                    {t('Delete selected')}
                  </Button>
                </div>
              </div>
            )}

            <StaticDataTable
              data={loading ? [] : tokens}
              getRowKey={(record) => record.id}
              emptyClassName={loading ? 'py-8' : 'text-muted-foreground py-8'}
              emptyContent={loading ? t('Loading...') : t('No API keys')}
              columns={[
                {
                  id: 'select',
                  header: (
                    <Checkbox
                      checked={allSelected}
                      indeterminate={someSelected}
                      disabled={loading || pageIds.length === 0}
                      onCheckedChange={(value) => toggleAll(value === true)}
                      aria-label={t('Select all')}
                    />
                  ),
                  className: 'w-10',
                  cellClassName: 'w-10',
                  cell: (record) => (
                    <Checkbox
                      checked={selectedIds.has(record.id)}
                      onCheckedChange={(value) =>
                        toggleRow(record.id, value === true)
                      }
                      aria-label={t('Select row')}
                    />
                  ),
                },
                {
                  id: 'id',
                  header: t('ID'),
                  cell: (record) => <TableId value={record.id} />,
                },
                {
                  id: 'name',
                  header: t('Name'),
                  cell: (record) => (
                    <div className='font-medium'>{record.name || '-'}</div>
                  ),
                },
                {
                  id: 'key',
                  header: t('Key'),
                  cell: (record) => (
                    <code className='text-muted-foreground font-mono text-xs'>
                      sk-{record.key}
                    </code>
                  ),
                },
                {
                  id: 'status',
                  header: t('Status'),
                  cell: (record) => {
                    const statusConfig = API_KEY_STATUSES[record.status]

                    return statusConfig ? (
                      <StatusBadge
                        label={t(statusConfig.label)}
                        variant={statusConfig.variant}
                        copyable={false}
                      />
                    ) : null
                  },
                },
                {
                  id: 'quota',
                  header: t('Total Quota'),
                  cell: (record) => {
                    if (record.unlimited_quota) return t('Unlimited')
                    const remain = Number(record.remain_quota || 0)

                    return (
                      <div className='text-sm'>
                        <div>
                          {t('Remaining')}: {formatQuota(remain)}
                        </div>
                        <div className='text-muted-foreground'>
                          {t('Used')}: {formatQuota(Number(record.used_quota || 0))}
                        </div>
                      </div>
                    )
                  },
                },
                {
                  id: 'created',
                  header: t('Created At'),
                  cell: (record) => (
                    <div className='text-sm'>
                      <div>{formatTimestamp(record.created_time)}</div>
                      <div className='text-muted-foreground'>
                        {t('Last used')}:{' '}
                        {record.accessed_time
                          ? formatTimestamp(record.accessed_time)
                          : '-'}
                      </div>
                    </div>
                  ),
                },
                {
                  id: 'expires',
                  header: t('Expires'),
                  cell: (record) =>
                    record.expired_time === -1 ? (
                      <span className='text-sm'>{t('Never')}</span>
                    ) : (
                      <span className='text-sm'>
                        {formatTimestamp(record.expired_time)}
                      </span>
                    ),
                },
                {
                  id: 'actions',
                  header: t('Actions'),
                  className: 'text-right',
                  cellClassName: 'text-right',
                  cell: (record) => (
                    <DataTableRowActionMenu ariaLabel={t('Actions')}>
                      <DropdownMenuItem
                        variant='destructive'
                        onClick={() => setConfirmToken(record)}
                      >
                        {t('Delete')}
                        <DropdownMenuShortcut>
                          <Trash2 size={16} />
                        </DropdownMenuShortcut>
                      </DropdownMenuItem>
                    </DataTableRowActionMenu>
                  ),
                },
              ]}
            />

            {total > PAGE_SIZE && (
              <div className='flex items-center justify-between gap-2 text-sm'>
                <span className='text-muted-foreground'>
                  {t('Page {{page}} of {{total}}', {
                    page,
                    total: totalPages,
                  })}
                </span>
                <div className='flex gap-2'>
                  <Button
                    variant='outline'
                    size='sm'
                    disabled={loading || page <= 1}
                    onClick={() => goToPage(page - 1)}
                  >
                    <ChevronLeft className='mr-1 h-4 w-4' />
                    {t('Previous')}
                  </Button>
                  <Button
                    variant='outline'
                    size='sm'
                    disabled={loading || page >= totalPages}
                    onClick={() => goToPage(page + 1)}
                  >
                    {t('Next')}
                    <ChevronRight className='ml-1 h-4 w-4' />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {confirmToken && (
        <ConfirmDialog
          open
          onOpenChange={(v) => !v && setConfirmToken(null)}
          title={t('Delete API key')}
          desc={t(
            'Delete API key "{{name}}"? The client using it will immediately get 401 Unauthorized. This is a soft delete and can be recovered from the database.',
            { name: confirmToken.name || `#${confirmToken.id}` }
          )}
          confirmText={t('Delete')}
          destructive
          isLoading={deleting}
          handleConfirm={handleConfirmDelete}
        />
      )}

      {batchConfirmOpen && (
        <ConfirmDialog
          open
          onOpenChange={(v) => !v && setBatchConfirmOpen(false)}
          title={t('Delete {{count}} API key(s)?', {
            count: selectedIds.size,
          })}
          desc={t(
            'Clients using these {{count}} API keys will immediately get 401 Unauthorized. This is a soft delete and can be recovered from the database.',
            { count: selectedIds.size }
          )}
          confirmText={t('Delete')}
          destructive
          isLoading={deleting}
          handleConfirm={handleConfirmBatchDelete}
        />
      )}
    </>
  )
}
