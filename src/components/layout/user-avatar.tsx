import { ImageIcon } from 'lucide-react'
import type { User } from '@/contracts'
import { cn } from '@/lib/utils'

export function UserAvatar({ user, className }: { user: Pick<User, 'displayName' | 'avatarUrl'>; className?: string }) {
  if (user.avatarUrl) {
    return <img src={user.avatarUrl} alt="" className={cn('rounded-full object-cover', className)} width={48} height={48} />
  }
  const initial = user.displayName.trim().charAt(0).toUpperCase()
  return (
    <span
      className={cn('grid place-items-center rounded-full border border-primary/40 bg-secondary font-bold text-amber', className)}
      aria-hidden
    >
      {initial || <ImageIcon className="size-5" />}
    </span>
  )
}
