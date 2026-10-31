import {
  createFileRoute,
  lazyRouteComponent,
  notFound,
} from '@tanstack/react-router'

export const Route = createFileRoute('/prototype/nailong')({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound()
  },
  component: lazyRouteComponent(
    () => import('@/features/auth/prototype/nailong-prototype'),
    'NailongPrototype'
  ),
})
