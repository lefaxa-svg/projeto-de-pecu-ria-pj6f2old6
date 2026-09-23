> **Nota de método**: este documento descreve uma tela de um sistema LEGADO já em produção,
> reconstruída por engenharia reversa do código-fonte — não é uma especificação de feature nova
> obtida por entrevista com um PO. Por isso, toda seção que normalmente viria de uma conversa de
> negócio (motivação, métricas, objetivos) foi preenchida por **inferência a partir do
> comportamento do código**, e está marcada explicitamente como `(inferência)`. Onde nem o código
> nem o contexto do módulo permitem inferir nada com segurança, o campo está como `N/A`.
> Fonte: leitura 100% literal de `Pecuaria/AcompGanhoPeso.pas` (945 linhas, unit
> `AcompGanhoPeso`, classe `TfmAcompGanhoPeso`) e do `.dfm` correspondente (título confirmado
> "Acompanhamento de Ganho de Peso"), nesta sessão — 78º arquivo `.pas` lido do módulo Pecuária.
> Item de menu `'AcompGanhoPeso'` (`[[iniModuloPecuaria]]`). Não chama nenhuma stored procedure —
> toda a lógica de pivotamento das pesagens é feita em Delphi. Ver nota de método completa
> (limitação de DDL/tipos de coluna) em `[[ExportaDietas]]`, válida para todo o módulo.

---

**Status da implementação:** Legado — em produção (documentado via engenharia reversa, sem item de trabalho associado)

**Owner (curadoria):** @jefferson.arantes
**Tags:** #Pecuaria #Pesagem #GanhoPeso #Grafico #Relatorio

---

## 0) Resumo executivo

- **O que é:** relatório de acompanhamento de **evolução de peso individual** (por Brinco), desde
  o Nascimento — filtra Brincos ativos por Fazenda/Retiro/Sexo/faixa de identificação (Brinco/
  SisBov/Eletrônico/Auxiliar)/Lote/Raça/Origem, e período de **Data de Nascimento** (não de
  pesagem), e monta um **pivot de até 6 pesagens** (`P1..P6`) por animal, com GPD Médio Desde o
  Início (GPMD) calculado entre cada pesagem e a 1ª (`P1`), não entre pesagens consecutivas —
  achado importante: "GPMDPn" é sempre `(PesoPn - PesoP1) / DiasEntrePn_e_P1`, uma média
  acumulada desde a 1ª pesagem, não uma taxa instantânea entre 2 pesagens vizinhas.
- **Pivot é montado em Delphi, não em SQL** — para cada animal retornado pela consulta principal,
  dispara uma 2ª consulta (`cdsAux`) trazendo **todas** as pesagens do Brinco em ordem
  cronológica, e copia manualmente até 6 delas (`P1`..`P6`) para as colunas do registro principal
  — se o animal tiver mais de 6 pesagens, as pesagens além da 6ª são **descartadas silenciosamente**
  (achado de limitação: nenhum aviso ao usuário de que dados foram truncados).
- **2 relatórios**: "Impresso Individual" (1 animal, com gráfico de evolução), "Imprimir Todos"
  (lista consolidada, sem gráfico por animal).
- **Impacto principal:** nenhum efeito colateral no banco — apenas consulta/relatório.

---

## 1) Conceito

