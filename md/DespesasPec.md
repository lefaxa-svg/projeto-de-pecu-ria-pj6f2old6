> **Nota de método**: este documento descreve uma tela de um sistema LEGADO já em produção,
> reconstruída por engenharia reversa do código-fonte — não é uma especificação de feature nova
> obtida por entrevista com um PO. Por isso, toda seção que normalmente viria de uma conversa de
> negócio (motivação, métricas, objetivos) foi preenchida por **inferência a partir do
> comportamento do código**, e está marcada explicitamente como `(inferência)`. Onde nem o código
> nem o contexto do módulo permitem inferir nada com segurança, o campo está como `N/A`.
> Fonte: leitura 100% literal de `Pecuaria/DespesasPec.pas` (887 linhas, unit `DespesasPec`,
> classe `TfmDespesasPec`) e do `.dfm` correspondente (título confirmado "Despesas do Lote"),
> nesta sessão — 81º arquivo `.pas` lido do módulo Pecuária. **Tela satélite (recebe
> `lblLote.Tag`/`lblRetiro.Tag` do chamador — confirmado como `[[MonitoramentoBaiasLotes]]`, ver
> "9) Notas de revisão")** — resolve a origem do CRUD de
> `DespesasPec`, tabela central de custos já consumida por `[[spVisualizaBrincos]]`,
> `[[spConsultaDespFech]]` e `[[spCustoBrincoPec]]`. Chama `[[spDespOutrosLotes]]` (121 linhas,
> lida integralmente nesta sessão). Ver nota de método completa (limitação de DDL/tipos de
> coluna) em `[[ExportaDietas]]`, válida para todo o módulo.

---

**Status da implementação:** Legado — em produção (documentado via engenharia reversa, sem item de trabalho associado)

**Owner (curadoria):** @jefferson.arantes
**Tags:** #Pecuaria #Despesa #Custo #Estoque #CRUD

---

## 0) Resumo executivo

- **O que é:** CRUD completo de **Despesas de um Lote** (`DespesasPec`) — lançamento manual de
  custos (Produto/Quantidade/Valor) atribuídos a um Lote inteiro, a um SubGrupo específico, ou a
  um Brinco individual (3 granularidades, já documentadas como achado em `[[spConsultaDespFech]]`/
  `[[spCustoBrincoPec]]` — esta é a tela onde essa granularidade é definida pelo usuário).
- **"Gerar Movimentação de Estoque" / "Estornar"** — cada Despesa pode gerar um `DocEstoque`/
  `ItDocEstoque` simbólico (Saída de estoque, `Origem='M'`), vinculado via
  `DespesasPec.ItDocEstoque` — mesmo padrão de "documento de estoque simbólico" já visto em
  `[[CustoRacoes]]`/`[[spGeraCustoDieta]]` e `[[RecepcaoIngredientes]]`. O **Estorno** desfaz a
  geração — remove o vínculo, exclui o item, e **exclui o Documento de Estoque inteiro se essa
  era a única linha** (`bDelDoc`).
- **Aba "Outros Lotes"** (2º nível de grid) — mostra despesas **herdadas de Lotes anteriores**,
  via `[[spDespOutrosLotes]]`, que navega retroativamente a linhagem de SubGrupo (mesma técnica
  já vista em `[[spVisualizaBrincos]]`/`[[spConsultaDespFech]]`) e **rateia** o valor das
  despesas do Lote de origem proporcionalmente à quantidade de animais que foi efetivamente
  transferida — carregada sob demanda só quando essa aba é ativada.
- **Impacto principal:** `INSERT`/`UPDATE`/`DELETE DespesasPec`; `INSERT DocEstoque`/
  `ItDocEstoque` + `UPDATE DespesasPec.ItDocEstoque` (Gerar); `DELETE ItDocEstoque`/`DocEstoque`
  (condicional) + `UPDATE DespesasPec.ItDocEstoque=Null` (Estornar).

---

## 1) Conceito

