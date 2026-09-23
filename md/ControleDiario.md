> **Nota de método**: este documento descreve uma tela de um sistema LEGADO já em produção,
> reconstruída por engenharia reversa do código-fonte — não é uma especificação de feature nova
> obtida por entrevista com um PO. Por isso, toda seção que normalmente viria de uma conversa de
> negócio (motivação, métricas, objetivos) foi preenchida por **inferência a partir do
> comportamento do código**, e está marcada explicitamente como `(inferência)`. Onde nem o código
> nem o contexto do módulo permitem inferir nada com segurança, o campo está como `N/A`.
> Fonte: leitura 100% literal de `Pecuaria/ControleDiario.pas` (1098 linhas, unit
> `ControleDiario`, classe `TfmControleDiario`) e do `.dfm` correspondente (título confirmado
> "Controle Diário"), nesta sessão — 88º arquivo `.pas` lido do módulo Pecuária. Chama
> `[[spControleDiario]]` (411 linhas) e `[[spResCategoriasPec]]` (179 linhas), ambas lidas
> integralmente nesta sessão. Ver nota de método completa (limitação de DDL/tipos de coluna) em
> `[[ExportaDietas]]`, válida para todo o módulo.

---

**Status da implementação:** Legado — em produção (documentado via engenharia reversa, sem item de trabalho associado)

**Owner (curadoria):** @jefferson.arantes
**Tags:** #Pecuaria #Dashboard #ControleDiario #Consumo #Dieta

---

## 0) Resumo executivo

- **O que é:** o **dashboard operacional diário** do módulo Pecuária — tela somente-leitura com 2
  abas: "Controle Diário" (grade principal, 1 linha por Lote + pseudo-linhas de Hospital/Rejeição,
  com indicadores de consumo em 3 janelas de tempo) e "Resumos" (3 sub-grades: Fluxo de
  Categorias, Hospital/Rejeição por Lote com colunas dinâmicas, Consumo por Dieta).
- **A grade de Hospital/Rejeição por Lote tem colunas geradas dinamicamente em runtime**
  (`MontaResHspPst`) — 1 coluna por Lote de destino de Hospital encontrado na consulta (até um
  máximo prático de exibição legível — o código só nomeia explicitamente as 4 primeiras via
  `DescLote01`..`04`, mas cria colunas para todas), recriando `FieldDefs` e `TcxGridDBBandedColumn`
  do zero a cada consulta — padrão de "pivot dinâmico client-side" mais elaborado que o "PIVOT
  manual" fixo em 6 colunas já visto em `[[spFechamentoLotePec]]`.
- **4 relatórios de impressão**, todos reaproveitando os dados já consultados em tela: "Controle
  Diário" completo (`ControleDiario.rtm`, mescla os 4 datasets: principal + 3 resumos), "Gráfico
  de Consumo" (barras MN Hoje vs. Meta MN Hoje, por Unidade de Ocupação), "Gerar Arraçoamento"
  (`GerArracoamento.rtm`, recalcula tudo via SQL ad-hoc no próprio `.pas`, não reaproveita
  `[[spControleDiario]]` — consulta paralela e independente com lógica muito similar mas não
  idêntica).
- **Impacto principal:** nenhum — tela 100% de consulta/relatório, sem nenhum `INSERT`/`UPDATE`/
  `DELETE` em toda a unit.

---

## 1) Conceito

| Termo | Definição |
|-------|-----------|
| 3 janelas de consumo simultâneas por Lote | "Geral" (acumulado desde o início do Lote), "3 Dias" (últimos 3 dias) e "Hoje" — mesmos indicadores (MN/cab, MS/cab, %MS×PV) repetidos em 3 granularidades temporais na mesma linha da grade. |
| "Meta MN Hoje" compara consumo real com a Fórmula da Dieta | Calculada via `fnGetMetaMSxPV`/`fnGetMSProdDieta` dentro de `[[spControleDiario]]` — é o valor esperado de consumo diário de Matéria Natural, dado o Peso Vivo projetado e o %MS-alvo da Fórmula. |
| Timing de cada etapa da consulta é medido e exibido no debug (F9) | `btnConsultarClick` cronometra (`SecondsBetween`) cada 1 dos 4 blocos de consulta (Controle Diário / Fluxo Categorias / Hosp.-Rej. / Consumo por Dieta) e anexa ao `mmQuery` — indício de que a tela historicamente teve problemas de performance. |
| "Gerar Arraçoamento" duplica a lógica de `[[spControleDiario]]` em SQL Delphi-side | Consulta paralela e independente (não reaproveita a procedure), usando `fnConsumoMedioPec` (function) em vez de `spConsumoMedioPec` (procedure) — inconsistência arquitetural: mesma informação calculada por 2 caminhos de código diferentes. |

---

## 2) Dicionário de campos da tela (`.dfm`)