| Termo | Definição |
|-------|-----------|
| Filtro de período é sobre **Nascimento**, não sobre pesagens | `deInicio`/`deFim` filtram `BrincosIndividuais.Nascimento BETWEEN`, não a data de nenhuma pesagem — a tela responde "todos os animais nascidos neste período", depois mostra a evolução de peso de cada um. |
| GPMD é sempre relativo à 1ª pesagem (P1), nunca incremental | Confirmado em todos os 5 blocos (P2 a P6) do `btnConsultarClick`: `GPMDPn := (PesoPn - PesoP1) / DiasEntre(Pn, P1)` — mesmo padrão repetido literalmente 5 vezes (não fatorado em função) — achado de duplicação de código. |
| "Última Média" (`UltMedia`) é sobreescrita a cada pesagem processada | Cada bloco P2-P6 recalcula `UltMedia` com o mesmo valor de `GPMDPn` daquele bloco — ao final do loop, `UltMedia` reflete o GPMD calculado com a última pesagem efetivamente encontrada (até 6). |
| Gráfico principal (`cGrafico`, na própria tela) é reconstruído a cada troca de registro focado | `dsConsultaDataChange` → `GeraGrafico`: recria a série do `TChart` a cada vez que o usuário navega para outro animal na grade — 1 gráfico "ao vivo" por animal focado, distinto do gráfico do relatório impresso (`ppGrafico`, populado separadamente em `ImpressoIndividual1Click`). |
| Proteção contra divisão por zero: `iDias < 1` zera o GPMD, não gera exceção | Todos os 5 blocos (P2..P6) calculam `iDias := DaysBetween(DataPn, DataP1)` **antes** de dividir; se `iDias < 1` (pesagem no mesmo dia da P1, ou datas invertidas por inconsistência de dados), `GPMDPn` e `UltMedia` são setados para `0.00` em vez de dividir por zero — nenhuma mensagem ao usuário nesse caso, o valor simplesmente aparece como `0,00`. |
| **Nenhum arredondamento explícito em Object Pascal** — o "arredondamento" a 2 casas decimais é só um efeito colateral do tipo de campo `NUMERIC(18,2)` | Confirmado por leitura literal: em nenhum ponto do `.pas` há `RoundTo`, `SimpleRoundTo`, `Round` ou `Trunc` aplicado a `GPMDPn`/`PesoPn`. O cálculo `(PesoPn - PesoP1) / iDias` é feito em `Double` (via `.AsFloat`) e atribuído diretamente ao campo `TFMTBCDField`, cujo `CommandText` de origem declara `CONVERT(NUMERIC(18,2), 0.00)` — é o driver/campo BCD que trunca/arredonda a 2 casas ao persistir no `ClientDataSet`, não uma chamada explícita de arredondamento no código de negócio. Mesmo padrão para os relatórios (`FormatFloatSQL` + `CONVERT(NUMERIC(18,2), ...)` em `ImpressoIndividual1Click`). |
| GPMD pode ser **negativo** (perda de peso) — não há trava | Nenhum `BeforePost`/`OnValidate`/`OnEditValueChanged` no fluxo de cálculo impede ou zera GPMD negativo quando `PesoPn < PesoP1` (animal perdeu peso desde a 1ª pesagem) — o valor negativo é gravado e exibido normalmente na grade/relatórios, refletindo perda de peso real. Não é um bug, mas não estava documentado explicitamente. |
| Campo `GPMDP1` existe no dataset, mas nunca é populado nem exibido | `cdsConsultaGPMDP1: TFMTBCDField` está declarado (tanto no `.pas` quanto no `.dfm`, via `CONVERT(NUMERIC(18,2), 0.00) AS ...` implícito da SQL base) mas **não há coluna de grid correspondente** (`gdGanhoPesoTabela` só tem `GPMDP2..GPMDP6`) e o bloco P1 do `btnConsultarClick` nunca atribui `GPMDP1` — permanece sempre no valor default `0.00` da SQL. Campo morto/vestigial, coerente com o conceito (GPMD da 1ª pesagem contra ela mesma não faz sentido). |

---

## 2) Dicionário de campos da tela (`.dfm`)

