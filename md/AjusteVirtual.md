> **Nota de método**: este documento descreve uma tela de um sistema LEGADO já em produção,
> reconstruída por engenharia reversa do código-fonte — não é uma especificação de feature nova
> obtida por entrevista com um PO. Por isso, toda seção que normalmente viria de uma conversa de
> negócio (motivação, métricas, objetivos) foi preenchida por **inferência a partir do
> comportamento do código**, e está marcada explicitamente como `(inferência)`. Onde nem o código
> nem o contexto do módulo permitem inferir nada com segurança, o campo está como `N/A`.
> Fonte: leitura 100% literal de `Pecuaria/AjusteVirtual.pas` (260 linhas, unit `AjusteVirtual`,
> classe `TfmAjusteVirtual`) e do `.dfm` correspondente (título confirmado "Ajustes Virtuais"),
> lida originalmente e **reauditada campo-a-campo em 2026-09-02** (incl. releitura de
> `Principal/DataModules/ConsultaPec.dfm` para checar o lookup de SubGrupo). Tela **modal/satélite**
> (`iRetiro`/`iUnidNeg`/`dData` públicos, `lblLote.Tag` preenchido pela chamadora — mesmo padrão
> já visto em `[[PrevisoesGPD]]`/`[[VisBrincoRep]]`; chamadora confirmada:
> `[[MonitoramentoBaiasLotes]]`, botão "Ajuste Virtual"). Grava diretamente na tabela **central**
> `MovAnimais` com `Operacao='A'` (Ajuste) — as 4 triggers de `MovAnimais` (`[[TI_MovAnimais]]`,
> `[[TU_MovAnimais]]`, `[[TIU_MovAnimais]]`, `[[TD_MovAnimais]]`) foram lidas integralmente e
> documentadas. Ver nota de método completa (limitação de DDL/tipos de coluna) em
> `[[ExportaDietas]]`, válida para todo o módulo.

---

**Status da implementação:** Legado — em produção (documentado via engenharia reversa, sem item de trabalho associado)

**Owner (curadoria):** @jefferson.arantes
**Tags:** #Pecuaria #MovAnimais #AjusteVirtual #SubGrupo #Lote

---

## 0) Resumo executivo

- **O que é:** grade "Ajustes Virtuais" — para um Lote específico (fornecido pela tela
  chamadora), lista e permite incluir/editar/excluir movimentos de **Ajuste** (`MovAnimais`,
  `Operacao='A'`) nos SubGrupos daquele Lote: um mecanismo de correção manual de saldo/quantidade
  de animais que não passa pelos fluxos normais de Entrada/Saída/Venda.
- **Quando usar (inferência):** correção de discrepâncias de contagem de animais em um SubGrupo
  (ex.: erro de digitação em uma Entrada anterior, recontagem física) sem precisar registrar uma
  Entrada/Saída "de verdade" — um ajuste "virtual" que altera o saldo sem representar um evento
  físico de movimentação de animais.
- **Impacto principal:** `INSERT`/`UPDATE`/`DELETE` em `MovAnimais` (`Operacao='A'`) — dispara as
  4 triggers de `MovAnimais`, incluindo a manutenção automática de `LotesBaias.Situacao`/
  `DataFechamento` (`[[TIU_MovAnimais]]`/`[[TD_MovAnimais]]`).

---

## 1) Conceito

