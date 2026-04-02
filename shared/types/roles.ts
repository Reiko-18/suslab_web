export type DashboardRole = 'member' | 'moderator' | 'admin'

export const ROLE_HIERARCHY: Record<DashboardRole, number> = {
  member: 1,
  moderator: 2,
  admin: 3,
} as const

export function hasMinimumRole(userRole: DashboardRole, minimumRole: DashboardRole): boolean {
  return (ROLE_HIERARCHY[userRole] ?? 0) >= (ROLE_HIERARCHY[minimumRole] ?? 0)
}