| Controle | Classe | Rótulo/Caption | Vinculado a (campo BD/parâmetro) | Obrigatório | Observações |
|---|---|---|---|---|---|
| `cbFazenda`/`cbRetiros` | `TcxLookupComboBox` | — | escopo | — | Opção "TODAS". |
| `deInicio`/`deFim` | `TcxDateEdit` | — | `BrincosIndividuais.Nascimento` (filtro) | — | Default: últimos 365 dias. |
| `cbSexo` | `TcxComboBox` | — | filtro de Sexo | — | — |
| `ckSisBov` | `TcxCheckBox` | — | alterna máscara de Brinco/SisBov (6 vs. 15 dígitos) | — | Mesmo padrão de `[[VisualizarBrincos]]`. |
| `edBrincoInicial`/`Final`, `edBEInicial`/`Final`, `edBAInicial`/`Final` | `TcxMaskEdit`/`TcxCurrencyEdit` | — | faixas de Brinco/Eletrônico/Auxiliar | — | — |
| `cbLotes`/`cbRaca`/`cbOrigem` | `TcxLookupComboBox` | — | filtros | — | — |
| Grid `gdGanhoPeso` (view `gdGanhoPesoTabela`, `TcxGridDBBandedTableView`) | ver tabela de colunas abaixo | `cdsConsulta` | — | Somente leitura (`OptionsData.Editing/Inserting/Deleting = False` no nível da view). Agrupado em 11 bandas: "Brincos" (fixa à esquerda, dados de identificação) + 5× banda "GPMD" (uma por pesagem P2..P6, cada uma cobrindo Data+Peso+GPMD daquela pesagem). |
| `cGrafico` | `TChart` | — | — | — | Gráfico "ao vivo" do animal focado (`Series1`/série recriada em `GeraGrafico`). |
| `edQtdMacho`/`edQtdFemea` | `TcxCurrencyEdit` | contadores calculados (`iContM`/`iContF`) | — | **`Enabled = False`** no `.dfm` — display-only, nunca editável pelo usuário; só é preenchido em `btnConsultarClick`. |
| `btnConsultar`/`btnExportar` | `TcxButton` | — | — | — |
| `btnImprimir` (dropdown `pmImprimir`) | `TcxButton` | — | — | "Impresso Individual" (`ImpressoIndividual1`) / "Imprimir Todos" (`ImprimirTodos1`). |

**Colunas da grid `gdGanhoPesoTabela` (24 no total — todas com `Options.Editing/HorzSizing/Moving = False`, ou seja, somente leitura, largura e ordem fixas):**

| Coluna (`TcxGridDBBandedColumn`) | Caption exibido | Campo (`cdsConsulta`) | Banda | Formato | Observações |
|---|---|---|---|---|---|
| `gdGanhoPesoTabelaSequencial` | "Seq." | `Sequencial` | Brincos (0) | inteiro | Chave interna (`BrincosIndividuais.Sequencial`); também usado como campo de `skCount` no sumário de rodapé da grid (conta total de animais). |
| `gdGanhoPesoTabelaManejo` | (sem caption — mostra nome do campo) | `Manejo` | Brincos (0) | texto | É o nº de Brinco convencional (`B.Brinco AS Manejo` na SQL). |
| `gdGanhoPesoTabelaSisBov` | (sem caption) | `SisBov` | Brincos (0) | texto | — |
| `gdGanhoPesoTabelaBrincoEletronico` | "Eletrônico" | `BrincoEletronico` | Brincos (0) | texto | — |
| `gdGanhoPesoTabelaBrincoAux` | "Auxiliar" | `BrincoAux` | Brincos (0) | texto | — |
| `gdGanhoPesoTabelaDataNascimento` | "Data Nascimento" | `DataNascimento` | banda 1 (sem caption própria) | data | — |
| `gdGanhoPesoTabelaSexo` | (sem caption) | `Sexo` | banda 1 | texto | "MACHO"/"FÊMEA" (já formatado na SQL via `CASE`). |
| `gdGanhoPesoTabelaDataP1` | "Dt. P1" | `DataP1` | banda 1 | data | Data da 1ª pesagem encontrada. |
| `gdGanhoPesoTabelaPesoP1` | "Peso 1" | `PesoP1` | banda 1 | `#,##0.00` (`TcxCurrencyEditProperties`) | Peso da 1ª pesagem. |
| `gdGanhoPesoTabelaDataP2` | "Dt. P2" | `DataP2` | banda "GPMD" (2ª) | data | — |
| `gdGanhoPesoTabelaPesoP2` | "Peso 2" | `PesoP2` | banda "GPMD" (2ª) | `#,##0.00` | — |
| `gdGanhoPesoTabelaGPMDP2` | "P2 - P1" | `GPMDP2` | banda "GPMD" (2ª) | `#,##0.00` | GPMD acumulado P2→P1 (ver fórmula em §1). |
| `gdGanhoPesoTabelaDataP3` | "Dt. P3" | `DataP3` | banda "GPMD" (3ª) | data | — |
| `gdGanhoPesoTabelaPesoP3` | "Peso 3" | `PesoP3` | banda "GPMD" (3ª) | `#,##0.00` | — |
| `gdGanhoPesoTabelaGPMDP3` | "P3 - P1" | `GPMDP3` | banda "GPMD" (3ª) | `#,##0.00` | — |
| `gdGanhoPesoTabelaDataP4` | "Dt. P4" | `DataP4` | banda "GPMD" (4ª) | data | — |
| `gdGanhoPesoTabelaPesoP4` | "Peso 4" | `PesoP4` | banda "GPMD" (4ª) | `#,##0.00` | — |
| `gdGanhoPesoTabelaGPMDP4` | "P4 - P1" | `GPMDP4` | banda "GPMD" (4ª) | `#,##0.00` | — |
| `gdGanhoPesoTabelaDataP5` | "Dt. P5" | `DataP5` | banda "GPMD" (5ª) | data | — |
| `gdGanhoPesoTabelaPesoP5` | "Peso 5" | `PesoP5` | banda "GPMD" (5ª) | `#,##0.00` | — |
| `gdGanhoPesoTabelaGPMDP5` | "P5 - P1" | `GPMDP5` | banda "GPMD" (5ª) | `#,##0.00` | — |
| `gdGanhoPesoTabelaDataP6` | "Dt. P6" | `DataP6` | banda "GPMD" (6ª) | data | — |
| `gdGanhoPesoTabelaPesoP6` | "Peso 6" | `PesoP6` | banda "GPMD" (6ª) | `#,##0.00` | — |
| `gdGanhoPesoTabelaGPMDP6` | "P6 - P1" | `GPMDP6` | banda "GPMD" (6ª) | `#,##0.00` | — |