| Termo | Definição |
|-------|-----------|
| **CORREÇÃO (auditoria 2026-09-02): o grid "SubGrupos" (`gdAjusteVirtualSubGrupos`) definido no `.dfm` nunca é exibido ao usuário — é um componente órfão/morto** | Confirmado por leitura literal do `.dfm`: `gdAjusteVirtualSubGrupos` (`TcxGridDBBandedTableView`, colunas `DescLote`/`DescUO`/`TipoLote`/`Situacao`/`Sequencial`/`Proprietario`/`Raca`/`Categoria`/`Castrado`/`Sexo`/`SaldoAtual`) existe como view dentro do `TcxGrid gdAjusteVirtual`, mas **o único `TcxGridLevel` do grid (`gdAjusteVirtualLevel`) aponta exclusivamente para `gdAjusteVirtualTabela`** — `gdAjusteVirtualSubGrupos` não está associado a nenhum level, logo nunca é renderizado. Adicionalmente, seu `DataController.DataSource` está fixado em **`dsAjusteVirtual`** (o dataset de Ajustes/`MovAnimais`: campos `SubGrupo`/`Sequencial`/`DataMov`/`UnidNegMov`/`RetiroMov`/`QtdAnimais`/`TipoMov`/`Operacao`/`Observacao`/`SeqTransf`) — nenhum dos campos que suas colunas referenciam (`DescLote`, `TipoLote`, `Situacao`, `Sexo`, `SaldoAtual`, `Proprietario`, `Raca`, `Categoria`, `Castrado`) existe nesse dataset, então mesmo que fosse exibido, resolveria em erro/coluna vazia. Conclusão: é código morto/herdado (provável cópia de outra tela do módulo que usava um grid de consulta de SubGrupos), sem efeito funcional na tela atual. |
| O papel real de "consulta de SubGrupos" é cumprido pelo **lookup da coluna `SubGrupo`** na grade editável, não por um grid separado | `FormShow` carrega `dmPecuaria.cdsUOLoteSG` com uma consulta customizada (campos `Ordem, SeqUO, DescUO, Lote, SeqSG, DescLoteSG, DtEntrada, Proprietario, Raca, Categoria, Castrado` — sem `TipoLote`/`Situacao`/`Sexo`/`SaldoAtual`) filtrada por `Safra`/`Retiro`/`Lote`. Esse dataset é o mesmo usado pela view compartilhada **`dmPecuaria.GridViewUOLoteSG`** (definida em `ConsultaPec.dfm`, DataSource `dsUOLoteSG`→`cdsUOLoteSG`), que por sua vez é o `Properties.View` do combo-lookup da coluna `gdAjusteVirtualTabelaSubGrupo` (`TcxExtLookupComboBoxProperties`, `KeyFieldNames='SeqSG'`, `ListFieldItem=DescLoteSG`) na grade principal de Ajustes. Ou seja: o usuário escolhe o SubGrupo de destino do ajuste através do dropdown da própria coluna `S.G.` da grade — que mostra U.O., Lote/S.G., Data de Entrada, Proprietário, Raça, Categoria e Castrado (colunas de `GridViewUOLoteSG`) — não há grid de consulta paralelo funcional. |
| Um comentário de código indica um filtro de saldo positivo que foi **desativado** | Linha comentada em `FormShow`: `//S.Add('and dbo.fnSldSGLotes(...) > 0')` — o filtro que restringiria a lista de SubGrupos disponíveis (no lookup acima) a apenas os que têm saldo positivo está desabilitado no código atual, então SubGrupos zerados/negativos também aparecem na lista do lookup. |
| Painel de depuração SQL (`mmQuery`) é alternado por F9 (não Ctrl+F9) | `FormKeyDown`: `Key = VK_F9` alterna `mmQuery.Visible` — variação do atalho de debug já visto em outras telas do módulo (`Ctrl+F9` em umas, duplo-clique em rótulo em outras, aqui F9 simples). |
| `TipoMov` usa o mesmo padrão `GetText`/`SetText` de código→rótulo | `cdsAjusteVirtualTipoMovGetText`/`SetText`: `'E'`↔"ENTRADA", `'S'`↔"SAÍDA" — o Ajuste pode ser de entrada (soma) ou saída (subtrai) de animais no SubGrupo. O combo `gdAjusteVirtualTabelaTipoMov` (`TcxComboBoxProperties`, `lsFixedList`, `ImmediatePost=True`) usa a mesma lista fixa `('ENTRADA','SAÍDA')` na UI. |

---

## 2) Dicionário de campos da tela (`.dfm`)

> **Auditoria de profundidade (2026-09-02):** tabela reescrita coluna-a-coluna (em vez de
> resumida) para cobrir 100% dos controles do `.dfm`, incluindo o grid órfão (nunca renderizado)
> e as colunas ocultas/não-editáveis das duas grades — ver achado em "1) Conceito" sobre
> `gdAjusteVirtualSubGrupos`.

### 2.1 Cabeçalho de contexto (fora das grades)

