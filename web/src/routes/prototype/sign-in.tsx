import {
  createFileRoute,
  lazyRouteComponent,
  notFound,
} from '@tanstack/react-router'
import { z } from 'zod'

// Read-only design preview: separate from sign-in so existing sessions stay intact.
export const Route = createFileRoute('/prototype/sign-in')({
  validateSearch: z.object({ variant: z.enum(['A', 'B', 'C']).catch('A') }),
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound()
  },
  component: lazyRouteComponent(
    () => import('@/features/auth/prototype/sign-in-prototype'),
    'SignInPrototype'
  ),
})