*Campos do `cdsConsulta` sem coluna de grid (não exibidos, só usados internamente/relatório): `GPMDP1` (nunca populado — ver achado em §1), `UltData`/`UltPeso`/`UltMedia` (usados só no relatório "Impresso Individual", não aparecem na grid).*

---

## 5) Jornada do usuário + Especificação funcional

### SP-01 — Abrir a tela (`FormShow`)
Período padrão = últimos 365 dias; carrega Fazendas/Raças/Origens (opção "TODAS"/"TODOS").

### SP-02 — Consultar (`btnConsultarClick`)

**Pseudocódigo fiel (resumido):**
```
validar Data Início <= Data Fim
buscar Brincos ativos (não mortos) nascidos no período, com filtros opcionais
para cada Brinco encontrado:
  buscar todas as Pesagens do Brinco (BrincosPesagens/MovAnimais), ordenadas por Data
  para P em 1..6 (enquanto houver mais pesagens):
    copiar Data/Peso da pesagem para DataPn/PesoPn
    se P>1: calcular GPMDPn = (PesoPn - PesoP1) / DiasEntre(Pn, P1)
    atualizar UltData/UltPeso/UltMedia
  contar Macho/Fêmea
```

### SP-03 — Navegar entre animais (`dsConsultaDataChange`) → `GeraGrafico`
Reconstrói o gráfico "ao vivo" com os 5 pontos GPMD (P2-P6) do animal focado.

### SP-04 — Exportar (`btnExportarClick`) → `ExportGrid4ToExcel`

### SP-05 — Imprimir Individual (`ImpressoIndividual1Click`)
Monta 1 registro de contexto + gráfico de evolução; template `AcompGanhoPesoIndiv.rtm`.

### SP-06 — Imprimir Todos (`ImprimirTodos1Click`)
Usa a grade inteira (`cdsConsulta`) como fonte; template `AcompGanhoPesoTodos.rtm`.

### 5.3 Regras de negócio e validações

- **BR-001 — Data Início não pode ser maior que Data Fim.** Mensagem: "Data do período inicial
  do nascimento está maior que a data final!"
- **BR-002 (implícita) — divisão por zero é evitada zerando o GPMD, não bloqueando o cálculo.**
  Se `DaysBetween(DataPn, DataP1) < 1` (mesma data ou datas inconsistentes), `GPMDPn` e
  `UltMedia` recebem `0.00` em vez de lançar exceção de divisão por zero — sem aviso ao usuário.
- **BR-003 (implícita) — GPMD pode ser negativo, sem trava.** Nenhuma validação impede que
  `GPMDPn` seja negativo quando o animal perde peso entre a 1ª pesagem e a Pn; o valor negativo é
  gravado e exibido normalmente.
