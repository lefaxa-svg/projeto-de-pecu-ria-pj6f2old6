> **Nota de método**: este documento descreve uma tela de um sistema LEGADO já em produção,
> reconstruída por engenharia reversa do código-fonte — não é uma especificação de feature nova
> obtida por entrevista com um PO. Por isso, toda seção que normalmente viria de uma conversa de
> negócio (motivação, métricas, objetivos) foi preenchida por **inferência a partir do
> comportamento do código**, e está marcada explicitamente como `(inferência)`. Onde nem o código
> nem o contexto do módulo permitem inferir nada com segurança, o campo está como `N/A`.
> Fonte: leitura 100% literal de `Pecuaria/AnalVendas.pas` (468 linhas, unit `AnalVendas`, classe
> `TfmAnalVendas`) e do `.dfm` correspondente (título confirmado "Análises de Vendas"), nesta
> sessão — 39º arquivo `.pas` lido do módulo Pecuária. **Esta é a tela chamadora de
> `[[spAnalVendasPec]]`** (751 linhas, já documentada em sessão anterior) — **resolve a referência
> cruzada pendente** sobre o consumidor do modo "Resumo Financeiro" (`@Visualiz>=5`): os 7 itens
> do combo `cbVisualizacao` mapeiam diretamente para `@Visualiz` 0-6, confirmando "RESUMO
> FINANCEIRO SIMPLIFICADO"/"RESUMO FINANCEIRO COMPLETO" como os modos 5/6. Também chama
> `[[spExtratoResultados]]` (modo 4, "EXTRATIFICADA POR BRINCOS", lida e documentada
> integralmente nesta sessão). Ver nota de método completa (limitação de DDL/tipos de coluna) em
> `[[ExportaDietas]]`, válida para todo o módulo.

---

**Status da implementação:** Legado — em produção (documentado via engenharia reversa, sem item de trabalho associado)

**Owner (curadoria):** @jefferson.arantes
**Tags:** #Pecuaria #Relatorio #Vendas #Boitel #Financeiro

---

## 0) Resumo executivo

- **O que é:** tela de parâmetros "Análises de Vendas" — o hub de relatórios de venda/resultado
  do módulo, com **7 modos de visualização** (`cbVisualizacao`), cada um roteado para uma
  procedure/template diferente:
  - `0`-`3` ("PROP./CAT.", "PROP./CAT./RAÇA", "PROP./CAT./RAÇA/LOTES", "CLIENTE/CAT./RAÇA/LOTES")
    e `5`-`6` ("RESUMO FINANCEIRO SIMPLIFICADO"/"COMPLETO") → `EXEC spAnalVendasPec` (relatório
    `AnalVendas.rtm` para 0-4, `ResFinancVendas.rtm` para 5-6).
  - `4` ("EXTRATIFICADA (POR BRINCOS)") → `EXEC spExtratoResultados` (relatório
    `ExtratoResultados.rtm`).
- **Seleção de Lotes via grade de Unidades de Ocupação**: o filtro de Lotes não é um combo, mas
  uma **grade de checkbox** (`gdUnidOcup`, uma linha por Baia/U.O.) com múltiplos atalhos de
  marcação em massa (Marcar Todas, Marcar Todas da mesma Rua/Tipo, Marcar por Situação, Marcar
  por Modalidade de Negócio) — os Lotes marcados são concatenados numa string `'lote1, lote2,
  ...'` passada como `@Lotes` para a procedure.
- **Impacto principal:** nenhum efeito colateral no banco — apenas consulta e impressão.

---

## 1) Conceito

