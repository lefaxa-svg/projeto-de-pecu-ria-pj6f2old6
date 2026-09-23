> **Nota de método**: este documento descreve uma tela de um sistema LEGADO já em produção,
> reconstruída por engenharia reversa do código-fonte — não é uma especificação de feature nova
> obtida por entrevista com um PO. Por isso, toda seção que normalmente viria de uma conversa de
> negócio (motivação, métricas, objetivos) foi preenchida por **inferência a partir do
> comportamento do código**, e está marcada explicitamente como `(inferência)`. Onde nem o código
> nem o contexto do módulo permitem inferir nada com segurança, o campo está como `N/A`.
> Fonte: leitura 100% literal de `Pecuaria/ContVendaGado.pas` (494 linhas, unit `ContVendaGado`,
> classe `TfmContVendaGado`) e do `.dfm` correspondente (título confirmado "Contratos de Venda de
> Gado"), nesta sessão — 49º arquivo `.pas` lido do módulo Pecuária. **Esta é a tela de
> LISTAGEM/consulta de `Contratos`** (tabela genérica compartilhada do ERP, filtrada por
> `GrupoComercial=8` = Pecuária) — a **edição/inclusão real é delegada a `TfmEdContVendaGado`**
> (unit `EdContVendaGado.pas`) — lida e documentada integralmente em `[[EdContVendaGado]]`
> (sessão posterior). Ver nota de método completa (limitação de DDL/tipos de coluna)
> em `[[ExportaDietas]]`, válida para todo o módulo.

---

**Status da implementação:** Legado — em produção (documentado via engenharia reversa, sem item de trabalho associado)

**Owner (curadoria):** @jefferson.arantes
**Tags:** #Pecuaria #Contrato #Venda #Comercial

---

## 0) Resumo executivo

- **O que é:** grade de consulta "Contratos de Venda de Gado" — lista contratos comerciais de
  venda de gado (`Contratos`, tabela genérica do ERP, `GrupoComercial=8`), com filtros ricos
  (Número, Período, Pessoa de Origem/Destino + suas Fazendas, Consultor/Vendedor, Tipo de
  Negociação, Situação), e delega Incluir/Editar a `TfmEdContVendaGado`.
- **Ações adicionais**: "Receber Docs." (marca `ControleRecebimento='S'` — confirmação de
  recebimento de documentação do contrato), "Previsões" (abre **[[Previsoes]]**, tela
  compartilhada do ERP, `iGrupo=7` — **satélite cross-module load-bearing, confirmado**: grava
  Fórmulas de Previsão vinculadas a `Contratos.Sequencial` deste Contrato, ver nota dedicada) e
  "Painel do Contrato" (abre `PainelContratos`, também genérica, read-only, não investigada em
  profundidade).
- **Impacto principal:** consulta apenas nesta unit; `DELETE` em cascata (`Contratos` +
  `ItContratosPec`); `UPDATE ControleRecebimento`; inclusão/edição delegadas a
  `EdContVendaGado`.

---

## 1) Conceito

| Termo | Definição |
|-------|-----------|
| `Contratos` é uma tabela genérica compartilhada, discriminada por `GrupoComercial` | `GrupoComercial=8` identifica contratos do módulo Pecuária — mesmo padrão de tabela genérica compartilhada já visto para `Tabelas` (discriminada por `Tipo`), aqui aplicado a Contratos comerciais do ERP como um todo. |
| Exclusão em cascata manual (sem trigger/FK) | `cdsContratosPecAfterDelete`: após excluir o `Contratos`, executa `DELETE FROM ItContratosPec WHERE Contrato=<iDel>` via SQL direto — a integridade referencial é mantida pela aplicação, não pelo banco. |
| "Situação" usa códigos numéricos como string, não letras | `cdsContratosPecSituacaoGetText`: `'1'`↔"PENDENTE", `'2'`↔"LIQUIDADO" — diferente do padrão predominante de 1 letra (`'A'`/`'F'`/etc.) usado na maioria dos outros campos de status do módulo. |
| "Receber Docs." é irreversível nesta tela | `btnRecDocContratoClick`: só permite marcar `ControleRecebimento='S'` (avisa "A Documentação já foi Recebida." se já estiver marcado) — não há botão para desmarcar/reverter a partir desta tela. |
| Atalho `Ctrl+F9` copia para a área de transferência e mostra um popup de confirmação | `FormKeyDown`: `Clipboard.AsText := S.Text; ShowMessage('ClipBoard.')` — variação do padrão de debug do módulo, aqui com uma confirmação visual explícita (`ShowMessage`) em vez de um painel `TcxMemo`. |
| Duplo-clique na grade abre a edição diretamente, marcando `fmEdContVendaGado.Tag:=1` | `gdContratosPecTabelaDblClick` — o significado do `Tag=1` não é usado em nenhum outro ponto desta unit; presumivelmente sinaliza para `EdContVendaGado` que foi aberta via duplo-clique (não confirmável sem ler aquela unit). |

---

## 2) Dicionário de campos da tela (`.dfm`)

| Controle | Classe | Rótulo/Caption | Vinculado a (campo BD) | Obrigatório | Observações |
|---|---|---|---|---|---|
| `deInicio`/`deFinal` | `TcxDateEdit` | (grupo "Período") | filtro apenas, `Data` | Implícito | Default: 1º de janeiro do ano corrente (`FirstDayYear(Date)`) / hoje (`Date`). Sem botão "Todos" — sempre há um intervalo aplicado. `Properties.DateButtons=[btnToday]`. |
| `ceNumero` | `TcxCurrencyEdit` (grupo "Número") | — | filtro apenas, `Numero` | Não | `DecimalPlaces=0`, `EditFormat`/`DisplayFormat='0'`, `Nullable=False`, `NullString='0'` — `0` = sem filtro. |
| `ceCodPessoaOrigem` (grupo "Pessoa de Origem") | `TcxCurrencyEdit` | — | filtro apenas, `Pessoa` (`C.Pessoa`) | Não | Busca F2 (`edDispAjudaPessoa(..., 'F1', 'P')`); `0`="..:: TODOS ::.." em `lblPessoaOrigem`. |
| `lblPessoaOrigem` | `TcxLabel` | — | somente exibição (nome da pessoa buscada) | — | `ReadOnly` visual (não é edit); atualizado por `ceCodPessoaOrigemPropertiesEditValueChanged`. |
| `ceCodPessoaDest` (grupo "Pessoa de Destino") | `TcxCurrencyEdit` | — | filtro apenas, `Produtor` (`C.Produtor`) | Não | Busca F2 (`edDispAjudaPessoa(..., 'C1', 'P')`); `0`="..:: TODOS ::.." em `lblPessoaDest`. |
| `lblPessoaDest` | `TcxLabel` | — | somente exibição (nome da pessoa buscada) | — | Mesma mecânica de `lblPessoaOrigem`. |
| `lkFazOrigem` (grupo "Fazenda Origem") | `TcxLookupComboBox` | — | filtro apenas, `LocalRetirada` (`C.LocalRetirada`) | Não | Lista `dmConsulta.dsUnidNeg` (`DetPessoas` filtrada por `ceCodPessoaOrigem`), `KeyFieldNames='Sequencial'`, `ImmediatePost=True`. Zerado sempre que `ceCodPessoaOrigem` muda. |
| `lkFazDest` (grupo "Fazenda Destino") | `TcxLookupComboBox` | — | filtro apenas, `LocalEntrega` (`C.LocalEntrega`) | Não | Lista `dmConsulta.dsUnd` (`DetPessoas` filtrada por `ceCodPessoaDest`), `KeyFieldNames='Codigo'` **(nota: usa alias `Codigo` para `Sequencial`, diferente de `lkFazOrigem`, que usa `Sequencial` diretamente — mesmo dado, SQL diferente)**, `ImmediatePost=True`. Zerado sempre que `ceCodPessoaDest` muda. |
| `cbNegociacao` (grupo "Tipo de Negociação") | `TcxLookupComboBox` | — | filtro apenas, `Negociacao` | Não | Lista `dmConsulta.dsTipoNegociacao` (`Tabelas.Tipo=22`, `GrupoComercial=8`) + "..:: TODOS ::..", `KeyFieldNames='Codigo'`, `ImmediatePost=True`. |
| `ceCodConsultor` (grupo **"Comprador"**, controles internos `gbConsultor`/`ceCodConsultor`/`lblConsultor`) | `TcxCurrencyEdit` | — | filtro apenas, `Consultor` (`C.Consultor`) | Não | **Inconsistência de nomenclatura confirmada nesta auditoria:** o `Caption` visível do `TcxGroupBox` (`gbConsultor`) é " Comprador " (`.dfm` linha ~920), mas os identificadores internos (`ceCodConsultor`, `lblConsultor`) e a mensagem de erro exibida ("Código do Vendedor Inválido.") usam "Consultor"/"Vendedor" — três nomes diferentes (Comprador/Consultor/Vendedor) para o mesmo campo `Contratos.Consultor` em pontos distintos da mesma tela. Busca F2 (`edDispAjudaPessoa(..., 'C3', 'P')`); `0`="..:: TODOS ::.." em `lblConsultor`. |
| `lblConsultor` | `TcxLabel` | — | somente exibição (nome da pessoa buscada) | — | Mesma mecânica de `lblPessoaOrigem`/`lblPessoaDest`. |
| `cbSituacao` (grupo "Situação") | `TcxComboBox` | — | filtro apenas, `Situacao` | — | `DropDownListStyle=lsFixedList` (lista fixa, não editável); itens exatos: `"..:: TODOS ::.."`, `"1 - PENDENTE"`, `"2 - LÍQUIDADO"` (sic — "LÍQUIDADO" grafado com acento no `Items.Strings`, mas o `GetText` do campo `Situacao` no grid exibe "LIQUIDADO" sem acento — pequena divergência de grafia entre filtro e grid). Filtro usa `Copy(cbSituacao.EditValue,1,1)` (primeiro caractere do texto do item = `'1'`/`'2'`). |
| `btnConsulta` (grupo sem caption, ao lado de "Situação") | `TcxButton` | "Consultar" | — | — | Dispara `btnConsultaClick` (SP-02). |
| `btnRecDocContrato` | `TcxButton` | "Receber Docs." | — | — | Ação de marcação de recebimento (`ControleRecebimento`). |
| `btnPrevisoes` | `TcxButton` | "Previsões" | — | — | Abre `Previsoes` (`iGrupo=7`), satélite cross-module. |
| `btnPainelContrato` | `TcxButton` | "Painel do Contrato" | — | — | Abre `PainelContratos`, genérica do ERP, `ShowHint=False` (diferente dos outros botões, que têm hint). |
| `dnNavega` | `TcxDBNavigator` | — | — | — | Apenas os botões Inserir/Excluir/Alterar (índices 6/7/8) são visíveis (`First`/`PriorPage`/`Prior`/`Next`/`NextPage`/`Last`/`Post`/`Cancel`/`Refresh`/`SaveBookmark`/`GotoBookmark`/`Filter` todos com `Visible=False`); Inserir/Alterar interceptados manualmente (abrem `EdContVendaGado`), Excluir segue fluxo padrão do `TDataSet` (`cdsContratosPecBeforeDelete`/`AfterDelete`). `Buttons.ConfirmDelete=False` (a confirmação é feita manualmente em `BeforeDelete` via `MessageDlg`, não pelo navigator). |

**Grid `gdContratosPecTabela`** (`TcxGridDBBandedTableView`, 4 bandas: sem título / "Origem" / "Destino" / sem título) — somente leitura (`OptionsData.Editing=False`, `OptionsData.Inserting=False`, `OptionsSelection.CellSelect=False`), colunas na ordem das bandas:

| Coluna | Banda | Caption | Campo (`cdsContratosPec`) | Formatação |
|---|---|---|---|---|
| `gdContratosPecTabelaNumero` | 1 (sem título) | "Número" | `Numero` | `TcxCurrencyEditProperties`, `DecimalPlaces=0`, `DisplayFormat`/`EditFormat='0'`. |
| `gdContratosPecTabelaData` | 1 (sem título) | (sem caption próprio, usa nome do campo "Data") | `Data` | `TcxDateEditProperties`, `DateButtons=[btnToday]`, `ImmediatePost=True` — **coluna é tecnicamente editável na grade** (apesar de `OptionsData.Editing=False` no nível da view, a propriedade `ImmediatePost` sugere resquício de edição inline não utilizado na prática). |
| `gdContratosPecTabelaPessoaOrigem` | 2 "Origem" | "Pessoa" | `NomePessoa` | Texto livre. |
| `gdContratosPecTabelaFazOrigem` | 2 "Origem" | "Fazenda" | `DescRetirada` | Texto livre. |
| `gdContratosPecTabelaPessoaDest` | 3 "Destino" | "Pessoa" | `NomeProd` | Texto livre. |
| `gdContratosPecTabelaFazDest` | 3 "Destino" | "Fazenda" | `DescEntrega` | Texto livre. |
| `gdContratosPecTabelaQtdTotal` | 4 (sem título) | "Qtd. Total" | `TotalQtd` | `TcxCurrencyEditProperties`, `DecimalPlaces=0`, `DisplayFormat`/`EditFormat='0'` — quantidade total de cabeças do contrato, sem casas decimais (arredondamento implícito de exibição, não confirmado em fórmula de cálculo — o valor vem pronto de `C.TotalQtd`, não é calculado nesta unit). |
| `gdContratosPecTabelaDocsRecebidos` | 4 (sem título) | "Docs. Recebidos" | `ControleRecebimento` | Via `cdsContratosPecControleRecebimentoGetText`: `'S'`→"SIM", `'N'`→"NÃO". |
| `gdContratosPecTabelaSituacao` | 4 (sem título) | "Situação" | `Situacao` | Via `cdsContratosPecSituacaoGetText`: `'1'`→"PENDENTE", `'2'`→"LIQUIDADO" (sem acento, diferente do item do combo `cbSituacao` — ver observação acima). |

Nenhum controle com `Visible=False` ou `Enabled=False` identificado nesta releitura completa do `.dfm` (todos os controles declarados na seção `type` estão presentes e visíveis na tela). Não há fórmulas de cálculo editáveis pelo usuário nesta tela — os campos numéricos (`ceNumero`, `TotalQtd` no grid) são apenas filtro/exibição de valores já persistidos em `Contratos`, sem nenhuma operação aritmética, `RoundTo`/`SimpleRoundTo`/`Round`/`Trunc`/`FormatFloat` no código desta unit; a única formatação numérica é `DecimalPlaces=0` (exibição sem casas decimais) nos componentes `cxCurrencyEdit`/`cxGridDBBandedColumn` citados acima.

---

## 5) Jornada do usuário + Especificação funcional

### SP-01 — Abrir a tela (`FormShow`)
Carrega Tipos de Negociação (`Tabelas.Tipo=22`, `GrupoComercial=8` — **novo domínio**
`Tabelas.Tipo=22` descoberto, compartilhado com outros módulos comerciais do ERP); período padrão
desde 1º de janeiro; executa consulta inicial.

### SP-02 — Consultar (`btnConsultaClick`)
```
SELECT C.Sequencial, C.Numero, C.Data, C.Pessoa, P.Nome NomePessoa, C.Produtor, PO.Nome NomeProd,
       C.LocalRetirada, LR.Descricao DescRetirada, C.LocalEntrega, LE.Descricao DescEntrega,
       C.Negociacao, N.Descricao DescNeg, C.ValorTotal, C.TotalQtd, C.ControleRecebimento, C.Situacao
FROM Contratos C
  JOIN Pessoas PO ON C.Produtor=PO.Codigo JOIN DetPessoas LR ON C.LocalRetirada=LR.Sequencial
  JOIN Pessoas P ON C.Pessoa=P.Codigo JOIN DetPessoas LE ON C.LocalEntrega=LE.Sequencial
  JOIN Tabelas N ON C.Negociacao=N.Codigo and N.Tipo=22
WHERE C.GrupoComercial=8 AND C.Empresa=<_iEmpresa> AND C.Safra=<_iSafra>
AND C.Data BETWEEN ... AND ...
[+ filtros opcionais de Número/Pessoa/Fazenda/Negociação/Consultor/Situação]
ORDER BY C.Data, C.Numero
```

### SP-03 — Incluir/Editar (botões do navegador, índices 6/8, e duplo-clique)
Abrem `TfmEdContVendaGado` (`iSeq=0` para novo, `iSeq=<Sequencial>` para editar); reconsultam
após fechar.

### SP-04 — Excluir (`cdsContratosPecBeforeDelete`/`AfterDelete`)
```
confirmar "Deseja Realmente Excluir o Registro Selecionado?"
se confirmado:
  ApplyUpdates exclui o Contratos
  DELETE FROM ItContratosPec WHERE Contrato=<excluído>  -- cascata manual
  CommitTransacaoTabelas(...)
```

### SP-05 — Confirmar Recebimento de Documentação (`btnRecDocContratoClick`)
```
se ControleRecebimento já='S': avisar "A Documentação já foi Recebida."
senão: confirmar "Deseja Confirmar o Recebimento da Documentação?"
  se confirmado: UPDATE Contratos SET ControleRecebimento='S' WHERE Sequencial=...
```

### SP-06 — Previsões (`btnPrevisoesClick`)
Se nenhum contrato selecionado, avisa; senão abre a tela genérica `Previsoes` (`iGrupo=7`,
`iContrato=<Sequencial>`).

### SP-07 — Painel do Contrato (`btnPainelContratoClick`)
Se nenhum contrato selecionado, avisa; senão abre a tela genérica `PainelContratos`.

### 5.3 Regras de negócio e validações

Nenhuma validação de parâmetros de filtro identificada nesta unit.

---

## 6) Integrações e dados

### 6.1 Integrações (internas)

- **[[EdContVendaGado]]** (`TfmEdContVendaGado`) — CRUD real (lido e documentado integralmente).
- **[[Previsoes]]** — satélite cross-module load-bearing (`iGrupo=7`), lida e documentada.
- **`PainelContratos`** — genérica do ERP, read-only, fora do escopo do módulo Pecuária.
- **`Tabelas.Tipo=22`** (Tipo de Negociação, `GrupoComercial=8`) — novo domínio descoberto,
  compartilhado com outros módulos comerciais.
- **`ItContratosPec`** — itens do contrato, excluídos em cascata manual.

### 6.2 Modelo de dados

**Tabela `Contratos`** (genérica compartilhada do ERP, `GrupoComercial=8` = Pecuária) — apenas os
campos vistos nesta unit:

| Coluna | Papel nesta tela |
|---|---|
| `Sequencial`/`Numero`/`Data`/`Empresa`/`Safra` | Identificação. |
| `Pessoa`/`Produtor` | Partes do contrato (Origem/Destino, nomenclatura não totalmente clara sem `EdContVendaGado`). |
| `LocalRetirada`/`LocalEntrega` | FK para `DetPessoas` (Fazendas). |
| `Negociacao` | FK para `Tabelas.Codigo` (`Tipo=22`). |
| `ValorTotal`/`TotalQtd` | Totais do contrato. |
| `ControleRecebimento` | `S`/`N` — recebimento de documentação. |
| `Situacao` | `1`(Pendente)/`2`(Liquidado). |

### 6.3 Triggers e Procedures do banco

Não identificadas nesta unit (a gravação real ocorre em `EdContVendaGado`).

---

## 7) Suporte: FAQ, mensagens, erros e troubleshooting

### 7.2 Catálogo de mensagens e erros

| Mensagem exata | Causa |
|---|---|
| "Código da Pessoa de Origem Inválido." / "Código da Pessoa de Destino Inválido." / "Código do Vendedor Inválido." | Busca de Pessoa sem correspondência |
| "Deseja Realmente Excluir o Registro Selecionado?" | Confirmação de exclusão |
| "A Documentação já foi Recebida." | Tentativa de confirmar recebimento já confirmado |
| "Deseja Confirmar o Recebimento da Documentação?" | Confirmação de recebimento |
| "Nenhum Contrato Selecionado. Selecione um Contrato para Defir as Previsões" | SP-06 sem seleção (nota: erro de digitação "Defir" no texto original) |
| "Nenhum Contrato Selecionado. Selecione um Contrato para Visualizar o Painel." | SP-07 sem seleção |

---

## 9) Notas de revisão

- **2026-09-02** (auditoria de profundidade campo-a-campo — dicionário de campos)
  - **O que mudou:** releitura completa do `.pas`/`.dfm` (sem reabrir a investigação de triggers
    genéricas `Contratos`/`ItContratosPec`, já concluída e correta). Seção "2) Dicionário de
    campos" reescrita: (1) grid `gdContratosPecTabela` desmembrado coluna a coluna (9 colunas em 4
    bandas) em vez de resumo em uma única linha; (2) adicionados os `TcxLabel` de exibição
    (`lblPessoaOrigem`/`lblPessoaDest`/`lblConsultor`) que faltavam; (3) **achado**: inconsistência
    de nomenclatura no grupo "Comprador" — `Caption` do `TcxGroupBox` diz "Comprador", mas os
    identificadores internos (`ceCodConsultor`/`lblConsultor`) e a mensagem de erro dizem
    "Consultor"/"Vendedor" — três nomes para o mesmo campo `Contratos.Consultor`; (4) **achado**:
    pequena divergência de grafia "LÍQUIDADO" (item do combo `cbSituacao`) vs. "LIQUIDADO" (texto
    exibido no grid via `GetText`) para o mesmo código `'2'`; (5) confirmado explicitamente que não
    há nenhuma fórmula de cálculo, arredondamento (`RoundTo`/`Round`/`Trunc`/`FormatFloat`) ou
    campo negativo nesta unit — é uma tela de listagem/filtro pura, sem inputs de valor calculado;
    (6) confirmado, via `.dfm`, que não há controles com `Visible=False`/`Enabled=False` ocultos.
    Menu: confirmado em `[[iniModuloPecuaria]]` (`sReferencia='ContratoVendaGado'`, sem parâmetro
    de contexto) — já estava correto, não havia marcação de "chamador não identificado" nesta nota.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** releitura de `Pecuaria/ContVendaGado.pas` (494 linhas) e `.dfm` (1365 linhas)
    nesta sessão.

