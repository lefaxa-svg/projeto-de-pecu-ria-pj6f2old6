> **Nota de método**: este documento descreve uma tela de um sistema LEGADO já em produção,
> reconstruída por engenharia reversa do código-fonte — não é uma especificação de feature nova
> obtida por entrevista com um PO. Por isso, toda seção que normalmente viria de uma conversa de
> negócio (motivação, métricas, objetivos) foi preenchida por **inferência a partir do
> comportamento do código**, e está marcada explicitamente como `(inferência)`. Onde nem o código
> nem o contexto do módulo permitem inferir nada com segurança, o campo está como `N/A`.
> Fonte: leitura 100% literal de `Pecuaria/FechContratos.pas` (877 linhas, unit `FechContratos`,
> classe `TfmFechContratos`) e do `.dfm` correspondente (título confirmado "Fechamentos do
> Contrato"), nesta sessão — 76º arquivo `.pas` lido do módulo Pecuária. Tela satélite chamada
> por `[[ContratoBoitel]]` (botão "Fechar Contratos") — resolve aquela pendência. Chama
> `[[spConsultaMovFech]]` (118 linhas) e `[[spConsultaDespFech]]` (133 linhas), ambas lidas
> integralmente nesta sessão. Ver nota de método completa (limitação de DDL/tipos de coluna) em
> `[[ExportaDietas]]`, válida para todo o módulo.

---

**Status da implementação:** Legado — em produção (documentado via engenharia reversa, sem item de trabalho associado)

**Owner (curadoria):** @jefferson.arantes
**Tags:** #Pecuaria #Boitel #Contrato #Faturamento #Diarias #Despesas

---

## 0) Resumo executivo

- **O que é:** tela de **fechamento/faturamento periódico de um Contrato de Boitel** — agrega,
  para o período do fechamento, todas as Saídas (vendas) e Mortes de animais do Contrato,
  calculando **Diárias de Confinamento** (dias entre Entrada e Saída × valor da Diária, buscado
  em `PrecosConfinamento` por faixa de Peso de Entrada) e permite vincular **Documentos
  financeiros** (Títulos a receber) e **Documentos de Estoque** (despesas de insumos) a este
  fechamento específico — um Contrato de Boitel pode ter **múltiplos Fechamentos ao longo do
  tempo** (faturamento parcelado/periódico, não 1 fechamento único no final).
- **4 abas de configuração** (`gdConfigFech`, `TcxGrid` multi-nível): Movimentos (Saídas/Mortes
  com Diárias calculadas), Despesas por Lote (rateio de insumos consumidos), Documentos
  Financeiros (Títulos a Receber vinculados), Despesas de Estoque (Documentos de saída de
  estoque vinculados).
- **Fechamento "Finalizado" trava tudo** — uma vez finalizado (`Finalizado=1`), o registro não
  pode mais ser editado/excluído, e a grade de Movimentos vira somente-leitura.
- **Impacto principal:** `INSERT`/`UPDATE`/`DELETE FechContratos`; `UPDATE MovAnimais.
  FechContrato`/`RegMortesPec.FechContrato` (vincular/desvincular Movimentos); `UPDATE
  Documentos.FechContrato`/`DocEstoque.FechContrato` (vincular/desvincular despesas/documentos).

---

## 1) Conceito

| Termo | Definição |
|-------|-----------|
| Diária é calculada por **faixa de Peso de Entrada**, não peso fixo | `[[spConsultaMovFech]]` busca em `PrecosConfinamento` (já documentada em `[[PrecosConfinamento]]`) a faixa (`PesoIni`/`PesoFim`) que contém o Peso Médio de Entrada do SubGrupo — e esse peso, por sua vez, é `PesoMedioEnt` (peso pesado na entrada) OU `PesoMedioRec` (peso médio recebido, calculado a partir do GTA de recepção via `RomaneiosPec.KgMedioCab`), conforme `Contratos.ControlePeso` (`'P'`=Pesagem / `'R'`=Recepção — mesmo campo já visto em `[[ContratoBoitel]]`). |
| Um Movimento "pendente de fechamento" aparece automaticamente até ser explicitamente excluído de um fechamento anterior não-finalizado | `[[spConsultaMovFech]]`: `WHERE M.FechContrato = F.Sequencial OR (F.Finalizado=0 AND M.FechContrato IS NULL)` — cada Fechamento não-finalizado "adota" automaticamente todo Movimento ainda sem Fechamento — um Movimento só fica definitivamente fora se for explicitamente desmarcado (`Marcar='N'`) num Fechamento aberto. |
| Rateio de despesas navega a linhagem de SubGrupo (mesma técnica de `[[spVisualizaBrincos]]`) | `[[spConsultaDespFech]]`: para cada Movimento de saída do fechamento, navega retroativamente pela cadeia `SGOrigem` (via `WHILE` explícito, não `GOTO` como em `spVisualizaBrincos`) para capturar despesas (`DespesasPec`) lançadas em **qualquer** Lote por onde o SubGrupo (e seus ancestrais de Transferência) passou entre a Entrada original e a Saída — reforça `DespesasPec` como tabela central de custos por Lote, já introduzida em `[[MovLotes]]`. |
| Rateio de despesa individual por Brinco vs. por Lote inteiro | Se a despesa (`DespesasPec`) foi lançada por `Brinco` específico, o valor é usado integralmente (`QtdTotal`); se foi lançada a nível de `SubGrupo`/`Lote` (sem Brinco), é rateada proporcionalmente ao saldo de animais do dia (`(QtdTotal/Saldo) × QtdMov`) — mesmo padrão proporcional de rateio por saldo diário já visto em `[[spVisualizaBrincos]]`/`[[spConsumoMedioPec]]`. |
| Impressão monta um `ClientDataSet` dinâmico combinando 3 fontes | `btnImprimirClick`: copia campos de `cdsMovFech` (incluindo campos agregados `AggFields`) + adiciona 3 totais de despesa (Lotes/Financeiro/Estoque, lidos dos rodapés já calculados pela grid) — mais um exemplo do padrão "montar `FieldDefs` dinamicamente + copiar campo a campo" já visto em `[[GraficosPec]]`/`[[AnalArracoamento]]`. |

---

## 2) Dicionário de campos da tela (`.dfm`)

| Controle | Classe | Rótulo/Caption | Vinculado a (campo BD) | Obrigatório | Observações |
|---|---|---|---|---|---|
| `lblUnidNeg`/`lblContrato`/`lblCliente` | `TcxLabel` | — | contexto (via `.Tag`/`.Hint`, recebidos de `[[ContratoBoitel]]`) | — | — |
| `cbNumFech` | `TcxLookupComboBox` | — | seleciona o Fechamento ativo | — | Desabilitado durante inclusão/edição do cabeçalho. |
| `deData` | `TcxDBDateEdit` | — | `FechContratos.Data` | Sim | Data-limite do fechamento (Movimentos até essa data são elegíveis). |
| `dnFech` | `TcxDBNavigator` | — | — | — | F3/F4 (Insert/Delete), F6/F7 (Post/Cancel). |
| `gdConfigFech` (4 níveis) | `TcxGrid` multi-nível | Movimentos / Despesas por Lote / Documentos Financeiros / Despesas de Estoque | `cdsMovFech`/`cdsDespFech`/`cdsOutrasDesp`/`cdsOutrosEstoque` | — | Cada aba carrega sob demanda ao ser ativada. |
| `btnFinalizar` | `TcxButton` | — | `FechContratos.Finalizado` | — | Ação irreversível (sem "desfinalizar" nesta unit). |
| `btnGerarDoc` | `TcxButton` | (Hint "Gerar Documento de Cobrança") | — | — | **Confirmado (auditoria 2026-09-08): `Enabled=False` no `.dfm`, sem `OnClick`** — botão morto/funcionalidade planejada e nunca implementada ("Gerar Documento de Cobrança"), não uma dúvida — mesmo padrão de botão morto já visto em várias telas do módulo. |
| `btnImprimir` | `TcxButton` | — | — | — | Relatório `FechContratoBoitel.rtm`. |

---

## 5) Jornada do usuário + Especificação funcional

### SP-01 — Abrir a tela (`FormShow`)
Carrega os Fechamentos já existentes do Contrato (`Tipo='C'`); seleciona o mais recente.

### SP-02 — Incluir/Editar/Excluir Fechamento (cabeçalho)
Bloqueia edição/exclusão se `Finalizado=1`; ao excluir, **desvincula em cascata manual** todos os
Movimentos/Documentos/Despesas de Estoque marcados para aquele Fechamento (loop de
`Marcar:='N'`/exclusão) antes de excluir o cabeçalho.

### SP-03 — Trocar o Fechamento selecionado (`cbNumFechPropertiesEditValueChanged`) →
`[[spConsultaMovFech]]`
Carrega a aba de Movimentos; se Finalizado, trava a grade e desabilita novas inclusões nas
demais abas.

### SP-04 — Marcar/Desmarcar um Movimento no Fechamento (`cdsMovFechAfterPost`)
`UPDATE MovAnimais.FechContrato`/`RegMortesPec.FechContrato` conforme `Marcar='S'`/`'N'`.

### SP-05 — Trocar de aba (`gdConfigFechActiveTabChanged`)
Exige Fechamento selecionado (exceto aba Movimentos); carrega a aba de Despesas por Lote sob
demanda → `[[spConsultaDespFech]]`.

### SP-06 — Vincular Documento Financeiro (`tvOutrasDespFocusedRecordChanged`, ao focar a "nova
linha")
Abre `TfmBuscaDocumento` (busca genérica de Documentos do Cliente); bloqueia se o Documento já
estiver vinculado a outro Fechamento; senão `UPDATE Documentos.FechContrato`.

### SP-07 — Excluir vínculo de Documento (`tvOutrasDespBtnExcluirPropertiesButtonClick`)
`UPDATE Documentos.FechContrato = Null`.

### SP-08 — Marcar/Desmarcar Documento de Estoque (`cdsOutrosEstoqueAfterPost`)
`UPDATE DocEstoque.FechContrato` conforme `Marcar`.

### SP-09 — Finalizar (`btnFinalizarClick`)
`Finalizado:=1` (sem validação prévia nesta unit — achado: nenhuma checagem de consistência
antes de finalizar).

### SP-10 — Imprimir (`btnImprimirClick`) → template `FechContratoBoitel.rtm`

### 5.3 Regras de negócio e validações

- **BR-001 — Fechamento Finalizado não pode ser editado/excluído.**
- **BR-002 — Documento já vinculado a outro Fechamento não pode ser incluído em outro.**
- **BR-003 — Aba de Despesas exige Fechamento selecionado.**
- **Achado:** "Finalizar" não valida nenhuma pré-condição (ex.: existência de Movimentos, valor
  mínimo) antes de travar o registro.

---

## 6) Integrações e dados

### 6.1 Integrações (internas)

- **`[[spConsultaMovFech]]`** (118 linhas, lida integralmente) — Movimentos + Diárias.
- **`[[spConsultaDespFech]]`** (133 linhas, lida integralmente) — rateio de Despesas por Lote.
- **`[[PrecosConfinamento]]`** — origem da faixa de Diária por Peso.
- **`TfmBuscaDocumento`** — seletor genérico de Documentos (não lido).
- **`DespesasPec`** — já introduzida em `[[MovLotes]]`, aqui consumida para rateio.

### 6.2 Modelo de dados

**Tabela `FechContratos`** (campos confirmados): `Sequencial`, `SeqContrato` (FK
`Contratos.Sequencial`), `Numero` (sequência por Contrato, via `LoadSequencia` com filtro),
`Data`, `Finalizado` (Integer 0/1, não char — achado de inconsistência de tipo com o restante do
módulo, que usa `'S'`/`'N'`), `Tipo` (`'C'` fixo nesta unit — sugere outro `Tipo` usado em
contexto não visto).

Campos adicionais confirmados em `Contratos`: `ControlePeso` (já conhecido), e implicitamente
`Documentos.FechContrato`/`DocEstoque.FechContrato`/`MovAnimais.FechContrato`/
`RegMortesPec.FechContrato` (FKs reversas de vinculação).

### 6.3 Triggers e Procedures do banco

- **`[[spConsultaMovFech]]`**, **`[[spConsultaDespFech]]`**.
- Confirmado (auditoria 2026-09-08): `scripts/triggers` não tem nenhum arquivo para
  `FechContratos` — sem trigger na tabela própria.

---

## 7) Suporte: FAQ, mensagens, erros e troubleshooting

### 7.2 Catálogo de mensagens e erros

| Mensagem exata | Causa |
|---|---|
| "O Fechamento foi Finalizado e não pode ser alterado/excluído." | Ação bloqueada por finalização |
| "Deseja Realmente Excluir o Fechamento Selecionado e todas suas Configurações?" | Confirmação de exclusão |
| "Indique a Data do Fechamento." | Validação do cabeçalho |
| "Salve o registro do Fechamento antes de alterar suas Configurações." | Ação nas abas sem cabeçalho salvo |
| "Selecione um Fechamento para Visualizar as Despesas." / "...para incluir um documento." | Aba sem Fechamento selecionado |
| "O Documento selecionado já está vinculado a outro fechamento e não pode ser incluído." | Documento já vinculado |
| "Erro na Seleção do Movimento/da despesa de estoque." / "Erro na Inclusão/Exclusão do Documento no Fechamento." | Falhas de `UPDATE` |

---

## 9) Notas de revisão

- **2026-09-08** (auditoria campo-a-campo — módulo Pecuária)
  - **O que mudou:** resolvida a dúvida sobre `btnGerarDoc` — confirmado `Enabled=False`/sem
    `OnClick` no `.dfm`, é botão morto. Confirmado (grep em `scripts/triggers`) que
    `FechContratos` não tem trigger própria.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** código-fonte `Pecuaria/FechContratos.dfm`.

- **2026-08-28** (criação da nota — módulo Pecuária)
  - **O que mudou:** nota criada do zero, a partir de leitura 100% literal de
    `Pecuaria/FechContratos.pas` (877 linhas) + `.dfm` (título confirmado "Fechamentos do
    Contrato") + `[[spConsultaMovFech]]`/`[[spConsultaDespFech]]` (lidas integralmente). Resolve
    a pendência de `[[ContratoBoitel]]`. Documentado o cálculo de Diárias por faixa de Peso, o
    rateio de despesas por linhagem de SubGrupo, e a vinculação de Documentos/Despesas de
    Estoque ao fechamento. Achados: `Finalizado` sem validação prévia; `btnGerarDoc` sem handler
    identificado; `Finalizado` como Integer (inconsistência de tipo com o padrão `'S'`/`'N'` do
    módulo).
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** código-fonte `Pecuaria/FechContratos.pas` + `.dfm`; ver
    `[[ContratoBoitel]]`, `[[PrecosConfinamento]]`, `[[MovLotes]]`, `[[spVisualizaBrincos]]`.
