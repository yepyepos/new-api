import { api } from '@/lib/api'
import { requireServerSuccess } from '@/lib/server-error-message'

export type RegistrationBatch = {
  enabled: boolean
  limit: number
  used: number
}
export type RegistrationInvite = {
  id: number
  name: string
  max_uses: number
  used: number
  exempt: boolean
  disabled: boolean
  expires_at: number
}
export type RegistrationAdmissionData = {
  batch: RegistrationBatch
  ordinary_open: boolean
  invites: RegistrationInvite[]
}

type Response<T> = { success: boolean; message?: string; data: T }

export async function getRegistrationAdmission() {
  const response = await api.get<Response<RegistrationAdmissionData>>(
    '/api/option/registration'
  )
  return requireServerSuccess(response.data).data
}

export async function saveRegistrationBatch(
  request: Omit<RegistrationBatch, 'used'> & { reset: boolean }
) {
  const response = await api.put('/api/option/registration/batch', request)
  return requireServerSuccess(response.data)
}

export async function createRegistrationInvitation(request: {
  name: string
  max_uses: number
  exempt: boolean
  expires_at: number
}) {
  const response = await api.post<
    Response<{ code: string; invite: RegistrationInvite }>
  >('/api/option/registration/invites', request)
  return requireServerSuccess(response.data).data
}

export async function disableRegistrationInvitation(id: number) {
  const response = await api.delete(`/api/option/registration/invites/${id}`)
  return requireServerSuccess(response.data)
}