- **2026-09-01** (auditoria de profundidade — módulo Pecuária, 2ª atualização)
  - **O que mudou:** achado de satélite cross-module — a tela "Previsões" (botão `btnPrevisoes`),
    antes dispensada como "genérica do ERP, fora do escopo", na verdade **grava** Fórmulas de
    Previsão vinculadas ao `Contrato.Sequencial` desta tela (`Previsoes.Contrato`) — é
    load-bearing. Ver `[[Previsoes]]`, nota criada nesta sessão.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** ver `[[Previsoes]]`.

- **2026-09-01** (auditoria de profundidade — módulo Pecuária)
  - **O que mudou:** removida a marcação de "nota parcial" — `[[EdContVendaGado]]` (CRUD real) já
    havia sido lida e documentada integralmente em sessão posterior; apenas as referências
    cruzadas aqui (Status, topo, 6.1) ainda não tinham sido atualizadas.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** ver `[[EdContVendaGado]]`.

- **2026-08-28** (criação da nota — módulo Pecuária)
  - **O que mudou:** nota criada do zero, a partir de leitura 100% literal de
    `Pecuaria/ContVendaGado.pas` (494 linhas) + `.dfm` (título confirmado "Contratos de Venda de
    Gado"). Documentada a tela de listagem sobre a tabela genérica `Contratos`
    (`GrupoComercial=8`), com CRUD real delegado a `EdContVendaGado`.
    Descoberto `Tabelas.Tipo=22` (Tipo de Negociação).
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** código-fonte `Pecuaria/ContVendaGado.pas` + `.dfm`.
