export function isCommercialPage(pathname: string): boolean {
  return [
    '/subscriptions',
    '/redemption-codes',
    '/system-settings/billing/payment',
  ].some((path) => pathname === path || pathname.startsWith(`${path}/`))
}
