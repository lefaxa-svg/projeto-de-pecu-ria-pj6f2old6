> **Nota de método**: este documento descreve uma tela de um sistema LEGADO já em produção,
> reconstruída por engenharia reversa do código-fonte — não é uma especificação de feature nova
> obtida por entrevista com um PO. Por isso, toda seção que normalmente viria de uma conversa de
> negócio (motivação, métricas, objetivos) foi preenchida por **inferência a partir do
> comportamento do código**, e está marcada explicitamente como `(inferência)`. Onde nem o código
> nem o contexto do módulo permitem inferir nada com segurança, o campo está como `N/A`.
> Fonte: leitura 100% literal de `Pecuaria/ContratoCVGado.pas` (551 linhas, unit `ContratoCVGado`,
> classe `TfmContratoCVGado`) e do `.dfm` correspondente (**sem `Caption` de formulário definida
> no `.dfm`** — o título é montado dinamicamente, ver achado abaixo), nesta sessão — 56º arquivo
> `.pas` lido do módulo Pecuária. **Achado central desta nota:** esta tela grava numa tabela
> **`ContratosPec`/`ItContratosPec` — totalmente distinta** da tabela genérica `Contratos`
> (compartilhada com outros módulos do ERP) usada por `[[ContVendaGado]]`/`[[ContCompraGado]]` —
> ou seja, o AgriManager Pecuária possui **2 sistemas de contrato de compra/venda de gado
> paralelos e não integrados entre si** (ver achado em 1). CRUD real delegado a
> `TfmEdContratoCVGado` (unit `EdContratoCVGado.pas`) — lida e documentada integralmente em
> `[[EdContratoCVGado]]` (sessão posterior). Ver nota de método completa (limitação de DDL/tipos de coluna) em
> `[[ExportaDietas]]`, válida para todo o módulo.

---

**Status da implementação:** Legado — em produção (documentado via engenharia reversa, sem item de trabalho associado)

**Owner (curadoria):** @jefferson.arantes
**Tags:** #Pecuaria #Contrato #Compra #Venda #Comercial

---

## 0) Resumo executivo

- **O que é:** grade de consulta de "Contratos de Compra/Venda de Gado" — classe **única e
  reutilizável** (`TfmContratoCVGado`) para ambos os sentidos, diferenciados apenas pela
  propriedade pública `sTipoContrato` ('C'=Compra / 'V'=Venda), setada pelo formulário chamador
  antes de exibir a tela (padrão "modal satélite" já visto em outras telas do módulo, aqui
  aplicado à tela de consulta inteira, não só a um popup).
- **Achado crítico de arquitetura:** grava em `ContratosPec`/`ItContratosPec` — tabelas
  **próprias do domínio Pecuária**, com estrutura de "Pessoa Origem/Pessoa Destino/Fazenda
  Origem/Fazenda Destino" (mais rica que o par `Pessoa`/`Produtor` da tabela genérica
  `Contratos`) — **não relacionadas** à tabela `Contratos` usada por `[[ContVendaGado]]`/
  `[[ContCompraGado]]`. Não há nesta unit nenhum `JOIN`/referência cruzada entre `ContratosPec` e
  `Contratos` — são 2 fluxos de negócio paralelos e aparentemente independentes dentro do mesmo
  módulo (dúvida de negócio: qual é o fluxo "vigente"/preferido — talvez `ContratoCVGado` seja
  uma reformulação mais nova do mesmo conceito de `ContVendaGado`/`ContCompraGado`, mas isso não
  pôde ser confirmado apenas pelo código).
- **Ciclo de vida do Contrato via `Situacao`:** aberto → (`'A'` Atendido Completamente | `'C'`
  Cancelado) — cancelamento bloqueado se já Atendido ou já Cancelado, e bloqueado se já existirem
  `RomaneiosPec` vinculados (`RomaneiosPec.CCVG`); exclusão física só permitida se já Cancelado.
- **Impacto principal:** `UPDATE ContratosPec.Situacao='C'` (cancelamento, com verificação de
  Romaneios vinculados); `UPDATE ContratosPec.DocsRecebidos='S'` (confirmação de recebimento de
  documentação); `DELETE ContratosPec` + `DELETE ItContratosPec` (só se `Situacao='C'`); CRUD de
  Inclusão/Edição delegado a `EdContratoCVGado`.

---

## 1) Conceito