| Controle | Classe | Rótulo/Caption | Vinculado a (campo BD) | Obrigatório | Observações |
|---|---|---|---|---|---|
| `lblUO` | `TcxLabel` | grupo "U.O." | preenchido pela tela chamadora (texto livre) | — | `Enabled=False` (somente leitura) — exibição de contexto, sem `Tag` usado no código desta unit. |
| `lblLote` | `TcxLabel` | grupo "Lote" | preenchido pela tela chamadora | — | `Enabled=False`. `lblLote.Tag` (inteiro) é o único campo efetivamente lido pelo código — usado como filtro `Lote` nas duas consultas de `FormShow`. |
| `dnNavega` | `TcxDBNavigator` | botões Inserir(F3)/Excluir(F4)/Alterar(F5)/Salvar(F6)/Cancelar(F7) | `DataSource=dsAjusteVirtual` | — | `Buttons.ConfirmDelete=False` (a confirmação é feita manualmente em `cdsAjusteVirtualBeforeDelete`, não pelo navigator). Botões First/Prior/Next/Last/PriorPage/NextPage/Refresh/SaveBookmark/GotoBookmark/Filter todos com `Visible=False` — navigator reduzido a CRUD puro. |
| `mmQuery` | `TcxMemo` | — | recebe `S.Text` da consulta de Ajustes (não da de SubGrupos) | — | `Visible=False` por padrão; alternado por `F9` (`FormKeyDown`). Painel de depuração SQL. |

### 2.2 Grid `gdAjusteVirtualTabela` — grade editável de Ajustes (ÚNICA grade realmente exibida; `DataSource=dsAjusteVirtual`→`cdsAjusteVirtual`→`MovAnimais`)

| Controle (coluna) | Classe | Caption | Campo BD | Obrigatório | Editável | Observações |
|---|---|---|---|---|---|---|
| `gdAjusteVirtualTabelaSubGrupo` | `TcxGridDBBandedColumn` (`TcxExtLookupComboBoxProperties`) | "S.G." | `SubGrupo` (`TIntegerField`) | Sim (`Required=True` no cds; BR-001 valida `>0`) | Sim | Lookup: `View=dmPecuaria.GridViewUOLoteSG`, `KeyFieldNames='SeqSG'`, `ListFieldItem=DescLoteSG`, `DropDownWidth=610`, `ImmediatePost=True` — grava assim que o usuário escolhe o item, sem esperar Tab/Enter. |
| `gdAjusteVirtualTabelaSequencial` | `TcxGridDBBandedColumn` (`TcxCurrencyEditProperties`, `DecimalPlaces=0`) | "Seq." | `Sequencial` (`TIntegerField`, PK) | Sim (`Required=True`, `pfInKey`) | **Não** — `Options.Editing=False`, `Styles.Content/Footer=cxStyleDisable` | Gerado por `LoadSequencia('MovAnimais','Sequencial')` no `BeforePost` de uma inclusão — nunca digitado pelo usuário. |
| `gdAjusteVirtualTabelaDataMov` | `TcxGridDBBandedColumn` (`TcxDateEditProperties`) | "Data" | `DataMov` (`TSQLTimeStampField`) | Sim (`Required=True`; BR-002) | Sim | `DateButtons=[btnToday]`, `ShowTime=False`, `SaveTime=False` — só data, sem hora. Default `Date` (hoje) ao inserir (`AfterInsert`). |
| `gdAjusteVirtualTabelaQtdAnimais` | `TcxGridDBBandedColumn` (`TcxCurrencyEditProperties`, `DecimalPlaces=0`) | "Ajuste" | `QtdAnimais` (`TIntegerField`) | Sim (`Required=True`; BR-003 exige `>0`) | Sim | Campo é `int` no BD — não há e não pode haver casas decimais; `DecimalPlaces=0` é só formatação de exibição, não arredondamento de cálculo (não há fórmula/cálculo derivado nesta tela, o valor é digitado diretamente pelo usuário). Soma no rodapé (`FooterSummaryItems`, `skSum`, `Format=',0;(,0)'`). |
| `gdAjusteVirtualTabelaTipoMov` | `TcxGridDBBandedColumn` (`TcxComboBoxProperties`) | "Tipo" | `TipoMov` (`TStringField(1)`) | Sim (`Required=True`; BR-004) | Sim | `DropDownListStyle=lsFixedList`, `ImmediatePost=True`, `Items=('ENTRADA','SAÍDA')` — mapeado para `'E'`/`'S'` via `OnGetText`/`OnSetText`. |
| `gdAjusteVirtualTabelaObservacao` | `TcxGridDBBandedColumn` (`TcxMemoProperties`) | "Observação" | `Observacao` (`TStringField`, `Size=200`) | Não (sem `Required` no cds, sem validação em `BeforePost`) | Sim | Texto livre multi-linha, até 200 caracteres. |
| `gdAjusteVirtualTabelaSeqTransf` | `TcxGridDBBandedColumn` (`TcxCurrencyEditProperties`, `DecimalPlaces=0`) | **"Recorrente"** | `SeqTransf` (`TIntegerField`) | Não | **Não** — `Visible=False` (coluna oculta) **e** `Options.Editing=False` | **Achado:** caption "Recorrente" não bate com o nome do campo (`SeqTransf` = "Sequencial de Transferência"), sugerindo que a coluna foi copiada de outra tela (provável `TransfSG`/mecanismo de lançamento recorrente) e não foi renomeada. Não é atribuído em nenhum lugar de `AjusteVirtual.pas` — nesta tela o campo sempre viaja `NULL`/`0`; presumivelmente só é populado por outro fluxo (Transferências, `Operacao='TR'`), fora do escopo desta unit. Como está oculta e não-editável, o usuário não tem como preenchê-la ou vê-la aqui. |