| Termo | Definição |
|-------|-----------|
| A grade de seleção de Lotes exibe atributos ricos de cada Baia (Tipo/Situação/Modalidade de Negócio) | `cbRetirosPropertiesEditValueChanged`: monta uma consulta com `CASE` traduzindo `LotesBaias.Tipo` (T=Terminação, S=Suplementação, R=Recepção, C=Cria, X=X-Recria, E=Engorda — **6 novos valores de domínio descobertos**), `Situacao` (F=Fechado, A=Aberto, P=Parc. Vendido) e **`ModNegocio`** (G=Gado Próprio, B=Boitel, P=Parceria @ — **confirma explicitamente o conceito de "Boitel" como um dos 3 modelos de negócio do confinamento**, já inferido em notas anteriores a partir de `[[spRelDiarias]]`/`[[PrecosConfinamento]]`). |
| 4 atalhos de marcação em massa na grade de Lotes, via menu de contexto | `imMarcarTodas`/`imDesmarcarTodas`/`imMarcarTodasRua` (mesmo `Tipo` da linha atual) /`MarcarSomenteLotesAbertos1` (mesma `Situacao`) /`MarcarLotesdessaModalidadedeNegcio1` (mesmo `ModNegocio`) — todos implementados com o mesmo padrão: filtrar `Marcar='N'` + critério, percorrer e marcar. |
| A lista final de Lotes é construída percorrendo a grade filtrada, não via SQL | `btnImprimirClick`: filtra `cdsLotes` por `Marcar='S'`, percorre e concatena `Lote + ', '` em uma string, removendo a vírgula final — a string resultante alimenta `@Lotes` da procedure (comparação `IN (...)` dentro da query dinâmica). |
| O índice de ordenação do resultado (`IndexFieldNames`) muda conforme o modo de visualização | Reflete a estrutura de agrupamento esperada por cada template `.rtm`: `'Categoria;Grupo;Linha'` (modo 4), `'Prop;Cliente;Cat;Raca;Lote;Ordem'` (modo 3), `'Prop;Cat;Raca;Lote;Ordem'` (modos 0-2), `'ModNegocio;Prop'` (modos 5-6). |

---

## 2) Dicionário de campos da tela (`.dfm`)

| Controle | Classe | Rótulo/Caption | Vinculado a (campo BD) | Obrigatório | Observações |
|---|---|---|---|---|---|
| `cbFazendas`/`cbRetiros` | `TcxLookupComboBox` | (grupos) | `@Fazenda`/`@Retiro` | — | Padrão do módulo. |
| `deIni`/`deFim` | `TcxDateEdit` | — | `@DataIni`/`@DataFim` | Implícito | Default: 1º dia do ano / hoje. |
| `cbVisualizacao` | `TcxComboBox` | — | `@Visualiz` | — | 7 itens (ver Resumo executivo). |
| `ceProp` | `TcxCurrencyEdit` | — | `@Prop` | Não (0=Todos) | Busca de Pessoa (F2, "P3"). |
| `ceCliente` | `TcxCurrencyEdit` | — | `@Cliente` | Não (0=Todos) | Busca de Pessoa (F2). |
| `cbCategoria` | `TcxLookupComboBox` | — | `@Categoria` | Não (0=Todas) | `Tabelas.Tipo=172` + "..: TODAS :..". |
| `cbSexo` | `TcxComboBox` | — | `@Sexo` | — | 3 itens: Todos(0)/Machos(1)/Fêmeas(2). |
| `lblProp` | `TcxLabel` | — (default `'..:: TODOS ::..'`) | — (só exibição) | — | Preenchido em `ceFuncPropertiesEditValueChanged` via `BuscaPessoa(ceProp.EditValue, S)`; se a busca não retornar linha, dispara `MessageDlg('Código do Proprietário Inválido.')` e a `Caption` permanece com o valor anterior (não é limpa). |
| `lblCliente` | `TcxLabel` | — (default `'..:: TODOS ::..'`) | — (só exibição) | — | Idêntico a `lblProp`, mas para `ceCliente`/`BuscaPessoa`; mensagem "Código do Cliente Inválido." |
| Grid `gdUnidOcup` (`gdUnidOcupTabela`) | `TcxGridDBColumn` | "U.O." / Descrição / "Marcar" / Tipo / Situação / Modalidade de Negócio | `UnidOcup` / `Descricao` / `Marcar` / `Tipo` / `Situacao` / `ModNegocio` | — | Seleção de Lotes via checkbox + menu de contexto de marcação em massa. Colunas `Tipo`/`Situacao`/`ModNegocio`/`UnidOcup`/`Descricao` têm `Options.Editing = False` (somente leitura na grade, editáveis apenas via SQL de carga); só `Marcar` é editável (checkbox). |
| Menu de contexto `pmMarcar` (botão direito na grade) | `TPopupMenu` (5 `TMenuItem`) | "Marcar Todas" / "Desmarcar Todas" / "Marcar Lotes desse Tipo" / "Marcar Lotes dessa Modalidade de Negócio" / "Marcar Lotes dessa Situação" | `dmPecuaria.cdsLotes.Marcar` (campo `'S'`/`'N'`) | — | 5 itens (não 4): `imMarcarTodas`, `imDesmarcarTodas`, `imMarcarTodasRua` (mesmo `Tipo` da linha corrente), `MarcarLotesdessaModalidadedeNegcio1` (mesmo `ModNegocio`), `MarcarSomenteLotesAbertos1` (mesmo `Situacao`, apesar do nome do handler sugerir "Abertos" — na verdade replica a `Situacao` da linha clicada, não filtra especificamente por "Aberto"). Todos operam só sobre linhas com `Marcar='N'` (não desmarcam nada, exceto `imDesmarcarTodas`, que filtra `Marcar='S'`). |
| `btnImprimir`/`btnSair` | `TcxButton` | — | — | — | — |
| `mmQuery` | `TcxMemo` | — | — | Oculto por padrão (`Visible=False`) | Painel de debug — alternado por F9 (`FormKeyDown`); recebe o texto literal do SQL/EXEC montado antes de cada abertura de dataset (carga de Retiros→Lotes e do `btnImprimirClick`). |
| `cxLabel1` | `TcxLabel` | "A" | — | — | Rótulo decorativo entre `deIni` e `deFim` (separador visual "de ... A ..."), sem vínculo a dado. |

