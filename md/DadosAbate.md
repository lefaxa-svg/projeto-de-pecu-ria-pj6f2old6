> **Nota de método**: este documento descreve uma tela de um sistema LEGADO já em produção,
> reconstruída por engenharia reversa do código-fonte — não é uma especificação de feature nova
> obtida por entrevista com um PO. Por isso, toda seção que normalmente viria de uma conversa de
> negócio (motivação, métricas, objetivos) foi preenchida por **inferência a partir do
> comportamento do código**, e está marcada explicitamente como `(inferência)`. Onde nem o código
> nem o contexto do módulo permitem inferir nada com segurança, o campo está como `N/A`.
> Fonte: leitura 100% literal de `Pecuaria/DadosAbate.pas` (550 linhas, unit `DadosAbate`, classe
> `TfmDadosAbate`) e do `.dfm` correspondente (título confirmado "Lançamento dos Dados de Abate
> dos Animais"), nesta sessão — 55º arquivo `.pas` lido do módulo Pecuária. CRUD real delegado a
> `TfmEdDadosAbate` (unit `EdDadosAbate.pas`) — lida e documentada integralmente em
> `[[EdDadosAbate]]` (sessão posterior). Chama `[[spAnalEmbarques]]` (81 linhas, lida integralmente
> nesta sessão). Ver nota de método
> completa (limitação de DDL/tipos de coluna) em `[[ExportaDietas]]`, válida para todo o módulo.

---

**Status da implementação:** Legado — em produção (documentado via engenharia reversa, sem item de trabalho associado)

**Owner (curadoria):** @jefferson.arantes
**Tags:** #Pecuaria #Abate #Frigorifico #Comercial #Relatorio

---

## 0) Resumo executivo

- **O que é:** grade de consulta "Lançamento dos Dados de Abate dos Animais" — lista registros de
  `DadosAbates` (1 registro por venda/remessa de animais a um Frigorífico), filtráveis por
  período, Número da Nota, Frigorífico, Proprietário e Lote. CRUD real (Incluir/Alterar) delegado
  a `TfmEdDadosAbate`.
- **2 relatórios adicionais** via menu de contexto do botão "Imprimir": **Resultado de Abates**
  (analítico, por Movimento de venda individual, ou sintético, agregado por Nota) e **Análise de
  Embarques** (via `[[spAnalEmbarques]]`) — estatística de tamanho/frequência de embarques
  (lotes de venda) no período.
- **Impacto principal:** `DELETE` em `DadosAbates` (bloqueado se já existir `MovAnimais`
  vinculado — "Desvincule as Vendas antes de excluir"); CRUD de inclusão/edição delegado à unit
  satélite `EdDadosAbate`.

---

## 1) Conceito

| Termo | Definição |
|-------|-----------|
| `DadosAbates` é o "documento fiscal" do abate, `MovAnimais` é o rastreio físico | Um registro de `DadosAbates` (Frigorífico/Data/Qtd/Valores) pode estar vinculado a N `MovAnimais.DadosAbate` (1 por SubGrupo/Lote efetivamente movimentado na venda) — por isso a exclusão verifica `COUNT(MovAnimais) WHERE DadosAbate = ...` antes de permitir apagar. |
| Relatório "Resultado de Abates" tem 2 granularidades (Sintético/Analítico) no mesmo menu | `miResultAbatesClick` decide via `(Sender as TMenuItem).Name = 'miResultSintetico'` — Sintético agrega só por `DadosAbates` (1 linha por Nota/Frigorífico/Sexo/Venda); Analítico faz `JOIN MovAnimais/SubGruposLotes/LotesBaias` trazendo 1 linha por Movimento de venda (`Operacao='V'`), com Proprietário/Lote de origem. |
| "Análise de Embarques" agrupa vendas em blocos de tamanho dinâmico (`@Fator`) | `[[spAnalEmbarques]]` não agrupa por um critério de negócio explícito (ex.: por semana) — agrupa os registros de `DadosAbates` ordenados por Data em **blocos de N registros consecutivos**, onde N (`@Fator`) é escalado pelo total de registros (`@RegTotal`): 1 registro por bloco se ≤10 total, 2 se 10-20, 3 se 20-30, senão `@RegTotal / 9` — ou seja, sempre produz aproximadamente 9-10 "embarques" agregados no relatório, independente do volume real de vendas (achado: é uma amostragem/agrupamento estatístico artificial, não um agrupamento por evento real de embarque). |
| **(achado, auditoria 2026-09-02) grid `gdDadosAbateSubGrupos` é código morto/órfão** | Declarado no `.dfm` com colunas Lote-SG/U.O./Tipo do Lote/Situação/Seq./Proprietário/Raça/Categoria/Castrado/Sexo/Saldo Atual (praticamente idênticas às da view "Lote" de `[[MonitoramentoBaiasLotes]]`, provável origem por cópia) — mas **não está associado a nenhum `TcxGridLevel`** (só `gdDadosAbateTabela` está, via `gdDadosAbateLevel`) e **`DataController.DataSource` nunca é definido**. Nunca é exibido nem populado por nenhum código do `.pas`. |

---

## 2) Dicionário de campos da tela (`.dfm`)

| Controle | Classe | Rótulo/Caption | Vinculado a (campo BD) | Obrigatório | Observações |
|---|---|---|---|---|---|
| `cbFazendas`/`cbRetiros` | `TcxLookupComboBox` | Fazendas / Retiros | escopo | — | Fazendas filtradas por `DetPessoas.Pecuaria='S'` + permissão `'UN'`. |
| `deInicio`/`deFinal` | `TcxDateEdit` | (grupo sem rótulo próprio) | `DadosAbates.Venda` (filtro) | — | Default: últimos 30 dias. |
| `teNumero` | `TcxTextEdit` | — | `DadosAbates.Numero` (filtro `LIKE`) | — | Busca parcial. |
| `ceFrig` | `TcxCurrencyEdit` | — | `DadosAbates.Frigorifico` (filtro) | — | F2 abre ajuda de Pessoa (`edDispAjudaPessoa`). |
| `ceProp` | `TcxCurrencyEdit` | — | `SubGruposLotes.Proprietario` (filtro via `EXISTS`) | — | F2 abre ajuda de Pessoa. |
| `cbLotesBaias` | `TcxLookupComboBox` | — | `SubGruposLotes.Lote` (filtro via `EXISTS`) | — | "..:: TODOS ::.." como opção 0. |
| Grid `gdDadosAbate`/`gdDadosAbateTabela` (colunas, com bandas "Valor"/"Carcaça"/"Incentivo Fiscal"/"Outras Receitas"/"Despesas") | `TcxGridDBBandedColumn` | ver linhas abaixo | `cdsDadosAbate` | — | Todas somente leitura na prática (consulta); duplo-clique abre `EdDadosAbate` (`gdDadosAbateTabelaDblClick`). |
| ↳ colunas de identificação | — | Seq./Núm./Frigorífico/Data Venda/Qtd. Animais/Sexo | `Sequencial`/`Numero`/`Frigorifico`/`Venda`/`QtdAnimais`/`Sexo` | — | — |
| ↳ banda "Valor" | — | Unit./Desc./@ | `VlrUnit`/`Desconto`/`VlrArroba` | — | Sem arredondamento Delphi visível na coluna (formatação só de exibição). |
| ↳ banda "Carcaça" | — | KG Vivo/KG/% | `PesoVivo`/`PesoCarcaca`/`PercRC` | — | — |
| ↳ banda "Incentivo Fiscal" | — | Vlr./Animais | `VlrIncFiscal`/`AnimaisIncFiscal` | — | — |
| ↳ banda "Outras Receitas" | — | Vlr./Animais | `VlrOutRec`/`AnimaisOutRec` | — | — |
| ↳ banda "Despesas" | — | Imp. Taxas/Out. Desp. | `VlrImpTaxas`/`VlrOutDesp` | — | — |
| `dnNavega` | `TcxDBNavigator` | — | — | — | F3=Insert, F4=Delete, F5=Edit (atalhos custom). |
| `btnImprimir` | `TcxButton` (+ `pmImprimir` popup) | Imprimir | — | — | 3 itens: Resultado (Sintético/Analítico), Análise de Embarques. |
| `mmQuery` | `TcxMemo` | — | — | Oculto por padrão | Painel de debug — F9. |

---

## 5) Jornada do usuário + Especificação funcional

### SP-01 — Abrir a tela (`FormShow`)
Verifica permissão de escrita (`TemPermissao`); carrega Fazendas Pecuária-habilitadas (filtradas
por permissão `'UN'` se não Supervisor); período padrão = últimos 30 dias; Fazenda padrão =
Fazenda corrente do usuário.

### SP-02 — Trocar Fazenda/Retiro
Recarrega Retiros (seleciona automaticamente o primeiro); ao trocar Retiro, recarrega Lotes do
Retiro/Safra e **dispara a consulta automaticamente** (`btnConsultaClick(Sender)` chamado
diretamente no final do handler — não espera clique do usuário).

### SP-03 — Consultar (`btnConsultaClick`)
`SELECT` em `DadosAbates JOIN Pessoas` (Frigorífico), filtros opcionais por período, Número,
Frigorífico, Proprietário/Lote (via `EXISTS` em `MovAnimais/SubGruposLotes`).

### SP-04 — Incluir/Alterar/Excluir (`dnNavegaButtonsButtonClick`)
Exige Retiro selecionado; abre `TfmEdDadosAbate` modal com `Tag=0` (Incluir, botão índice 6) ou
`Tag=<Sequencial>` (Alterar, índice 8 — também acionado por duplo-clique na grade); herda
`ReadOnly` conforme permissão da tela pai.

### SP-05 — Excluir (`cdsDadosAbateBeforeDelete`/`AfterDelete`)
Bloqueia se `COUNT(MovAnimais WHERE DadosAbate=...) > 0`; senão confirma e exclui via
`CommitTransacaoTabelas`.

### SP-06 — Imprimir "Resultado de Abates" (`miResultAbatesClick`) — Sintético ou Analítico
Monta consulta com múltiplos campos de filtro embutidos como colunas literais (`fFazenda`,
`fRetiro`, etc. — padrão de relatório do módulo, valores de tela viram colunas do dataset de
impressão); Sintético agrega só `DadosAbates`; Analítico faz `JOIN MovAnimais/SubGruposLotes/
LotesBaias/Pessoas` (Proprietário). Template: `ResultAbatesSintetico.rtm` ou
`ResultadoAbates.rtm`.

### SP-07 — Imprimir "Análise de Embarques" (`miAnalEmbarquesClick`) → `[[spAnalEmbarques]]`
Template: `AnalEmbarques.rtm`.

### 5.3 Regras de negócio e validações

- **BR-001 — Retiro obrigatório para Incluir/Alterar/Excluir.** Mensagem: "Selecione um Retiro
  para os Dados de Abate."
- **BR-002 — Exclusão bloqueada se houver `MovAnimais` vinculado.** Mensagem: "Existem Vendas
  vinculadas aos Dados de Abate. Desvincule as Vendas antes de excluir os Dados de Abate."
- **BR-003 — `Análise de Embarques` agrupa por lote artificial de ~9-10 blocos**, não por evento
  real de embarque (ver Conceito) — achado de possível confusão de interpretação do relatório por
  parte do usuário final (o nome "Embarque" sugere 1 linha = 1 evento físico de carregamento, mas
  na prática é um agrupamento estatístico de N vendas consecutivas por data).

---

## 6) Integrações e dados

### 6.1 Integrações (internas)

- **[[EdDadosAbate]]** (`TfmEdDadosAbate`) — CRUD real de `DadosAbates` (lido e documentado
  integralmente; não há tabela `ItDadosAbates` — o detalhe/rastreio é via `MovAnimais.DadosAbate`).
- **`[[spAnalEmbarques]]`** (81 linhas, lida integralmente).
- **`MovAnimais`** — rastreio físico da venda, referenciando `DadosAbates` via
  `MovAnimais.DadosAbate`.

### 6.2 Modelo de dados

**Tabela `DadosAbates`** (campos confirmados via `TField`s desta unit):

| Campo | Tipo (inferido) | Observações |
|---|---|---|
| `Sequencial` | Integer | PK. |
| `Numero` | String | Número da nota/documento do Frigorífico. |
| `Frigorifico` | Integer | FK `Pessoas.Codigo`. |
| `Venda` | DateTime | Data da venda/abate. |
| `QtdAnimais` | Integer | — |
| `Sexo` | String(1) | `'M'`/`'F'`. |
| `VlrUnit` | BCD | Valor unitário. |
| `Desconto` | BCD | — |
| `Vlr@` (Vlr Arroba) | BCD | — |
| `PesoVivo` | BCD | — |
| `PesoCarcaca` | BCD | — |
| `PercRC` | BCD | % Rendimento de Carcaça. |
| `VlrIncFiscal` | BCD | Valor de Incentivo Fiscal. |
| `AnimaisIncFiscal` | Integer | Qtd de animais elegíveis a Incentivo Fiscal. |
| `VlrOutRec` | BCD | Outras Receitas. |
| `AnimaisOutRec` | Integer | — |
| `VlrImpTaxas` | BCD | Impostos e Taxas. |
| `VlrOutDesp` | BCD | Outras Despesas. |
| `Safra`, `Retiro` | Integer | Escopo. |

### 6.3 Triggers e Procedures do banco

- **`[[spAnalEmbarques]]`**.
- **`[[spRatearDadosAbate]]`** (usada em `[[EdDadosAbate]]`).
- Nenhuma trigger sobre `DadosAbates` — confirmado após leitura de `[[EdDadosAbate]]`.

---

## 7) Suporte: FAQ, mensagens, erros e troubleshooting

### 7.2 Catálogo de mensagens e erros

| Mensagem exata | Causa |
|---|---|
| "Selecione um Retiro para os Dados de Abate." | Incluir/Alterar/Excluir sem Retiro selecionado |
| "Existem Vendas vinculadas aos Dados de Abate. Desvincule as Vendas antes de excluir os Dados de Abate." | Exclusão com `MovAnimais` vinculado |
| "Deseja Realmente Excluir o Registro Selecionado?" | Confirmação de exclusão |
| "C�digo do Frigor�fico Inv�lido." / "C�digo do Propriet�rio Inv�lido." | Busca de Pessoa sem correspondência (F2/EditValueChanged) |

---

## 9) Notas de revisão

- **2026-09-02** (auditoria campo-a-campo — módulo Pecuária)
  - **O que mudou:** dicionário de campos (seção 2) expandido coluna a coluna por banda. **Achado
    de código morto**: o grid `gdDadosAbateSubGrupos`, declarado no `.dfm` com colunas quase
    idênticas à view "Lote" de `[[MonitoramentoBaiasLotes]]` (provável origem por cópia), nunca é
    associado a nenhum `TcxGridLevel` nem tem `DataController.DataSource` definido — nunca
    aparece nem é populado, mesmo padrão de UI órfã já visto em `[[AjusteVirtual]]`.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** código-fonte `Pecuaria/DadosAbate.pas` + `.dfm`.

- **2026-09-01** (auditoria de profundidade — módulo Pecuária)
  - **O que mudou:** removida a marcação de "nota parcial" — `[[EdDadosAbate]]` (CRUD real) já
    havia sido lida e documentada integralmente em sessão posterior, confirmando que não há
    trigger sobre `DadosAbates` e que não existe tabela `ItDadosAbates` (o detalhe é via
    `MovAnimais.DadosAbate`); apenas as referências cruzadas aqui ainda não tinham sido
    atualizadas.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** ver `[[EdDadosAbate]]`.

- **2026-08-28** (criação da nota — módulo Pecuária)
  - **O que mudou:** nota criada do zero, a partir de leitura 100% literal de
    `Pecuaria/DadosAbate.pas` (550 linhas) + `.dfm` (título confirmado "Lançamento dos Dados de
    Abate dos Animais") + `[[spAnalEmbarques]]` (81 linhas, lida integralmente). Documentados os
    2 relatórios adicionais (Resultado de Abates Sintético/Analítico; Análise de Embarques) e a
    lógica de agrupamento artificial em blocos do relatório de embarques.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** código-fonte `Pecuaria/DadosAbate.pas` + `.dfm`;
    `scripts/procedures/spAnalEmbarques.sql`; ver `[[spAnalEmbarques]]`.