### 2.3 Grid `gdAjusteVirtualSubGrupos` — **componente órfão, nunca exibido** (documentado por completude/auditoria)

| Controle (coluna) | Classe | Caption | Campo referenciado | Observações |
|---|---|---|---|---|
| `gdAjusteVirtualSubGruposDescUO` | `TcxGridDBBandedColumn` | "U.O." | `DescUO` | Banda "Lote" (col. 0). Ordenação `SortIndex=0 asc`. |
| `gdAjusteVirtualSubGruposDescLote` | `TcxGridDBBandedColumn` | "Lote - SG" | `DescLote` | Banda "Lote" (col. 1). `SortIndex=1 asc`. |
| `gdAjusteVirtualSubGruposTipoLote` | `TcxGridDBBandedColumn` | "Tipo do Lote" | `TipoLote` | Banda "Lote" (col. 2). |
| `gdAjusteVirtualSubGruposSituacao` | `TcxGridDBBandedColumn` | "Situação" | `Situacao` | Banda "Lote" (col. 3). |
| `gdAjusteVirtualSubGruposSequencial` | `TcxGridDBBandedColumn` | (sem caption) | `Sequencial` | Banda "SubGrupo" (col. 0). `Visible=False`. |
| `gdAjusteVirtualSubGruposProprietario` | `TcxGridDBBandedColumn` | (sem caption, campo já indica) | `Proprietario` | Banda "SubGrupo" (col. 1). |
| `gdAjusteVirtualSubGruposRaca` | `TcxGridDBBandedColumn` | (sem caption) | `Raca` | Banda "SubGrupo" (col. 2). |
| `gdAjusteVirtualSubGruposCategoria` | `TcxGridDBBandedColumn` | (sem caption) | `Categoria` | Banda "SubGrupo" (col. 3). |
| `gdAjusteVirtualSubGruposCastrado` | `TcxGridDBBandedColumn` | (sem caption) | `Castrado` | Banda "SubGrupo" (col. 5). |
| `gdAjusteVirtualSubGruposSexo` | `TcxGridDBBandedColumn` | (sem caption) | `Sexo` | Banda "SubGrupo" (col. 4). |
| `gdAjusteVirtualSubGruposSaldoAtual` | `TcxGridDBBandedColumn` (`TcxCurrencyEditProperties`) | "Saldo Atual" | `SaldoAtual` | Banda "SubGrupo" (col. 6). Rodapé `skSum`. |

**Por que está morto:** `DataController.DataSource=dsAjusteVirtual` (dataset de `MovAnimais`, que não
tem nenhum destes campos) **e** o grid não está associado a nenhum `TcxGridLevel` — o único level
do `TcxGrid` (`gdAjusteVirtualLevel`) aponta só para `gdAjusteVirtualTabela`. Portanto esta tabela
de colunas nunca chega a ser desenhada em tela; é herança de outra tela/versão anterior mantida
inerte no `.dfm`. Ver correção em "1) Conceito".

---

## 5) Jornada do usuário + Especificação funcional

### SP-01 — Abrir a tela (`FormShow`)
Carrega a lista informativa de SubGrupos do Lote (com dados de Raça/Categoria/Proprietário);
carrega a grade de Ajustes existentes: `SELECT M.* FROM MovAnimais M JOIN SubGruposLotes S ON
M.SubGrupo=S.Sequencial WHERE S.Lote=<lblLote.Tag> AND M.Operacao='A'`.