| Controle | Classe | Rótulo/Caption | Vinculado a (campo BD) | Obrigatório | Observações |
|---|---|---|---|---|---|
| `cbFazendas`/`cbRetiros` | `TcxLookupComboBox` | — | filtro | Sim | Retiro popula `cbTipoLote`/reconsulta. |
| `deData` | `TcxDateEdit` | — | `@Data` de `[[spControleDiario]]` | Sim | Default: hoje; reconsulta automaticamente ao alterar. |
| `cbCategoria`/`cbRaca`/`ceProprietario`/`cbTipoLote`/`cbDieta` | vários | — | filtros | — | — |
| `rgSGPrinc` | `TcxRadioGroup` | — | controla coluna Proprietário vs. Pessoa Origem | — | Alterna visibilidade de colunas na grid. |
| Grid `gdControleDiario` (aba 1) — **34 colunas fixas do `.dfm`**, todas somente leitura (`Options.Editing=False`), sem arredondamento Delphi (valores vêm prontos de `[[spControleDiario]]`, cada `TFMTBCDField` já com precisão fixa no dataset) | `TcxGridDBBandedTableView` | ver lista abaixo | `cdsControleDiario` | — | Ordenável; "Retirar Ordenação" via menu de contexto (`pmControleDiario`). |
| ↳ colunas de identificação/contexto | — | Lote/U.O./Proprietário **ou** Pessoa Origem (mutuamente exclusivas, ver `rgSGPrinc`)/Raça/Categoria/Castrado/Dieta | `DescLote`/`DescUO`/`NomeProp` ou `PessoaOrigem`/`DescRaca`/`DescCat`/`Castrado`/`Dieta` | — | — |
| ↳ colunas de saldo/entrada | — | Saldo Atual/Mortes/Hospital/Diárias Média/Data Entrada Média/Peso Médio Entrada/Peso Prev./Data Proc./Data Inc. SisBov | `SaldoAtual`/`Mortes`/`Hospital`/`MediaDiarias`/`DataMediaEnt`/`PesoMedioEnt`/`PesoPrev`/`DataMediaProc`/`DataMediaIncSisBov` | — | — |
| ↳ colunas de consumo/trato | — | Dias Ração/Dias Trato/MN(Geral,3D,Hoje)/MS(Geral,3D,Hoje)/%MS×PV(Geral,3D,Hoje)/Meta MN Hoje | `DiasRacao`/`DiasTrato`/`MNGeral`/`MN3Dias`/`MNHoje`/`MSGeral`/`MS3Dias`/`MSHoje`/`MSPVGeral`/`MSPV3Dias`/`MSPVHoje`/`MetaMNHoje` | — | 3 janelas temporais lado a lado na mesma linha (ver "1) Conceito"). |
| ↳ colunas de pesagem/GPD | — | Data Pesagem/Dias Pesagem/GPD/Peso Prev. Abate/Data Prev. Abate/L.C. (Leitura de Cocho) | `DataPesagem`/`DiasPesagem`/`GPD`/`PesoPrevAbate`/`DataPrevAbate`/`LC` | — | — |
| Grid `gdResFluxo` (aba "Resumos") | `TcxGridDBBandedTableView` | Categoria/Entradas/Evoluções/Saídas/Hosp.-Rejeição/Mortes/Saldo + % de cada um sobre `clEntradas` | `cdsResFluxo` (via `[[spResCategoriasPec]]` + campos calculados `cdsResFluxoCalcFields`) | — | `%` calculados em Delphi (`FieldByName('clPerc...').AsFloat := (X*100.00)/clEntradas`) — **sem `RoundTo`/`Round`**, e **`clPercEvolucoes` usa `ABS()`** (sempre positivo, mesmo se `Evolucoes` for negativo) enquanto os demais percentuais não usam `ABS` — assimetria de tratamento de sinal entre os indicadores. |
| Grid `gdResHspPst` (aba "Resumos") | `TcxGridDBBandedTableView` | Categoria + N colunas dinâmicas (1 por Lote de Hospital/Rejeição encontrado) + Saldo | `cdsResHspPst` (colunas recriadas em runtime por `MontaResHspPst`, ver Resumo) | — | Sem limite de colunas no código (embora só as 4 primeiras tenham nome de variável dedicado `sLote1..4`) — se houver mais de 4 Lotes de destino, as colunas extras são criadas normalmente mas não recebem tratamento especial de "DescLoteNN" nomeado. |
| Grid `gdConsumo` (aba "Resumos") | `TcxGridDBBandedTableView` | Dieta/MS Dieta/Qtd MS Macho/Qtd MS Fêmea/Consumo MS Macho/Consumo MS Fêmea/GPD Prev. | `cdsResDieta` (SQL ad-hoc embutido no `.pas`, ver SP-02) | — | `ConsMSM`/`ConsMSF` protegidos contra divisão por zero (`CASE WHEN SUM(...)>0.00 THEN ... ELSE 0.00 END`), calculados no SQL, não em Delphi. |
| `btnConsultar` | `TcxButton` | — | — | — | Dispara as 4 consultas em sequência. |
| `btnImprimir` (dropdown `pmImprimir`) | `TcxButton` | — | — | — | "Gráfico de Consumo" / "Gerar Arraçoamento" / "Controle Diário". |
| `btnExportar` | `TcxButton` | — | — | — | Exporta a grid principal via `ExportGrid4ToExcel`. |
| `mmQuery` | `TcxMemo` | — | — | Oculto por padrão | F9; acumula texto de todas as 4 consultas + timing. |

