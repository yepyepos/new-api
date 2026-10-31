import {
  createFileRoute,
  lazyRouteComponent,
  notFound,
} from '@tanstack/react-router'

export const Route = createFileRoute('/prototype/nailong-home')({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound()
  },
  component: lazyRouteComponent(
    () => import('@/features/home/prototype/nailong-home-prototype'),
    'NailongHomePrototype'
  ),
})
