import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/documents_/$id/permissions')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/documents_/$id/permissions"!</div>
}
