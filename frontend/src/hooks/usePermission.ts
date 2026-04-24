import { useAuth } from '../contexts/AuthContext'

export function usePermission(modulo: string) {
  const { canDo } = useAuth()
  return {
    canView:   canDo(modulo, 'view'),
    canInsert: canDo(modulo, 'insert'),
    canUpdate: canDo(modulo, 'update'),
    canDelete: canDo(modulo, 'delete'),
  }
}