---

## 5) Jornada do usuário + Especificação funcional

### SP-01 — Abrir a tela (`FormShow`)
Carrega Fazendas permitidas e Categorias (+ "Todas"); pré-seleciona Fazenda; visualização padrão
índice 0; período padrão desde 1º de janeiro do ano corrente.

### SP-02 — Trocar Fazenda/Retiro
Recarrega Retiros; ao selecionar Retiro, recarrega a grade de Lotes/U.O. com os atributos ricos
(Tipo/Situação/ModNegocio traduzidos).

### SP-03 — Selecionar Lotes (grade + menu de contexto)
Ver Conceito — 4 atalhos de marcação em massa + marcação individual por checkbox.

### SP-04 — Gerar o relatório (`btnImprimirClick`)

**Pseudocódigo fiel:**
```
montar lista de Lotes marcados (string "lote1, lote2, ...")

se cbVisualizacao.ItemIndex = 4:
  EXEC spExtratoResultados @DescEmp, @Safra, @DescSafra, @Fazenda, @DescFaz, @Retiro, @DescRetiro,
    @Visualiz=4, @DescVisualiz, @DataIni, @DataFim, [@Prop, @DescProp], [@Cliente, @DescCliente],
    [@Categoria, @DescCat], @Sexo, @DescSexo, @Lotes=<lista>
senão:
  EXEC spAnalVendasPec @DescEmp, @Safra, ..., @Visualiz=<0-3 ou 5-6>, ..., @Lotes=<lista>

definir IndexFieldNames conforme o modo (ver Conceito)
selecionar template conforme o modo:
  4 → ExtratoResultados.rtm
  0-3 → AnalVendas.rtm
  5-6 → ResFinancVendas.rtm
imprimir
```

### 5.3 Regras de negócio e validações

Nenhuma validação de parâmetros obrigatórios identificada nesta unit antes de gerar o relatório
(diferente de `[[RelDiarias]]`, que valida Retiro/Período/Peso).

**Arredondamento:** `AnalVendas.pas` não contém nenhuma fórmula de cálculo (preço, valor, percentual
etc.) — a unit apenas monta uma string de parâmetros (`IntToStr`/`QuotedStr`/`FormatDateTime`) e
delega 100% do cálculo às procedures chamadas. Não há `RoundTo`/`SimpleRoundTo`/`Round`/`Trunc`/
`FormatFloat` nesta unit (confirmado por leitura literal das 468 linhas). Todo arredondamento e
proteção contra divisão por zero das fórmulas reais estão documentados em `[[spAnalVendasPec]]`
(que inclusive registra um achado de divisão por zero não protegida em `AnimaisIncFiscal`/
`AnimaisOutRec`) e em `[[spExtratoResultados]]`.

**Valores negativos em `ceProp`/`ceCliente`:** nenhum dos dois campos bloqueia digitação de valor
negativo em nível de propriedade do componente (sem `MinValue` configurado no `.dfm`) nem em
`OnValidate`. Na prática, porém, um valor negativo é inofensivo: tanto
`ceFuncPropertiesEditValueChanged`/`ceClientePropertiesEditValueChanged` (que resolvem o nome via
`BuscaPessoa`) quanto `btnImprimirClick` (que decide se envia `@Prop`/`@Cliente` à procedure) só
agem quando `EditValue > 0` — um valor negativo cai no mesmo ramo `else` do zero (mantém rótulo
"..:: TODOS ::.." e não é enviado à procedure como filtro), sem qualquer mensagem de erro.

---

## 6) Integrações e dados

### 6.1 Integrações (internas)