### SP-02 — Incluir/Editar/Excluir na grade (navegador `dnNavega`, atalhos F3/F4/F5/F6/F7)

**Pseudocódigo fiel:**
```
ao inserir novo registro:
  DataMov := hoje  (default)

ao gravar (Post):
  se SubGrupo <= 0: avisar "Selecione o SubGrupo do Ajuste." e abortar
  senão se DataMov nula ou <= 0: avisar "Selecione a Data do Ajuste." e abortar
  senão se QtdAnimais <= 0: avisar "Selecione o Valor do Ajuste Maior que Zero." e abortar
  senão se TipoMov (trim) = '': avisar "Selecione o Tipo do Ajuste." e abortar
  senão se é Inclusão:
    Sequencial := LoadSequencia('MovAnimais', 'Sequencial')
    UnidNegMov := iUnidNeg
    RetiroMov := iRetiro
    Operacao := 'A'
  // ApplyUpdates via provider grava o INSERT/UPDATE real
  //   dispara TI_MovAnimais (insert) ou TU_MovAnimais (update) + TIU_MovAnimais (ambos)
  CommitTransacaoTabelas(...)

ao excluir:
  confirmar "Deseja Realmente Excluir o Registro Selecionado?"
  se confirmado: prosseguir (dispara TD_MovAnimais)
  senão: abortar
```
**Achado:** `QtdAnimais` é validado apenas como `> 0` (sempre positivo) — a direção do ajuste
(soma ou subtrai do saldo) é determinada exclusivamente pelo `TipoMov` (Entrada/Saída), não pelo
sinal do valor.

**Arredondamento (auditoria 2026-09-02):** revisado `cdsAjusteVirtualBeforePost` (única rotina de
validação/gravação da tela) e não há nenhuma chamada a `RoundTo`, `SimpleRoundTo`, `Round`,
`Trunc` ou `FormatFloat` em nenhum ponto de `AjusteVirtual.pas` — **confirmado: não há
arredondamento explícito nesta tela**, porque não há cálculo/fórmula derivada nenhuma: `QtdAnimais`
é um valor inteiro (`TIntegerField`) digitado diretamente pelo usuário (a máscara
`DecimalPlaces=0` no `.dfm` é só formatação de exibição/edição do grid, não uma operação de
arredondamento de cálculo).

**Valores negativos (campo a campo, via `BeforePost` — não há `OnValidate`/`OnEditValueChanged`
nesta unit):**
| Campo | Aceita negativo? | Onde é barrado |
|---|---|---|
| `SubGrupo` | Não | `BeforePost`: `<= 0` → BR-001 (bloqueia zero e negativo; lookup também não permite digitação livre, só seleção da lista). |
| `QtdAnimais` | Não | `BeforePost`: `<= 0` → BR-003 (bloqueia zero e negativo explicitamente). |
| `DataMov` | N/A (campo de data) | `BeforePost`: nulo ou `<= 0` (data "vazia"/inválida) → BR-002. |
| `TipoMov` | N/A (campo de código de 1 caractere) | `BeforePost`: trim vazio → BR-004. |
| `Observacao` | N/A (texto livre) | Sem validação. |
| `Sequencial`, `UnidNegMov`, `RetiroMov`, `Operacao` | N/A — não digitados pelo usuário | Atribuídos automaticamente no `BeforePost` (inclusão) a partir de `LoadSequencia`/`iUnidNeg`/`iRetiro`/`'A'` fixo. |

### 5.3 Regras de negócio e validações

#### BR-001 — SubGrupo do Ajuste obrigatório
- **Mensagem:** "Selecione o SubGrupo do Ajuste."

#### BR-002 — Data do Ajuste obrigatória
- **Mensagem:** "Selecione a Data do Ajuste."

#### BR-003 — Quantidade de Animais do Ajuste deve ser maior que zero
- **Mensagem:** "Selecione o Valor do Ajuste Maior que Zero."

#### BR-004 — Tipo do Ajuste (Entrada/Saída) obrigatório
- **Mensagem:** "Selecione o Tipo do Ajuste."

