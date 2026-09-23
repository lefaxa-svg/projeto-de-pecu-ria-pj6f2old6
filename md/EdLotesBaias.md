> **Nota de método**: este documento descreve uma tela de um sistema LEGADO já em produção,
> reconstruída por engenharia reversa do código-fonte — não é uma especificação de feature nova
> obtida por entrevista com um PO. Por isso, toda seção que normalmente viria de uma conversa de
> negócio (motivação, métricas, objetivos) foi preenchida por **inferência a partir do
> comportamento do código**, e está marcada explicitamente como `(inferência)`. Onde nem o código
> nem o contexto do módulo permitem inferir nada com segurança, o campo está como `N/A`.
> Fonte: leitura 100% literal de `Pecuaria/EdLotesBaias.pas` (799 linhas, unit `EdLotesBaias`,
> classe `TfmEdLotesBaias`) e do `.dfm` correspondente (título confirmado "Edição de Cadastro de
> Lotes"), nesta sessão — 77º arquivo `.pas` lido do módulo Pecuária. **Completa `[[LotesBaias]]`**
> (CRUD real, delegado por aquela tela — nota daquela deixa de ser parcial). Chama
> `spMonitoramentoLotes` (não lida — só para obter o Saldo Atual) e abre `[[PrevisoesGPD]]`. Ver
> nota de método completa (limitação de DDL/tipos de coluna) em `[[ExportaDietas]]`, válida para
> todo o módulo.

---

**Status da implementação:** Legado — em produção (documentado via engenharia reversa, sem item de trabalho associado)

**Owner (curadoria):** @jefferson.arantes
**Tags:** #Pecuaria #Lote #SubGrupo #Cadastro #CRUD

---

## 0) Resumo executivo

- **O que é:** tela mestre-detalhe de Inclusão/Edição de um **Lote** (`LotesBaias`, cabeçalho) e
  seus **SubGrupos** (`SubGruposLotes`, detalhe) — o SubGrupo é a unidade real de rastreamento de
  origem/Proprietário/Raça/Categoria de um grupo de animais dentro do Lote físico (já bem
  documentado indiretamente por dezenas de notas anteriores; esta é a tela onde o SubGrupo é
  criado manualmente pela primeira vez, complementando `[[RegistroAutAnimais]]`, que cria
  SubGrupos automaticamente).
- **`cbTipo` (Tipo do Lote) tem 2 conjuntos de opções mutuamente exclusivos**, conforme
  `sTipoRetiro` (herdado do Retiro pai): Confinamento (`'C'`) → Terminação/Suplementação/
  Recepção (`'T'`/`'S'`/`'R'`); Extensiva (`'E'`) → Cria/X-Recria/Engorda (`'C'`/`'X'`/`'E'`) —
  **achado de colisão de código**: o valor `'C'` representa "Cria" no conjunto Extensiva mas
  também é o valor de `sTipoRetiro` para Confinamento — são domínios de campo distintos
  (`LotesBaias.Tipo` vs. `Retiros.Tipo`), mas usam a mesma letra `'C'` com significados
  completamente diferentes — risco de confusão para quem for reimplementar sem atenção ao
  contexto.
- **Categoria do SubGrupo é auto-sugerida por 2 caminhos**: ao informar a Data de Nascimento
  (calcula meses de idade → busca faixa em `Tabelas.Tipo=172`, mesmo mecanismo de
  `[[RegistroAutAnimais]]`/`[[EvolCategorias]]`); e inversamente, ao trocar a Categoria
  manualmente, se a Data de Nascimento ainda não foi informada, ela é retro-calculada a partir do
  **ponto médio da faixa etária** da Categoria escolhida (`IncMonth` pela média de
  `FaixaIdadeIni`/`FaixaIdadeFinal`) — inferência de data quando só a Categoria é conhecida.
- **Impacto principal:** `INSERT`/`UPDATE LotesBaias`; `INSERT`/`UPDATE`/`DELETE
  SubGruposLotes`; bloqueio de exclusão de SubGrupo com Previsões de GPD vinculadas.

---

## 1) Conceito

| Termo | Definição |
|-------|-----------|
| Fechamento do Lote bloqueado se houver saldo de animais | `cdsEdLotesBaiasBeforePost`: muda `Situacao` para `'F'` (Fechado) é bloqueado se `iSaldo > 0` (calculado via `spMonitoramentoLotes` ao abrir a tela) — "Não é possível mudar a situação do lote para fechado, pois contém saldo de animais." — confirma a regra de negócio central da "trava de Lote fechado" já observada indiretamente em várias outras notas (ex.: `TIU_MovAnimais`). |
| `Categoria` propaga `Sexo`/`RendCarcaca`/`KgAbate`/`FatRatCons` automaticamente | `gdLotesSubGruposDBTableView1CategoriaPropertiesEditValueChanged`: ao trocar a Categoria, herda `Conversor` (`FatRatCons`) da Categoria; se o Sexo da Categoria difere do Sexo atual do SubGrupo, também atualiza `RendCarcaca`/`KgAbate` a partir dos parâmetros do Retiro (`dRCM`/`dRCF`/`dPesoM`/`dPesoF`, carregados de `ParamRetiro` — mesmos parâmetros já vistos em `[[RegistroAutAnimais]]`) e o próprio `Sexo`. |
| Exclusão de SubGrupo bloqueada se houver Previsões de GPD | `cdsSubGruposLotesBeforeDelete`: verifica `PrevisoesGPD.SubGrupo` antes de permitir excluir — força o usuário a lidar com as Previsões (em `[[PrevisoesGPD]]`) antes. |
| Destaque visual de SubGrupos "sem Movimento" | `gdLotesSubGruposDBTableView1StylesGetContentStyle`: destaca (`cxStyleEvidence`) SubGrupos onde `TemMovimento > 0` (índice de coluna 14) — na leitura do SQL (`ISNULL(M.Sequencial, 0) TemMovimento`), o destaque na verdade marca os que **JÁ TÊM** `MovAnimais.TipoMov='E'` vinculado — provavelmente para alertar visualmente que aquele SubGrupo já não é mais "editável livremente" (já gerou movimentação real). |
| `FormClose` usa `.Tag` do formulário para devolver o SubGrupo criado ao chamador | Comentário explícito no código: "Utilizado na Inclusão da tela de Processamento (RegProcess)" — `fmEdLotesBaias.Tag := cdsSubGruposLotes.Sequencial` — confirma que `[[RegProcess]]` (o maior arquivo do módulo, lido e documentado integralmente) abre esta tela para criar um novo Lote/SubGrupo e recupera o SubGrupo criado via `Tag` após o fechamento. |

---

## 2) Dicionário de campos da tela (`.dfm`)

| Controle | Classe | Rótulo/Caption | Vinculado a (campo BD) | Obrigatório | Observações |
|---|---|---|---|---|---|
| `teDescricao` | `TcxDBTextEdit` | — | `LotesBaias.Descricao` | Sim | — |
| `lkUnidOcupacao` | `TcxDBLookupComboBox` | — | `LotesBaias.UnidOcup` | Sim | — |
| `deData` | `TcxDBDateEdit` | — | `LotesBaias.Data` | Sim | Default: hoje. |
| `lkBrinco` | `TcxDBLookupComboBox` | — | `LotesBaias.CorBrinco` (Tipo=178) | Sim | — |
| `cbTipo` | `TcxDBComboBox` | — | `LotesBaias.Tipo` | Sim | 2 conjuntos de opções (ver Conceito). |
| `cbModNegocio` | `TcxDBComboBox` | — | `LotesBaias.ModNegocio` | Sim | Gado Próprio/Boitel(Diárias)/Parceria em @. |
| `cbSituacao` | `TcxDBComboBox` | — | `LotesBaias.Situacao` | — | Fechado/Parcialmente Vendido/Aberto; trava se saldo>0. |
| `ckTratar`/`ckRelatorios` | `TcxDBCheckBox` | — | `LotesBaias.Tratar`/`Relatorios` | — | — |
| `cePercPesagem` | `TcxDBCurrencyEdit` | — | `LotesBaias.PercPesagem` | — | Default herdado de `ParamRetiro`. |
| Grid `gdLotesSubGrupos` | `TcxGridDBTableView` | Data Entrada/Proprietário/Raça/Categoria/Sexo/Castrado/Fat.Rat.Cons/Rend.Carcaça/Kg Abate/GPD/Data Nascimento/Principal/Tem Movimento | `cdsSubGruposLotes` | — | Detalhe; destaque visual para SubGrupos com Movimento. |
| `btnPrevisoesGPD` | `TcxButton` | — | — | Abre `[[PrevisoesGPD]]` para o SubGrupo focado. |

---

## 5) Jornada do usuário + Especificação funcional

### SP-01 — Abrir a tela (`FormShow`)
Monta opções de `cbTipo` conforme `sTipoRetiro`; carrega o Lote (`iSeq`); busca Saldo Atual via
`spMonitoramentoLotes` (se edição); carrega U.O./Cores de Brinco/Raças/Categorias; carrega
parâmetros do Retiro (`ParamRetiro`); modo Inclusão se `iSeq=0`.

### SP-02 — Gravar o Lote mestre (`cdsEdLotesBaiasBeforePost`)
Valida Descrição/U.O./Data/Cor Brinco/Tipo/Modalidade de Negócio; bloqueia fechar Lote com saldo
(ver Conceito); se inserção, gera `Lote` via `LoadSequencia`, `Situacao='A'` (Aberto).

### SP-03 — Incluir/Editar SubGrupo do detalhe
Defaults: Castrado='N', Data Entrada=hoje, Principal='N', herda Proprietário se `iProprietario`
setado externamente pelo chamador; valida Data Entrada/Proprietário/Raça/Categoria obrigatórios;
gera `Sequencial` via `LoadSequencia`.

### SP-04 — Categoria ↔ Data de Nascimento (bidirecional, ver Conceito)

### SP-05 — Excluir SubGrupo
Bloqueia se houver `PrevisoesGPD` vinculadas.

### SP-06 — Previsões de GPD (`btnPrevisoesGPDClick`) → `[[PrevisoesGPD]]`
Exige Lote e SubGrupo salvos.

### 5.3 Regras de negócio e validações

- **BR-001 a BR-005 — validações do mestre:** Descrição, U.O., Data, Cor do Brinco, Tipo,
  Modalidade de Negócio obrigatórios.
- **BR-006 — Fechamento do Lote bloqueado com saldo de animais > 0.**
- **BR-007 — validações do detalhe:** Data de Entrada, Proprietário, Raça, Categoria
  obrigatórios.
- **BR-008 — Exclusão de SubGrupo bloqueada com Previsões de GPD.**
- **BR-009 — Inserção de SubGrupo exige o Lote já salvo.**

---

## 6) Integrações e dados

### 6.1 Integrações (internas)

- **`[[LotesBaias]]`** — tela chamadora (consulta/listagem).
- **`[[PrevisoesGPD]]`** — manipulação de previsões do SubGrupo.
- **`spMonitoramentoLotes`** — obtém Saldo Atual (não lida, só usada para 1 valor de saída).
- **`ParamRetiro`** — origem de `RendCarcacaM/F`/`PesoAbateM/F`/`PercPesagem`.
- **[[RegProcess]]** (lido e documentado integralmente) — confirmado como chamador, via mecanismo
  de retorno por `.Tag` no `FormClose`.

### 6.2 Modelo de dados

Tabelas `LotesBaias`/`SubGruposLotes` já parcialmente documentadas em notas anteriores — sem
campos novos além dos já confirmados aqui (`PercPesagem`, `Situacao` com 3 valores A/P/F,
`ModNegocio` com G/B/P confirmados).

### 6.3 Triggers e Procedures do banco

**`[[TIU_LotesBaias]]`** (achado, auditoria 2026-09-02) — dispara no `INSERT`/`UPDATE LotesBaias`
desta unit (não estava cruzada; já documentada em `[[LotesBaias]]` a partir da tela de consulta,
mas não vinculada aqui, que é quem efetivamente grava) — erro 31000 se a U.O. selecionada já tiver
outro Lote aberto. Chamadas indiretas via `spMonitoramentoLotes` (não lida em profundidade).

---

## 7) Suporte: FAQ, mensagens, erros e troubleshooting

### 7.2 Catálogo de mensagens e erros

| Mensagem exata | Causa |
|---|---|
| "Indique uma Descrição/Unidade de Ocupação/Data/Cor do Brinco/Tipo/Modalidade de Negócio Válida." | Validação do mestre |
| "Não é possível mudar a situação do lote para fechado, pois contém saldo de animais." | Fechamento bloqueado |
| "Indique a Data de Entrada/o Proprietário/a Raça/a Categoria." | Validação do detalhe |
| "Existem Previsões G.P.D. para esse SubGrupo, Verifique!" | Exclusão bloqueada |
| "Salve o Lote/SubGrupo para Inserir SubGrupos/Manipular Previsões G.P.D.." | Ações sem pré-condição salva |
| "Código do Proprietário Inválido." | Busca de Pessoa sem correspondência |

---

## 9) Notas de revisão

- **2026-09-02** (auditoria campo-a-campo — módulo Pecuária)
  - **O que mudou:** identificada `[[TIU_LotesBaias]]` como trigger disparada por esta unit
    (`INSERT`/`UPDATE LotesBaias`) — já era conhecida via `[[LotesBaias]]`, mas não estava
    cruzada aqui, que é a unit que efetivamente grava.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** ver `[[TIU_LotesBaias]]`.

- **2026-08-28** (criação da nota — módulo Pecuária)
  - **O que mudou:** nota criada do zero, a partir de leitura 100% literal de
    `Pecuaria/EdLotesBaias.pas` (799 linhas) + `.dfm` (título confirmado "Edição de Cadastro de
    Lotes"). Completa `[[LotesBaias]]`. Documentado o CRUD mestre-detalhe Lote/SubGrupo, a
    propagação automática de Categoria→Sexo/Rend.Carcaça/Kg Abate, e a trava de fechamento com
    saldo. Achado: colisão de significado do valor `'C'` entre `LotesBaias.Tipo` (Cria, em
    Extensiva) e `Retiros.Tipo` (Confinamento). Confirmado `RegProcess.pas` como possível
    chamador via retorno por `.Tag`.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** código-fonte `Pecuaria/EdLotesBaias.pas` + `.dfm`; ver `[[LotesBaias]]`,
    `[[PrevisoesGPD]]`, `[[RegistroAutAnimais]]`, `[[EvolCategorias]]`, `[[ParamRetiro]]`.
    Pendente: `spMonitoramentoLotes`, `RegProcess.pas`.