---

## 5) Jornada do usuário + Especificação funcional

### SP-01 — Abrir (`FormShow`)
Carrega Fazendas (filtradas por permissão), domínios de Categoria/Raça; período/filtros default.

### SP-02 — Consultar (`btnConsultarClick`) → `[[spControleDiario]]` + `[[spResCategoriasPec]]` + `MontaResHspPst` (SQL ad-hoc) + consulta de Consumo por Dieta (SQL ad-hoc)
4 consultas sequenciais, cada 1 cronometrada; `MontaResHspPst` reconstrói dinamicamente as colunas
da grade de Hospital/Rejeição por Lote a cada execução.

### SP-03 — Imprimir "Controle Diário" (`imControleDiarioClick`)
Reaproveita os 4 datasets já em memória (`CarregaImpControleDiario` + os 3 resumos), preserva a
ordenação atual da grade principal como índice do relatório.

### SP-04 — Gráfico de Consumo (`imGrafConsumoClick`)
Gráfico de barras comparando MN Hoje real vs. Meta, por Unidade de Ocupação — 1 página só
(`PageLimit:=1`).

### SP-05 — Gerar Arraçoamento (`imGerArracoamentoClick`)
Consulta SQL ad-hoc paralela e independente (ver Conceito — achado de duplicação de lógica).

### 5.3 Regras de negócio e validações

Tela 100% de consulta — não há regras de negócio de gravação. Único comportamento condicional:
**a coluna Proprietário só aparece se `rgSGPrinc=0`; Pessoa de Origem só se `rgSGPrinc=1`** —
mutuamente exclusivas na mesma grade.

---

## 6) Integrações e dados

### 6.1 Integrações (internas)

- **`[[spControleDiario]]`** (411 linhas, lida integralmente).
- **`[[spResCategoriasPec]]`** (179 linhas, lida integralmente).
- **`fnConsumoMedioPec`** (function, não lida em profundidade nesta sessão — usada apenas no
  relatório "Gerar Arraçoamento", em paralelo à procedure homônima `spConsumoMedioPec` já
  documentada em `[[spMonitoramentoLotes]]`).

### 6.2 Modelo de dados

Não introduz tabelas novas — consome exclusivamente `[[spControleDiario]]`/`[[spResCategoriasPec]]`
e consultas ad-hoc sobre `HospitalizacoesPec`, `LotesBaias`, `SubGruposLotes`, `SaldosPec`,
`LancTratosLC`/`TratosPec`, `FormulasDietas` — todas já introduzidas por notas anteriores.

### 6.3 Triggers e Procedures do banco

- **`[[spControleDiario]]`**, **`[[spResCategoriasPec]]`**.

---

## 7) Suporte: FAQ, mensagens, erros e troubleshooting

### 7.2 Catálogo de mensagens e erros

| Mensagem exata | Causa |
|---|---|
| "C�digo do Propriet�rio Inv�lido." | Busca de Pessoa sem correspondência |
| "Planilha \"X\".xls Exportada com Sucesso." | Confirmação de exportação Excel |

---

## 9) Notas de revisão

- **2026-09-02** (auditoria campo-a-campo — módulo Pecuária)
  - **O que mudou:** dicionário de campos (seção 2) expandido de "~35 colunas bandadas" para as
    34 colunas reais listadas por grupo funcional, com origem exata no dataset. **Achado**: em
    `cdsResFluxoCalcFields`, `clPercEvolucoes` usa `ABS()` no numerador (sempre positivo) enquanto
    os demais 4 percentuais (`clPercHspRej`/`clPercSaidas`/`clPercMortes`/`clPercSaldo`) não usam
    `ABS` — assimetria de tratamento de sinal entre indicadores similares. Confirmado que a grade
    principal não tem nenhum arredondamento Delphi (valores prontos de `spControleDiario`); os
    percentuais de `gdResFluxo` são calculados em Delphi sem `RoundTo`/`Round`.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** código-fonte `Pecuaria/ControleDiario.pas` + `.dfm`.

- **2026-08-28** (criação da nota — módulo Pecuária)
  - **O que mudou:** nota criada do zero, a partir de leitura 100% literal de
    `Pecuaria/ControleDiario.pas` (1098 linhas) + `.dfm` (título confirmado "Controle Diário") +
    as 2 procedures diretamente chamadas (`[[spControleDiario]]`/`[[spResCategoriasPec]]`, ambas
    lidas integralmente). Documentado o mecanismo de colunas dinâmicas de
    `MontaResHspPst` e o achado de duplicação de lógica em "Gerar Arraçoamento".
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** código-fonte `Pecuaria/ControleDiario.pas` + `.dfm`; ver
    `[[spControleDiario]]`, `[[spResCategoriasPec]]`, `[[spMonitoramentoLotes]]`.