#### BR-005 — Herdadas das triggers de `MovAnimais` (ver `[[TIU_MovAnimais]]`)
- **Achado:** ao gravar/editar, o SGBD pode ainda rejeitar o ajuste com os erros 30876 ("Já
  existe uma Entrada para o SubGrupo selecionado...") ou 30877 ("A Data de Movimentação não pode
  ser anterior a Data do SubGrupo...") — mas essas checagens contam `Operacao <> 'A'`, então um
  Ajuste do tipo Entrada (`TipoMov='E'`) **não conta** para o limite de 1 Entrada por SubGrupo
  (a checagem de `[[TIU_MovAnimais]]` filtra `TipoMov='E' and Operacao<>'A'`) — ou seja, é
  possível ter tanto uma Entrada "real" quanto múltiplos Ajustes do tipo Entrada no mesmo
  SubGrupo, sem bloqueio.

---

## 6) Integrações e dados

### 6.1 Integrações (internas)

Tela satélite/modal, chamada por **[[MonitoramentoBaiasLotes]]** (confirmado — fornece
`lblLote.Tag`, `iRetiro`, `iUnidNeg`, `dData`). Grava na tabela central `MovAnimais`,
compartilhada com o fluxo normal de **[[EntradaAnimais]]**/**[[SaidaAnimais]]** (lidas e
documentadas integralmente).

### 6.2 Modelo de dados

**Tabela `MovAnimais`** (central, `Operacao='A'` = Ajuste Virtual):

| Coluna | Tipo (Delphi/inferido) | Papel nesta tela |
|---|---|---|
| `Sequencial` | `TIntegerField` (persistente) — `int` (alta confiança) | Chave — gerada por `LoadSequencia`. |
| `SubGrupo` | `TIntegerField` (persistente) — `int` (alta confiança) | FK para `SubGruposLotes.Sequencial`. |
| `DataMov` | `TSQLTimeStampField` (persistente) — `datetime` (alta confiança) | Data do ajuste. |
| `UnidNegMov`/`RetiroMov` | `TIntegerField` (persistente) — `int` (alta confiança) | Contexto de Fazenda/Retiro, fixados por `iUnidNeg`/`iRetiro`. |
| `QtdAnimais` | `TIntegerField` (persistente) — `int` (alta confiança) | Sempre positivo; direção definida por `TipoMov`. |
| `TipoMov` | `TStringField` (persistente, `GetText`/`SetText` customizados) — `char(1)` (alta confiança) | `E`/`S` — Entrada/Saída do ajuste. |
| `Operacao` | `TStringField` (persistente) — `char(1)`/`varchar` (alta confiança) | Fixado em `'A'`. |
| `Observacao` | `TStringField` (persistente) — `varchar` (alta confiança) | Texto livre, sem validação de obrigatoriedade. |
| `SeqTransf` | `TIntegerField` (persistente) — `int` (alta confiança) | Coluna presente na grade, mas **oculta e não-editável** (`Visible=False`, `Options.Editing=False`; caption no `.dfm` é "Recorrente", divergente do nome do campo — ver 2.2). Não é atribuído nesta unit — provavelmente usado só por Transferências (`Operacao='TR'`), fora do escopo desta tela. |

### 6.3 Triggers e Procedures do banco

- **`[[TI_MovAnimais]]`** (INSERT) — cria Pesagem automática (só se `Operacao NOT IN ('A','E')` —
  **não** dispara para Ajustes) e preenche Categoria/CategoriaAnterior.
- **`[[TU_MovAnimais]]`** (UPDATE) — sincroniza Pesagem/Abate (não relevante para Ajustes, que não
  têm Abate/Pesagem associados).
- **`[[TIU_MovAnimais]]`** (INSERT+UPDATE) — valida Entrada duplicada (não conta Ajustes) e Data
  anterior à Entrada do SubGrupo; atualiza `LotesBaias.Situacao`/`DataFechamento`.
- **`[[TD_MovAnimais]]`** (DELETE) — mesma manutenção de `LotesBaias` para exclusão.

---

## 7) Suporte: FAQ, mensagens, erros e troubleshooting

### 7.2 Catálogo de mensagens e erros

| Mensagem exata | Causa |
|---|---|
| "Selecione o SubGrupo do Ajuste." | BR-001 |
| "Selecione a Data do Ajuste." | BR-002 |
| "Selecione o Valor do Ajuste Maior que Zero." | BR-003 |
| "Selecione o Tipo do Ajuste." | BR-004 |
| "Deseja Realmente Excluir o Registro Selecionado?" | Confirmação de exclusão |
| "TIU_MovAnimais - Já existe uma Entrada para o SubGrupo selecionado, selecione outro SubGrupo." | Erro 30876 (trigger) |
| "TIU_MovAnimais - A Data de Movimentação não pode ser anterior a Data do SubGrupo." | Erro 30877 (trigger) |

---

## 9) Notas de revisão

- **2026-09-02** (auditoria de profundidade campo-a-campo — pós-achados do módulo Algodoeira)
  - **O que mudou:** releitura 100% literal de `AjusteVirtual.pas` (260 linhas) e `.dfm` (592
    linhas) diretamente do código-fonte (não apenas da nota anterior). **Achado real
    corrigido:** o grid "SubGrupos" (`gdAjusteVirtualSubGrupos`), que a nota anterior descrevia
    como "grid separado, presumivelmente para consulta visual", é na verdade um **componente
    órfão que nunca é exibido** — não está associado a nenhum `TcxGridLevel` do `TcxGrid`
    (só `gdAjusteVirtualTabela` está) e, mesmo que estivesse, seu `DataController.DataSource`
    aponta para `dsAjusteVirtual` (dataset de `MovAnimais`), que não contém nenhum dos campos
    que suas colunas referenciam (`DescLote`, `TipoLote`, `Situacao`, `Sexo`, `SaldoAtual`,
    `Proprietario`, `Raca`, `Categoria`, `Castrado`) — é código morto/herdado. O papel real de
    consulta de SubGrupos é cumprido pelo lookup da própria coluna `S.G.` da grade editável
    (`Properties.View=dmPecuaria.GridViewUOLoteSG`, compartilhado com outras telas via
    `ConsultaPec.dfm`). Seção "2) Dicionário de campos" reescrita coluna-a-coluna (antes
    resumida em 2 linhas de tabela) cobrindo as duas grades por completo, incluindo colunas
    ocultas/não-editáveis (`Sequencial` da grade de Ajustes — auto-gerado, `Options.Editing=False`;
    `SeqTransf` — oculta, caption "Recorrente" divergente do nome do campo). Confirmado e
    declarado explicitamente que **não há arredondamento** em nenhum cálculo da tela (não há
    `RoundTo`/`SimpleRoundTo`/`Round`/`Trunc`/`FormatFloat` em `AjusteVirtual.pas` — `QtdAnimais`
    é inteiro digitado diretamente, sem fórmula derivada) e detalhada campo-a-campo a aceitação
    de valores negativos (nenhum campo numérico aceita negativo; `SubGrupo` e `QtdAnimais`
    bloqueados por `BeforePost`). Caminho de menu (`MonitoramentoBaiasLotes` → botão "Ajuste
    Virtual") e satélites já estavam corretos na nota anterior — revalidados sem alteração.
  - **Impacto:** nenhum no sistema (documentação apenas) — a correção sobre o grid órfão é
    relevante para quem for alterar/dar manutenção nesta tela: mexer em
    `gdAjusteVirtualSubGrupos` (bindings, colunas) não terá efeito visível nenhum, pois o
    componente não é renderizado.
  - **Referências:** releitura de `Pecuaria/AjusteVirtual.pas` + `.dfm`;
    `Principal/DataModules/ConsultaPec.dfm` (definição de `GridViewUOLoteSG`/`cdsUOLoteSG`/
    `sqlUOLoteSG`, consultada para confirmar o achado do grid órfão);
    `Pecuaria/MonitoramentoBaiasLotes.pas` (revalidação do chamador).

- **2026-08-28** (criação da nota — módulo Pecuária)
  - **O que mudou:** nota criada do zero, a partir de leitura 100% literal de
    `Pecuaria/AjusteVirtual.pas` (260 linhas) + `.dfm` (título confirmado "Ajustes Virtuais").
    Documentado o CRUD de Ajustes Virtuais sobre `MovAnimais` (`Operacao='A'`), e as 4 triggers
    de `MovAnimais` (`[[TI_MovAnimais]]`, `[[TU_MovAnimais]]`, `[[TIU_MovAnimais]]`,
    `[[TD_MovAnimais]]`), lidas e documentadas integralmente pela primeira vez nesta sessão —
    são a infraestrutura central de todo o ciclo de vida de movimentação de animais e status de
    Lote no módulo.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** código-fonte `Pecuaria/AjusteVirtual.pas` + `.dfm`; `[[TI_MovAnimais]]`,
    `[[TU_MovAnimais]]`, `[[TIU_MovAnimais]]`, `[[TD_MovAnimais]]`; ver `[[PrevisoesGPD]]`,
    `[[VisBrincoRep]]` (padrão de tela satélite).