| Termo | Definição |
|-------|-----------|
| "Gerar" disponível apenas se `ParamRetiro.MovEstoqueDesp='S'` | `btnGerar.Enabled` combina permissão de usuário **e** um parâmetro do Retiro — nem todo Retiro usa a integração de Despesas↔Estoque; achado: parâmetro de configuração por Retiro não documentado em nenhuma nota anterior de `[[ParamRetiro]]`. |
| Edição/Exclusão bloqueadas se já gerado o Estoque, ou se vinculado a Hospitalização | `cdsDespesasBeforeEdit`/`BeforeDelete`: `ItDocEstoque>0` bloqueia (mesma trava recorrente do módulo); `Hospital>0` também bloqueia — despesas com `Hospital` preenchido são inseridas/editadas na própria tela `[[Hospitalizacoes]]` (grade de detalhe, mesma tabela `DespesasPec`), não aqui. |
| Conversão de Unidade Alternativa (`UnidProdAlter`/`QtdAlter`/`VlrUnitAlter`) | O usuário digita Quantidade/Valor na "unidade alternativa" do Produto (ex.: Saco), e a tela converte para a unidade padrão (`Qtd`/`VlrUnit`) via `ConverteUnid` (função genérica do ERP) — mesmos campos de unidade alternativa já vistos em `[[spConsultaDespFech]]`. |
| Busca de Preço automática ao informar Data/Produto/Unid.Armaz | `gdDespesasTabelaDataPropertiesEditValueChanged`: busca `dbo.LoadPrecoMat` (preço médio do Produto na Unidade de Armazenagem/Data) — mesmo padrão de preço médio ponderado usado pelo módulo de Estoque genérico do ERP. |
| Brinco pode ser buscado por 3 campos sincronizados | `DescBrinco` (Manejo/SisBov), `BrincoAux`, e o campo interno `Brinco` (Sequencial) — validações (`OnValidate`) em `DescBrinco`/`BrincoAux` resolvem o `Sequencial` via consulta e populam o campo `Brinco` real, com guarda `bHabilita` contra loop. |
| Sem `RoundTo`/`Round` no cálculo de `VlrTotal` (auditoria 2026-09-02) | Confirmado por releitura: `VlrTotal := Qtd * VlrUnit` (2 ocorrências idênticas, linhas 534/623) usa `AsFloat` puro, sem arredondamento explícito — precisão final depende da coluna do banco. |

---

## 2) Dicionário de campos da tela (`.dfm`)

| Controle | Classe | Rótulo/Caption | Vinculado a (campo BD) | Obrigatório | Observações |
|---|---|---|---|---|---|
| `deInicio`/`deFim` | `TcxDateEdit` | — | `DespesasPec.Data` (filtro) | — | Default: ano corrente até hoje. |
| `cbSubGrupos` | `TcxExtLookupComboBox` | — | filtro por SubGrupo | — | — |
| `ceBrincoIni`/`Fim`, `ceBrincoAuxIni`/`Fim` | — | — | filtro por faixa de Brinco/Brinco Auxiliar | — | — |
| `ceProduto` | `TcxCurrencyEdit` | — | filtro por Produto | — | F2 abre ajuda de Produto. |
| `cbUnidArmaz` | `TcxLookupComboBox` | — | filtro por Unidade de Armazenagem | — | — |
| `ceProc`/`ceHospital` | `TcxCurrencyEdit` | — | filtro por Processamento/Hospitalização | — | — |
| `teDocEstoque` | `TcxTextEdit` | — | filtro por número de Doc.Estoque | — | — |
| Grid `gdDespesas` (nível 1) | `TcxGridDBBandedTableView` | Produto/SubGrupo/Brinco/Data/Vlr Total/Unid.Armaz/Vlr Unit/Qtd/Unid.Prod/Processamento/Hospital | `cdsDespesas` | — | Destaque azul se já gerado o Estoque. |
| Grid `gdDespesasOutrosLotes` (nível 2) | `TcxGridDBBandedTableView` | (mesmas colunas + Tipo/Lote) | `cdsOutrosLotes` | — | Carrega sob demanda via `[[spDespOutrosLotes]]`. |
| `mmHistorico` | `TcxDBMemo` | — | `DespesasPec.Historico` | — | Fonte de dados alterna entre as 2 abas. |
| `btnGerar` (dropdown `pmMovEstoque`) | `TcxButton` | — | — | — | "Gerar Movimentação" / "Estornar Movimentação". |

---

## 5) Jornada do usuário + Especificação funcional

### SP-01 — Abrir a tela (`FormShow`)
Verifica permissão + parâmetro `MovEstoqueDesp`; carrega Unidades de Armazenagem/Unidades de
Medida/SubGrupos do Lote; período padrão = ano corrente.

### SP-02 — Consultar (`btnConsultarClick`)
`SELECT DespesasPec JOIN Materiais/Tabelas LEFT JOIN BrincosIndividuais/ItDocEstoque/DocEstoque`,
filtrado sempre por `Lote`; se a aba "Outros Lotes" estiver ativa, também chama
`[[spDespOutrosLotes]]`.

### SP-03 — Incluir/Editar/Excluir Despesa (grade editável inline)
Bloqueia edição/exclusão se já gerado Estoque ou vinculado a Hospitalização.

### SP-04 — Gravar (`cdsDespesasBeforePost`)
Valida Data/Produto/Unidade Alternativa; gera `Sequencial` via `LoadSequencia`; calcula
`VlrTotal = Qtd × VlrUnit`.

### SP-05 — Gerar Movimentação de Estoque (`miGerarMovimentacaoClick`)
Exige Despesa salva e ainda não gerada; busca `Pessoas.OpDespPec` (Operação/TipoDoc padrão da
Empresa para Despesas Pecuária); gera `DocEstoque`/`ItDocEstoque` via `fnRetornaSequence` +
transação nomeada com verificação pós-commit; vincula `DespesasPec.ItDocEstoque`.

### SP-06 — Estornar Movimentação (`miEstornarMovimentacaoClick`)
Exige Estoque já gerado; desvincula, exclui o item, e exclui o Documento inteiro se era a única
linha.

