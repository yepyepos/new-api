import { useStatus } from './use-status'

export function usePublicBenefitMode(): boolean {
  const { status } = useStatus()
  return status?.public_benefit_mode_enabled === true
}
