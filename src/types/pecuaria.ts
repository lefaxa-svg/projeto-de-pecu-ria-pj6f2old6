export type CategoriaAnimal = 'bezerro' | 'novilha' | 'novilho' | 'vaca' | 'touro'
export type SexoAnimal = 'macho' | 'femea'
export type RacaAnimal =
  | 'Nelore'
  | 'Angus'
  | 'Brahman'
  | 'Guzerá'
  | 'Simental'
  | 'Cruzado'
  | 'Outra'
export type StatusAnimal = 'ativo' | 'vendido' | 'obito' | 'descarte'

export interface Animal {
  id: string
  brinco: string
  nome?: string
  categoria: CategoriaAnimal
  sexo: SexoAnimal
  raca: RacaAnimal
  data_nascimento?: string
  peso_inicial?: number
  status: StatusAnimal
  observacoes?: string
  foto?: string
  dono_id: string
  created: string
  updated: string
  peso_atual?: number
}

export interface Pesagem {
  id: string
  animal_id: string
  data: string
  peso: number
  observacoes?: string
  dono_id: string
  created: string
  updated: string
  expand?: {
    animal_id?: Animal
  }
}

export type TipoReproducao = 'inseminacao' | 'cobertura' | 'parto' | 'aborto'
export type StatusReproducao = 'aguardando' | 'prenha' | 'nao_prenha' | 'nascido'

export interface Reproducao {
  id: string
  animal_id: string
  tipo: TipoReproducao
  data: string
  touro_semen?: string
  status: StatusReproducao
  observacoes?: string
  dono_id: string
  created: string
  updated: string
  expand?: {
    animal_id?: Animal
  }
}

export type TipoSanidade = 'vacina' | 'medicamento' | 'diagnostico' | 'cirurgia'

export interface Sanidade {
  id: string
  animal_id: string
  data: string
  tipo: TipoSanidade
  descricao: string
  produto?: string
  dose?: string
  proxima_dose?: string
  veterinario?: string
  observacoes?: string
  dono_id: string
  created: string
  updated: string
  expand?: {
    animal_id?: Animal
  }
}

export type TipoAlimento = 'silagem' | 'racao' | 'sal_mineral' | 'pasto'

export interface Alimentacao {
  id: string
  animal_id?: string
  data: string
  alimento: TipoAlimento
  quantidade_kg: number
  suplemento?: string
  observacoes?: string
  dono_id: string
  created: string
  updated: string
  expand?: {
    animal_id?: Animal
  }
}

export type TurnoProducao = 'manha' | 'tarde'

export interface ProducaoLeite {
  id: string
  animal_id: string
  data: string
  quantidade_litros: number
  turno: TurnoProducao
  observacoes?: string
  dono_id: string
  created: string
  updated: string
  expand?: {
    animal_id?: Animal
  }
}

export interface UserProfile {
  id: string
  email: string
  name?: string
  fazenda_nome?: string
  avatar?: string
}
