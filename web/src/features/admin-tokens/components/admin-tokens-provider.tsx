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
import React, { useState } from 'react'

type TokensContextType = {
  refreshTrigger: number
  triggerRefresh: () => void
  selectedIds: number[]
  setSelectedIds: React.Dispatch<React.SetStateAction<number[]>>
}

const TokensContext = React.createContext<TokensContextType | null>(null)

export function AdminTokensProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [selectedIds, setSelectedIds] = useState<number[]>([])

  const triggerRefresh = () => setRefreshTrigger((prev) => prev + 1)

  return (
    <TokensContext
      value={{
        refreshTrigger,
        triggerRefresh,
        selectedIds,
        setSelectedIds,
      }}
    >
      {children}
    </TokensContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAdminTokens = () => {
  const context = React.useContext(TokensContext)

  if (!context) {
    throw new Error('useAdminTokens has to be used within <AdminTokensProvider>')
  }

  return context
}