| Termo | Definição |
|-------|-----------|
| Rótulos de tela trocam de significado conforme `sTipoContrato` | Em Compra (`'C'`): "Pessoa Origem"→Fornecedor, "Pessoa Destino"→Empresa, "Consultor"→Comprador. Em Venda (`'V'`): "Pessoa Origem"→Empresa, "Pessoa Destino"→Cliente, "Consultor"→Vendedor — mesmo padrão de inversão semântica de papéis já visto em `[[ContVendaGado]]`/`[[ContCompraGado]]`, mas aqui aplicado a uma tabela e um par de campos (`PessoaOrigem`/`PessoaDest`) totalmente diferentes. |
| `ItContratosPec` é o detalhe por Animal/Categoria negociado | A consulta agrega `SUM(Icp.Quantidade)`, `SUM(Icp.PesoTotal)`, `AVG(Icp.PesoMedio@)`, `SUM(Icp.VlrTotal)`, `AVG(Icp.VlrCabeca)`, `AVG(Icp.Vlr@)` por Contrato — implica que `ItContratosPec` tem 1 linha por item/categoria negociado dentro do Contrato (estrutura completa confirmada em `[[EdContratoCVGado]]`, mesmos campos de `[[EdContVendaGado]]`). |
| Sem `Caption` de formulário no `.dfm` | Achado: o título da janela não é definido nem no `.dfm` nem em nenhum handler desta unit — provavelmente herdado do `Caption` já setado pelo formulário chamador antes de `ShowModal`, ou deixado em branco/padrão do `TFormBase` (mecanismo de definição não identificado nesta unit). |
| Botão "C" desabilitado (`cxButton2`) | `Caption='C'`, `Enabled = False`, sem `OnClick` — 6º achado do módulo desse padrão de botão morto/placeholder (mesmo padrão de `[[CausaMortis]]`, `[[FaixaEtaria]]`, etc.). |
| Sem arredondamento/validação de sinal em nenhum filtro numérico | Confirmado por releitura (2026-09-02): todos os filtros numéricos (`ceNumero`, `ceCodPessoaOrigem`, `ceCodPessoaDest`, `ceCodConsultor`) usam consistentemente `EditValue>0` para decidir se aplicam o filtro — nenhum aceita/valida negativo explicitamente, mas o padrão `>0` os trata uniformemente como "sem filtro" (diferente da inconsistência `if EditValue then` vista em `[[ContratoBoitel]]`). Não há nenhuma fórmula de cálculo em Object Pascal nesta unit — todos os totais (`QtdTotal`/`PesoTotal`/`ValorTotal`/etc.) vêm prontos do `SUM`/`AVG` da consulta SQL. |

---

## 2) Dicionário de campos da tela (`.dfm`)

