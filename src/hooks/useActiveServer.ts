import { useAuth } from '../context/AuthContext'

export function useActiveServer(): string | undefined {
  const { activeServer } = useAuth()
  return activeServer ?? undefined
}
