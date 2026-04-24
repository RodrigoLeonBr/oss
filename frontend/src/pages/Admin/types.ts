import type { Perfil, Usuario, PermissaoPerfil } from '../../types'

export type { Usuario, PermissaoPerfil }

export const PERFIS_LIST: Perfil[] = [
  'admin', 'gestor_sms', 'auditora', 'conselheiro_cms',
  'contratada_scmc', 'contratada_indsh', 'central_regulacao', 'visualizador',
]

export const PERFIL_LABELS: Record<Perfil, string> = {
  admin:              'Administrador',
  gestor_sms:         'Gestor SMS',
  auditora:           'Auditora',
  conselheiro_cms:    'Conselheiro CMS',
  contratada_scmc:    'Contratada SCMC',
  contratada_indsh:   'Contratada INDSH',
  central_regulacao:  'Central de Regulação',
  visualizador:       'Visualizador',
}

export const MODULOS_LIST = [
  'dashboard', 'entrada_mensal', 'aprovacao', 'relatorios',
  'perfil_oss', 'oss', 'contratos', 'unidades',
  'indicadores', 'metas', 'usuarios', 'permissoes',
] as const

export const MODULO_LABELS: Record<string, string> = {
  dashboard:      'Dashboard',
  entrada_mensal: 'Entrada Mensal',
  aprovacao:      'Aprovação',
  relatorios:     'Relatórios CMS',
  perfil_oss:     'Perfil OSS',
  oss:            'Organizações Sociais',
  contratos:      'Contratos de Gestão',
  unidades:       'Unidades de Saúde',
  indicadores:    'Indicadores',
  metas:          'Metas Anuais',
  usuarios:       'Usuários',
  permissoes:     'Permissões',
}

export interface UsuarioFormData {
  nome: string
  email: string
  perfil: Perfil
  oss_id: string
  telefone: string
  senha: string
  ativo: boolean
}