| Controle | Classe | Rótulo/Caption | Vinculado a (campo BD) | Obrigatório | Observações |
|---|---|---|---|---|---|
| `deInicio`/`deFinal` | `TcxDateEdit` | (grupo Período) | `Cp.Data` (filtro) | — | Default: últimos 30 dias. |
| `ceNumero` | `TcxCurrencyEdit` | — | `Cp.Numero` (filtro) | — | — |
| `ceCodPessoaOrigem`/`ceCodPessoaDest` | `TcxCurrencyEdit` | Fornecedor/Empresa ou Empresa/Cliente (conforme Tipo) | `Cp.PessoaOrigem`/`Cp.PessoaDest` | — | F2 abre ajuda de Pessoa com grupos distintos por Tipo ('F1'/'E1' Compra; 'E1'/'C1' Venda). |
| `lkFazOrigem`/`lkFazDest` | `TcxLookupComboBox` | — | `Cp.FazOrigem`/`Cp.FazDest` | — | Recarregado a cada troca de Pessoa (`Exit`), via `DetPessoas` filtrado por `Codigo=Pessoa`. |
| `cbTipoNegociacao` | `TcxComboBox` | — | `Cp.Negociacao` | — | — |
| `ceCodConsultor` | `TcxCurrencyEdit` | Comprador/Vendedor (conforme Tipo) | `Cp.Consultor` | — | F2 abre ajuda de Pessoa ('C3' Compra / 'V1' Venda). |
| `cbSituacao` | `TcxComboBox` | — | `Cp.Situacao` (filtro) | — | — |
| Grid `gdContratosPec`/`gdContratosPecDBBandedTableView1` (colunas, com banda "Origem"/"Destino") | `TcxGridDBBandedColumn` | ver linhas abaixo | `cdsContratosPec` (agregado) | — | Estilo condicional via `StylesGetContentStyle`: lê `ARecord.Values[8]` (índice posicional da coluna `Situacao` na consulta) — Situação='A' destaque (`cxStyleEvidence`), ='C' fundo vermelho (`cxStyleBackRed`). |
| ↳ `...Numero` | `TcxGridDBBandedColumn` | "Número" | `Numero` | — | — |
| ↳ `...Data` | `TcxGridDBBandedColumn` | (sem Caption → herda "Data") | `Data` | — | — |
| ↳ `...PessoaOrigem` | `TcxGridDBBandedColumn` | (sem Caption fixo — sobrescrito em runtime p/ "Fornecedor"/"Empresa", banda "Origem") | `PessoaOrigem` | — | — |
| ↳ `...FazOrigem` | `TcxGridDBBandedColumn` | "Fazenda" (banda "Origem") | `FazOrigem` | — | — |
| ↳ `...PessoaDest` | `TcxGridDBBandedColumn` | (sem Caption fixo — sobrescrito em runtime p/ "Empresa"/"Cliente", banda "Destino") | `PessoaDest` | — | — |
| ↳ `...FazDest` | `TcxGridDBBandedColumn` | "Fazenda" (banda "Destino") | `FazDest` | — | — |
| ↳ `...QtdTotal` | `TcxGridDBBandedColumn` | "Qtd. Total" | `QtdTotal` (`SUM`, sem arredondamento Delphi) | — | — |
| ↳ `...DocsRecebidos` | `TcxGridDBBandedColumn` | "Docs. Recebidos" | `DocsRecebidos` | — | — |
| ↳ `...Situacao` | `TcxGridDBBandedColumn` | (sem Caption) | `Situacao` | **`Visible=False`** | **Achado (2026-09-02)**: a coluna existe na grade mas é sempre oculta — só é usada indiretamente para colorir a linha (`ARecord.Values[8]`, ver acima), o usuário nunca vê o valor textual de `Situacao` diretamente na grade. |
| `cePesoTotal`/`cePesoMedio`/`ceValorTotal`/`ceVlrMedioCabeca`/`ceVlrMedioArroba` | `TcxDBCurrencyEdit` | "Total"/"Médio em @" (Peso); "Total"/"Médio por Cabeça"/"Médio por @" (Valor) | campos agregados do registro focado | — | Todos `Enabled=False`+`ReadOnly=True` — somente exibição (não é achado, é design intencional); sem `RoundTo`/`Round` — valores vêm prontos do `AVG`/`SUM` da consulta. |
| `dnNavega` | `TcxDBNavigator` | — | `dsContratosPec` | — | Só expõe Insert(F3)/Delete(F4)/Edit(F5) — First/PriorPage/Prior/Next/NextPage/Last/Post/Cancel/Refresh/SaveBookmark/GotoBookmark/Filter todos `Visible=False`. |
| `btnRecDocContrato` | `TcxButton` | "Receber Docs." | `Cp.DocsRecebidos` | — | Confirma recebimento de documentação. |
| `btnEstornar` | `TcxButton` | "Cancelar Contrato" | `Cp.Situacao` | — | Cancela o Contrato. |
| `cxButton2` | `TcxButton` | 'C' | — | — | **`Enabled=False`, sem handler** — achado de botão morto. |

---

## 5) Jornada do usuário + Especificação funcional

### SP-01 — Abrir a tela (`FormShow`)
Ajusta rótulos conforme `sTipoContrato`; período padrão = últimos 30 dias; dispara consulta
automaticamente.

### SP-02 — Consultar (`btnConsultaClick`)
`SELECT` agregado (`GROUP BY`) de `ContratosPec JOIN Pessoas (Origem/Dest) JOIN DetPessoas
(FazOrigem/FazDest) LEFT JOIN ItContratosPec`, filtrado sempre por `Tipo = sTipoContrato` além
dos filtros opcionais de tela.

