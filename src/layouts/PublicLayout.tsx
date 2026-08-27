import { AnimatedOutlet } from '@/components/motion/AnimatedOutlet'

export function PublicLayout() {
  return (
    <div className="app-shell min-h-dvh bg-transparent">
      <main className="mx-auto min-h-dvh w-full max-w-lg">
        <AnimatedOutlet />
      </main>
    </div>
  )
}