- **`[[spAnalVendasPec]]`** (751 linhas, já documentada em sessão anterior) — modos 0-3 e 5-6.
- **`[[spExtratoResultados]]`** (406 linhas, lida integralmente nesta sessão) — modo 4.
- **`Tabelas.Tipo=172`** (Categoria).
- Busca de Pessoa (`edDispAjudaPessoa`/`BuscaPessoa`) — infraestrutura genérica do ERP.

### 6.2 Modelo de dados

Nenhuma tabela própria — apenas parâmetros de entrada para as 2 procedures.

### 6.3 Triggers e Procedures do banco

- **`[[spAnalVendasPec]]`**, **`[[spExtratoResultados]]`** (ambas já documentadas).

---

## 7) Suporte: FAQ, mensagens, erros e troubleshooting

### 7.2 Catálogo de mensagens e erros

| Mensagem exata | Causa |
|---|---|
| "Código do Proprietário Inválido." / "Código do Cliente Inválido." | Busca de Pessoa sem correspondência |

---

## 9) Notas de revisão

- **2026-09-02** (auditoria de profundidade campo-a-campo, pós-Algodoeira)
  - **O que mudou:** releitura 100% literal de `Pecuaria/AnalVendas.pas` (468 linhas) e `.dfm`
    contra a nota existente. Dicionário de campos (seção 2) estava incompleto: faltavam
    `lblProp`/`lblCliente` (labels de resolução de nome via `BuscaPessoa`, com mensagem de erro
    quando o código não resolve), o menu de contexto `pmMarcar` (5 itens, não representado como
    controle na tabela — só citado em prosa na seção "Conceito") e `cxLabel1` (decorativo).
    Adicionada observação de que as colunas de grid `Tipo`/`Situacao`/`ModNegocio`/`UnidOcup`/
    `Descricao` são `Options.Editing = False` (só `Marcar` é editável). Adicionada seção explícita
    de arredondamento: confirmado por leitura literal que `AnalVendas.pas` **não contém nenhuma
    fórmula de cálculo nem `Round`/`Trunc`/`RoundTo`/`FormatFloat`** — todo o cálculo é delegado às
    procedures (`[[spAnalVendasPec]]`, `[[spExtratoResultados]]`), já auditadas separadamente
    (achado de divisão por zero não protegida registrado em `[[spAnalVendasPec]]`). Confirmado
    campo a campo que `ceProp`/`ceCliente` não bloqueiam valor negativo no nível do componente, mas
    o fluxo (`EditValueChanged` + `btnImprimirClick`, ambos com guarda `> 0`) torna um valor
    negativo equivalente a "Todos" sem erro — documentado explicitamente. Caminho de menu
    reconfirmado em `[[iniModuloPecuaria]]` (`sReferencia = 'AnalVendas'` → `TfmAnalVendas`, sem
    parâmetro adicional) — já estava correto, nenhuma referência pendente de "chamador não
    identificado" nesta nota. Referências cruzadas a `[[spAnalVendasPec]]` e `[[spExtratoResultados]]`
    conferidas e corretas (ambas já documentadas e existentes no vault).
  - **Impacto:** nenhum no sistema (documentação apenas). Nenhum erro factual encontrado no
    conteúdo pré-existente — os gaps eram de omissão (controles/menu de contexto ausentes do
    dicionário, ausência de declaração explícita sobre arredondamento/negativos), não de conteúdo
    incorreto.
  - **Referências:** `Pecuaria/AnalVendas.pas` + `.dfm` (releitura integral), `[[iniModuloPecuaria]]`,
    `[[spAnalVendasPec]]`, `[[spExtratoResultados]]`.

- **2026-08-28** (criação da nota — módulo Pecuária)
  - **O que mudou:** nota criada do zero, a partir de leitura 100% literal de
    `Pecuaria/AnalVendas.pas` (468 linhas) + `.dfm` (título confirmado "Análises de Vendas").
    **Resolve a referência cruzada pendente** sobre o consumidor do modo "Resumo Financeiro" de
    `[[spAnalVendasPec]]` (confirmado: itens 5-6 do combo `cbVisualizacao`). Documentado o modo 4
    ("Extratificada por Brincos"), que chama `[[spExtratoResultados]]` (lida e documentada
    integralmente nesta sessão, junto com `[[spConsumoMedioPec]]`). Confirmado o campo
    `LotesBaias.ModNegocio` (Gado Próprio/Boitel/Parceria @) e 6 valores de `LotesBaias.Tipo`.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** código-fonte `Pecuaria/AnalVendas.pas` + `.dfm`; `[[spAnalVendasPec]]`,
    `[[spExtratoResultados]]`, `[[spConsumoMedioPec]]`; ver `[[PrecosConfinamento]]`,
    `[[spRelDiarias]]`.
