import { Suspense } from 'react'
import CommandDashboard from '@/components/command/command-dashboard'

export default function CommandPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="text-slate-400 text-sm">Initializing command center...</div>
      </div>
    }>
      <CommandDashboard />
    </Suspense>
  )
}
