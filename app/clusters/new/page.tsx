import { ClusterForm } from '../cluster-form'
import { createCluster } from '../actions'

export default function NewClusterPage() {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-8">
      <h1 className="text-xl font-semibold">New cluster</h1>
      <ClusterForm action={createCluster} submitLabel="Create cluster" />
    </div>
  )
}