- **Achado de limitação:** animais com mais de 6 pesagens no período têm as pesagens excedentes
  descartadas silenciosamente, sem aviso.
- **Achado de limitação (arredondamento):** não há `RoundTo`/`SimpleRoundTo`/`Round`/`Trunc`
  explícito em nenhum cálculo de GPMD no Object Pascal — a precisão de 2 casas decimais é
  garantida apenas implicitamente pelo tipo `NUMERIC(18,2)` dos campos BCD de destino.
- **Achado de limitação (campo morto):** `GPMDP1` existe no `cdsConsulta` mas nunca é populado
  nem exibido em grid — vestígio de código, sem impacto funcional.

---

## 6) Integrações e dados

### 6.1 Integrações (internas)

Nenhuma — unit autocontida, sem chamadas a procedures.

### 6.2 Modelo de dados

Nenhuma tabela própria — consulta `vwBrincosIndividuais`/`BrincosIndividuais`/`BrincosPesagens`/
`MovAnimais` (já documentadas em notas anteriores).

### 6.3 Triggers e Procedures do banco

Nenhuma.

---

## 7) Suporte: FAQ, mensagens, erros e troubleshooting

### 7.2 Catálogo de mensagens e erros

| Mensagem exata | Causa |
|---|---|
| "Data do período inicial do nascimento está maior que a data final!" | Validação de período |
| "Planilha AcompGanhoPeso.xls gerado com sucesso" | Exportação concluída |

---

## 9) Notas de revisão

- **2026-09-02** (auditoria de profundidade campo-a-campo — pós-achados do módulo Algodoeira)
  - **O que mudou:** releitura 100% literal de `AcompGanhoPeso.pas` (945 linhas) e `.dfm` (4919
    linhas) para confirmar que a nota anterior não repetia o padrão de "resumo raso" encontrado
    na Algodoeira. **Gap real encontrado e corrigido:** a seção 2 resumia as 24 colunas da grid
    `gdGanhoPesoTabela` numa única linha genérica ("6× Data+Peso/5× GPMD") — foi expandida para
    uma tabela completa coluna a coluna (caption exibido, campo vinculado, banda, formato),
    confirmando que todas têm `Options.Editing/HorzSizing/Moving = False` (grid 100% somente
    leitura) e que `edQtdMacho`/`edQtdFemea` têm `Enabled = False` no `.dfm` (display-only).
  - **Achados de cálculo adicionados (não estavam na nota):** (1) nenhum `RoundTo`/
    `SimpleRoundTo`/`Round`/`Trunc` explícito em Object Pascal — a casa decimal de 2 dígitos vem
    só do tipo `NUMERIC(18,2)` do campo BCD de destino; (2) GPMD pode ser negativo (perda de
    peso) sem nenhuma trava/validação; (3) proteção contra divisão por zero via `iDias < 1`
    zerando o resultado, sem aviso ao usuário; (4) campo `GPMDP1` existe no dataset mas nunca é
    populado nem tem coluna de grid — campo morto.
  - **Confirmado sem alteração:** caminho de menu (`sReferencia = 'AcompGanhoPeso'`, item direto
    sem parâmetro de contexto, cross-checado contra `[[iniModuloPecuaria]]` §6.1) e ausência de
    satélites/procedures — nota original já estava correta nesses pontos.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** releitura de `Pecuaria/AcompGanhoPeso.pas` + `.dfm` (seção `gdGanhoPesoTabela`,
    linhas ~986-1394); `[[iniModuloPecuaria]]` §6.1.

- **2026-08-28** (criação da nota — módulo Pecuária)
  - **O que mudou:** nota criada do zero, a partir de leitura 100% literal de
    `Pecuaria/AcompGanhoPeso.pas` (945 linhas) + `.dfm` (título confirmado "Acompanhamento de
    Ganho de Peso"). Documentado o pivot de até 6 pesagens montado em Delphi, o cálculo de GPMD
    sempre relativo à 1ª pesagem, e os 2 relatórios (Individual/Todos). Achados: pesagens além da
    6ª descartadas silenciosamente; fórmula de GPMD duplicada literalmente 5 vezes.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** código-fonte `Pecuaria/AcompGanhoPeso.pas` + `.dfm`; ver
    `[[VisualizarBrincos]]`, `[[iniModuloPecuaria]]`.