### SP-07 — Aba "Outros Lotes" (`gdDespesasActiveTabChanged`) → `[[spDespOutrosLotes]]`
Carregada sob demanda na 1ª vez que a aba é ativada.

### 5.3 Regras de negócio e validações

- **BR-001 — Edição/Exclusão bloqueadas se já gerado o Estoque, ou vinculado a Hospitalização.**
- **BR-002 — Data/Produto/Unidade Alternativa obrigatórios.**
- **BR-003 — "Gerar"/"Estornar" exigem a Despesa salva.**
- **BR-004 — "Gerar" disponível apenas se `ParamRetiro.MovEstoqueDesp='S'`.**

---

## 6) Integrações e dados

### 6.1 Integrações (internas)

- **`[[spDespOutrosLotes]]`** (121 linhas, lida integralmente) — despesas herdadas de Lotes
  anteriores.
- **`ConverteUnid`**, **`dbo.LoadPrecoMat`**, **`fnDispAjudaBrinco`**, **`fnRetornaSequence`** —
  funções utilitárias genéricas do ERP.
- **`Pessoas.OpDespPec`** — Operação Fiscal/Estoque padrão da Empresa para Despesas Pecuária.

### 6.2 Modelo de dados

**Tabela `DespesasPec`** (campos confirmados nesta unit, complementando notas anteriores):
`Sequencial`, `Processamento`, `Hospital`, `Produto`, `Lote`, `SubGrupo`, `Brinco`, `BrincoAux`,
`Data`, `VlrTotal`, `Historico`, `VlrUnit`, `Qtd`, `UnidArmaz`, `UnidProdAlter`, `QtdAlter`,
`VlrUnitAlter`, `ItDocEstoque` (FK `ItDocEstoque.Sequencial`).

### 6.3 Triggers e Procedures do banco

- **`[[spDespOutrosLotes]]`**.

---

## 7) Suporte: FAQ, mensagens, erros e troubleshooting

### 7.2 Catálogo de mensagens e erros

| Mensagem exata | Causa |
|---|---|
| "Já foi movimentado o Estoque da Despesa e ela não pode ser Alterada/Removida." | Edição/Exclusão bloqueada |
| "Movimento relacionado a Hospitalização não pode ser Alterada/Removido." | Edição/Exclusão bloqueada |
| "Indique a Data/o Produto/a unidade Alternativa do Produto da Despesa." | Validação de gravação |
| "Salve a Despesa antes de Gerar/Estornar a Movimentação de Estoque." | Ação sem pré-condição |
| "Já foi gerado o Estoque dessa Despesa." / "Não foi gerado o Estoque dessa Despesa." | Estado inconsistente |
| "Geração/Estorno Concluído com Sucesso." / "Erro na Geração/no Estorno do Movimento." | Resultado |
| "Sequencial do Brinco Inválido." / "Brinco Auxiliar inválido." / "Brinco inválido." / "Código do Produto Inválido." | Buscas sem correspondência |

---

## 9) Notas de revisão

- **2026-09-02** (auditoria campo-a-campo — módulo Pecuária)
  - **O que mudou:** corrigida inconsistência no cabeçalho (dizia chamador "não confirmado,
    provavelmente `[[MovLotes]]`" enquanto o rodapé já registrava confirmação via
    `[[MonitoramentoBaiasLotes]]`). Confirmado explicitamente que `VlrTotal := Qtd * VlrUnit` não
    usa nenhum arredondamento Delphi.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** código-fonte `Pecuaria/DespesasPec.pas`.

- **2026-08-28** (criação da nota — módulo Pecuária)
  - **O que mudou:** nota criada do zero, a partir de leitura 100% literal de
    `Pecuaria/DespesasPec.pas` (887 linhas) + `.dfm` (título confirmado "Despesas do Lote") +
    `[[spDespOutrosLotes]]` (121 linhas, lida integralmente). Resolve a origem do CRUD de
    `DespesasPec`. Documentadas as 3 granularidades de lançamento, a geração/estorno de Doc.
    Estoque, e a herança de despesas de Lotes anteriores.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** código-fonte `Pecuaria/DespesasPec.pas` + `.dfm`; ver `[[MovLotes]]`,
    `[[spConsultaDespFech]]`, `[[spCustoBrincoPec]]`, `[[spVisualizaBrincos]]`,
    `[[CustoRacoes]]`, `[[MonitoramentoBaiasLotes]]` (chamadora, confirmada em 2026-09-01).

- **2026-08-28** (atualização — resolução da pendência de Despesas vinculadas a Hospital)
  - **O que mudou:** `[[Hospitalizacoes]]` (1210 linhas) lida integralmente — confirma que
    Despesas com `Hospital` preenchido são inseridas/editadas na própria tela de
    Hospitalizações/Rejeições (grade de detalhe sobre a mesma tabela `DespesasPec`), não nesta.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** ver `[[Hospitalizacoes]]`, `[[spGeraMovEstoqueDespesas]]`.
