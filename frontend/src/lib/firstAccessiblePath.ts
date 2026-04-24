const MODULE_DEFAULT_PATHS: [string, string][] = [
  ['dashboard', '/dashboard'],
  ['relatorios', '/relatorios'],
  ['perfil_oss', '/perfil-oss'],
  ['entrada_mensal', '/entrada-mensal'],
  ['aprovacao', '/aprovacao'],
  ['oss', '/oss'],
  ['contratos', '/contratos'],
  ['unidades', '/unidades'],
  ['indicadores', '/indicadores'],
  ['metas', '/metas'],
  ['usuarios', '/admin/usuarios'],
  ['permissoes', '/admin/permissoes'],
]

export function firstAccessiblePath(
  canDo: (modulo: string, action: 'view' | 'insert' | 'update' | 'delete') => boolean,
): string {
  for (const [mod, path] of MODULE_DEFAULT_PATHS) {
    if (canDo(mod, 'view')) return path
  }
  return '/login'
}