### SP-03 — Incluir/Editar (`dnNavegaButtonsButtonClick`) → `TfmEdContratoCVGado`
Inclusão (`iSeq:=0`); Edição bloqueada se `Situacao='C'` ("Não é Permitido Editar Contratos
Cancelados."); título da modal montado dinamicamente ("Edição do Contrato de
Compra/Venda de Gado").

### SP-04 — Visualizar (duplo-clique) → `TfmEdContratoCVGado` com `Tag=1`
Abre a mesma tela de edição em modo visualização (`Tag:=1`, mecanismo de somente-leitura
delegado à unit satélite, não confirmado nesta nota); título "Visualização do Contrato...".

### SP-05 — Excluir (`cdsContratosPecBeforeDelete`/`AfterDelete`)
Só permitido se `Situacao='C'` (Cancelado); senão bloqueia com "Não é Permitido Excluir
Contratos não Cancelados."; exclui `ItContratosPec` do Contrato antes do `CommitTransacaoTabelas`
(exclusão em cascata manual, mesmo padrão de `[[ContVendaGado]]`).

### SP-06 — Confirmar Recebimento de Documentação (`btnRecDocContratoClick`)
Bloqueia se já `DocsRecebidos='S'`; senão confirma e faz `UPDATE`.

### SP-07 — Cancelar/Estornar (`btnEstornarClick`)
Bloqueia se `Situacao='A'` (Atendido) ou já `Situacao='C'`; verifica `RomaneiosPec.CCVG` vinculado
(bloqueia se houver); senão `UPDATE Situacao='C'`.

### 5.3 Regras de negócio e validações

- **BR-001 — Edição bloqueada para Contratos Cancelados.** "Não é Permitido Editar Contratos
  Cancelados."
- **BR-002 — Exclusão permitida apenas para Contratos Cancelados.** "Não é Permitido Excluir
  Contratos não Cancelados."
- **BR-003 — Cancelamento bloqueado se Atendido, já Cancelado, ou com Romaneios vinculados.**
  "O Contrato já foi Atendido Completamente e não pode ser Cancelado." / "O Contrato já foi
  Cancelado." / "Não é permitido Cancelar contratos com Romaneios, Verifique."
- **BR-004 — Recebimento de documentação é idempotente com aviso.** "A Documentação já foi
  Recebida."
- **Achado de qualidade de código:** em `ceCodPessoaOrigemPropertiesEditValueChanged` e
  `ceCodPessoaDestPropertiesEditValueChanged` e `ceCodConsultorPropertiesEditValueChanged`, a
  linha `ceCodPessoaOrigem.SelectAll` (e equivalentes) está **fora do bloco `else`** por falta de
  `Begin/End` — executa incondicionalmente após o `MessageDlg` do `else`, mesmo quando a Pessoa
  foi encontrada (efeito colateral: seleciona o texto do campo mesmo em caso de sucesso; efeito
  provavelmente inofensivo, mas é um erro de indentação/bloco clássico do Object Pascal, idêntico
  em 3 handlers).

---

## 6) Integrações e dados

### 6.1 Integrações (internas)

- **[[EdContratoCVGado]]** (`TfmEdContratoCVGado`) — CRUD real (lido e documentado integralmente).
- **`RomaneiosPec`** — verificação de vínculo antes de permitir cancelamento (`CCVG`).

### 6.2 Modelo de dados

**Tabela `ContratosPec`** (campos confirmados via consulta desta unit):

| Campo | Tipo (inferido) | Observações |
|---|---|---|
| `Sequencial` | Integer | PK. |
| `Numero` | Integer | Número do Contrato. |
| `Data` | DateTime | — |
| `PessoaOrigem`/`PessoaDest` | Integer | FK `Pessoas.Codigo`; papel semântico depende de `Tipo`. |
| `FazOrigem`/`FazDest` | Integer | FK `DetPessoas.Sequencial`. |
| `Negociacao` | String(1) | Tipo de Negociação. |
| `Consultor` | Integer | FK `Pessoas.Codigo` (Comprador/Vendedor). |
| `DocsRecebidos` | String(1) | `'S'`/`'N'`. |
| `Situacao` | String(1) | (aberto)/`'A'` Atendido/`'C'` Cancelado. |
| `Tipo` | String(1) | `'C'` Compra / `'V'` Venda. |
| `Safra` | Integer | Escopo. |

**Tabela `ItContratosPec`** (estrutura completa não confirmada — apenas colunas agregadas
observadas: `Quantidade`, `PesoTotal`, `PesoMedio@`, `VlrTotal`, `VlrCabeca`, `Vlr@`, `Contrato`
FK, `Sequencial` PK).

### 6.3 Triggers e Procedures do banco

**`[[TD_ContratosPec]]`** (achado na auditoria de 2026-09-02) — dispara no `DELETE ContratosPec`
desta unit; bloqueia a exclusão se houver `ClassFinComercial`/`MovFinComercial`/`Previsoes`
vinculados **com `GrupoComercial=7`** — achado de risco: esse é um código da tabela genérica
`Contratos`, não de `ContratosPec` (que usa `Tipo`, não `GrupoComercial`), reforçando a
ambiguidade de FK já documentada. Ver nota da trigger para o detalhamento completo.

---

## 7) Suporte: FAQ, mensagens, erros e troubleshooting

### 7.2 Catálogo de mensagens e erros

| Mensagem exata | Causa |
|---|---|
| "Não é Permitido Editar Contratos Cancelados." | Edição de Contrato com `Situacao='C'` |
| "Não é Permitido Excluir Contratos não Cancelados." | Exclusão de Contrato com `Situacao<>'C'` |
| "O Contrato já foi Atendido Completamente e não pode ser Cancelado." | Cancelamento com `Situacao='A'` |
| "O Contrato já foi Cancelado." | Cancelamento repetido |
| "Não é permitido Cancelar contratos com Romaneios, Verifique." | `RomaneiosPec.CCVG` vinculado |
| "A Documentação já foi Recebida." | `DocsRecebidos` já `'S'` |
| "Pessoa não Cadastrada." | Busca de Pessoa/Consultor sem correspondência |

---

## 9) Notas de revisão

- **2026-09-02** (auditoria campo-a-campo — módulo Pecuária)
  - **O que mudou:** achada e documentada **`[[TD_ContratosPec]]`** — gap real de trigger não
    identificada, bloqueia `DELETE ContratosPec` com achado de risco (usa `GrupoComercial=7`, um
    conceito da tabela genérica `Contratos`, não de `ContratosPec`). Dicionário de campos
    expandido: colunas do grid detalhadas 1 a 1, incluindo achado de que a coluna `Situacao`
    (usada para colorir a linha) é sempre `Visible=False`. Confirmado que não há nenhum
    arredondamento/cálculo em Object Pascal nesta unit.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** ver `[[TD_ContratosPec]]`.

- **2026-09-01** (auditoria de profundidade — módulo Pecuária, 2ª atualização)
  - **O que mudou:** achado crítico concretizado — `[[TIU_ItContratosPec]]`/
    `[[TD_ItContratosPec]]` (trigger disparada em `[[EdContratoCVGado]]`) fazem `UPDATE Contratos
    ... WHERE Sequencial=@Contrato` usando `ContratosPec.Sequencial` como chave, sem checar a
    família — risco real de corrupção silenciosa de `Contratos.ValorTotal`/`TotalQtd` de outro
    Contrato, ou no-op silencioso. Não é mais uma suspeita teórica de "achado de risco", é um
    mecanismo confirmado por leitura da trigger.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** ver `[[TIU_ItContratosPec]]`, `[[EdContratoCVGado]]`.

- **2026-09-01** (auditoria de profundidade — módulo Pecuária)
  - **O que mudou:** removida a marcação de "nota parcial" — `[[EdContratoCVGado]]` (CRUD real)
    já havia sido lida e documentada integralmente em sessão posterior, confirmando a estrutura
    completa de `ItContratosPec` neste contexto; apenas as referências cruzadas aqui (Status,
    topo, 1, 6.1) ainda não tinham sido atualizadas.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** ver `[[EdContratoCVGado]]`.

- **2026-08-28** (criação da nota — módulo Pecuária)
  - **O que mudou:** nota criada do zero, a partir de leitura 100% literal de
    `Pecuaria/ContratoCVGado.pas` (551 linhas) + `.dfm`. Documentada como tela única reutilizável
    para Compra/Venda (`sTipoContrato`), gravando em `ContratosPec`/`ItContratosPec`. **Achado
    crítico:** esta é uma segunda família de telas de contrato de gado, paralela e não integrada
    a `[[ContVendaGado]]`/`[[ContCompraGado]]` (tabela genérica `Contratos`). Achado de código:
    `SelectAll` fora do bloco condicional em 3 handlers.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** código-fonte `Pecuaria/ContratoCVGado.pas` + `.dfm`; ver
    `[[ContVendaGado]]`, `[[ContCompraGado]]`; esclarecer com negócio a relação/motivo de
    coexistência dos 2 sistemas de contrato.
