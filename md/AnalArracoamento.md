> **Nota de método**: este documento descreve uma tela de um sistema LEGADO já em produção,
> reconstruída por engenharia reversa do código-fonte — não é uma especificação de feature nova
> obtida por entrevista com um PO. Por isso, toda seção que normalmente viria de uma conversa de
> negócio (motivação, métricas, objetivos) foi preenchida por **inferência a partir do
> comportamento do código**, e está marcada explicitamente como `(inferência)`. Onde nem o código
> nem o contexto do módulo permitem inferir nada com segurança, o campo está como `N/A`.
> Fonte: leitura 100% literal de `Pecuaria/AnalArracoamento.pas` (540 linhas, unit
> `AnalArracoamento`, classe `TfmAnalArracoamento`) e do `.dfm` correspondente (título confirmado
> "Análise Diária do Arraçoamento"), nesta sessão — 52º arquivo `.pas` lido do módulo Pecuária.
> Tela de relatório com seleção de Lotes via grade de checkbox (mesmo padrão de `[[AnalVendas]]`),
> chamando `[[spConsultaConsumo]]` (175 linhas, lida integralmente nesta sessão). Ver nota de
> método completa (limitação de DDL/tipos de coluna) em `[[ExportaDietas]]`, válida para todo o
> módulo.

---

**Status da implementação:** Legado — em produção (documentado via engenharia reversa, sem item de trabalho associado)

**Owner (curadoria):** @jefferson.arantes
**Tags:** #Pecuaria #Relatorio #Consumo #Arracoamento #MateriaSeca

---

## 0) Resumo executivo

- **O que é:** tela de parâmetros "Análise Diária do Arraçoamento" — para os Lotes selecionados
  (via grade de checkbox, com Mês/Ano de referência), gera um relatório **pivotado por dia do
  mês** (até 31 colunas) mostrando, conforme o modo escolhido: Consumo Médio Consolidado, Consumo
  Médio MN (Matéria Natural), Consumo Médio MS (Matéria Seca), Consumo Médio MS×PV (% sobre Peso
  Vivo), ou a Primeira Leitura de Cocho do dia.
- **Construção do pivot é feita inteiramente no Delphi**, não no SQL: `btnImprimirClick` cria um
  `ClientDataSet` em memória com `FieldDefs` geradas dinamicamente (31× 5 campos por dia:
  `MNCab01`.."31", `MSCab01`.."31", `MSxPV01`.."31", `QtdAnimais01`.."31", `Dieta01`.."31",
  `LCDia01`.."31"), e percorre o resultado "long" de `[[spConsultaConsumo]]` (uma linha por
  lançamento/dia) preenchendo as colunas correspondentes — um pivot manual clássico de aplicações
  legadas anteriores a `PIVOT` nativo do SQL Server ou por limitação de geração dinâmica de
  colunas em relatório.
- **Impacto principal:** nenhum efeito colateral no banco — apenas consulta e impressão.

---

## 1) Conceito

| Termo | Definição |
|-------|-----------|
| Seleção de Lotes replica exatamente a grade de `[[AnalVendas]]` | Mesma estrutura de grid com checkbox `Marcar`, mesmos 4 atalhos de marcação em massa (Todas/Nenhuma/Mesmo Tipo/Mesma Situação), mais um 5º atalho **exclusivo desta tela**: `miMarcarRua` (marca todos os Lotes da mesma Rua física do Lote focado) — achado de recurso adicional não presente em `[[AnalVendas]]`. |
| O Ano de referência é derivado dos lançamentos existentes, não um combo livre | `cbRetirosPropertiesEditValueChanged`: `SELECT DISTINCT YEAR(Data) FROM LancTratosLC WHERE Safra=... AND Retiro=...` — só oferece Anos em que existem lançamentos de trato para aquele Retiro/Safra. |
| A montagem do pivot trata o "Tipo=0" (resumo) e demais tipos de forma especial | O laço de pivot (`while NOT Eof`) usa `FieldByName('Tipo').AsInteger` (retornado por `[[spConsultaConsumo]]`: `0`=Resumo Geral/`1`=Resumo Lote/Mês/`2`=lançamento diário/`3`=Resumo Dia) para decidir quando criar uma nova linha de resumo (`cdsConsumo.Append`) vs. quando apenas preencher as colunas do dia numa linha já aberta — lógica de "quebra de controle" navegando um result set já ordenado por `Lote;Tipo;Data`. |
| A unidade de MN é ajustada por 1000 conforme o modo de visualização | `if (cbVisualizacao.ItemIndex=0) or (Tipo<>0) then TotalMN := ... else TotalMN := ... / 1000.00` — no modo "Consolidado" (índice 0), valores de resumo (Tipo=0, resumo geral) são convertidos de Kg para Toneladas; nos demais modos ou em linhas de detalhe, permanece em Kg — achado de conversão de unidade condicional pouco óbvia. |
| 3 templates de impressão distintos conforme o modo | `Template.FileName`: `ConsumoDiarioLote.rtm` (modo 0, "Consolidado"), `LCDiaria.rtm` (modo 4, "Leitura de Cocho"), `ConsumoDiarioDinamico.rtm` (modos 1-3). |

---

## 2) Dicionário de campos da tela (`.dfm`)

| Controle | Classe | Rótulo/Caption | Vinculado a (campo BD) | Obrigatório | Observações |
|---|---|---|---|---|---|
| `cbFazendas` | `TcxLookupComboBox` | (grupo "Fazendas") | **Não é passado a `spConsultaConsumo`** | — | Usado só para (1) filtrar a combo `cbRetiros` (`Retiros.Fazenda`) e (2) preencher o texto de cabeçalho `fFazenda` do pivot (`cbFazendas.EditingText`) — achado: apesar de aparecer como 1º filtro da tela, a Fazenda não restringe a consulta em si (quem restringe é `Retiro`, via `LotesBaias.Retiro`). Default = `_iUnidNegoc` (unidade de negócio corrente do usuário). |
| `cbRetiros` | `TcxLookupComboBox` | (grupo "Retiros") | `@Retiro` (parâmetro posicional 2 de `spConsultaConsumo`) — também filtra `LotesBaias.Retiro` na grade de Lotes | — | Ao trocar, dispara `cbRetirosPropertiesEditValueChanged`: recarrega `cbAno` e a grade de Lotes. Default = 1º registro (`First`) da combo de Retiros da Fazenda. |
| `cbAno` | `TcxLookupComboBox` | (grupo "Ano") | Compõe `@DataIni`/`@DataFim` (ano) | — | Populado por `SELECT DISTINCT DATEPART(YEAR,Data) FROM LancTratosLC WHERE Safra=... and Retiro=...` — só oferece Anos em que existem lançamentos de trato para aquele Retiro/Safra. **Default = o 1º ano da lista ordenada ascendentemente por `Descricao` (`IndexFieldNames:='Descricao'` + `First`), ou seja, o ano MAIS ANTIGO com lançamentos — não o ano corrente nem o mais recente** (achado: comportamento pouco intuitivo, usuário provavelmente precisa trocar o Ano manualmente na maioria dos usos). |
| `cbMes` | `TcxComboBox` | (grupo "Mês") | Compõe `@DataIni`/`@DataFim` (mês) | — | 12 itens fixos (Janeiro..Dezembro); default = mês corrente (`MonthOf(Date)-1`). |
| `cbVisualizacao` | `TcxComboBox` | (grupo "Visualização") | Determina `@Tipo` do EXEC (0 = Consolidado/Cocho, 1 = demais) + qual coluna de `spConsultaConsumo` alimenta o pivot | — | 5 itens fixos: `CONSUMO MÉDIO CONSOLIDADO`(0)/`CONSUMO MÉDIO MN`(1)/`CONSUMO MÉDIO MS`(2)/`CONSUMO MÉDIO MS x PV`(3)/`PRIMEIRA LEITURA DE COCHO`(4). Default = índice 0. |
| Grid `gdUnidOcup` (`gdUnidOcupTabela`) — coluna `gdUnidOcupTabelaMarcar` | `TcxGridDBColumn` (`TcxCheckBoxProperties`) | (sem caption própria) | `Marcar` (campo calculado em memória do `cdsLotes`, 'S'/'N', não persistido) | — | Única coluna editável da grade (`ImmediatePost=True`); demais colunas têm `Options.Editing=False` (somente leitura). |
| Grid `gdUnidOcup` — coluna `gdUnidOcupTabelaUnidOcup` | `TcxGridDBColumn` | "U.O." | `UnidOcupacao.Codigo` (alias `UnidOcup`) | — | Somente leitura. |
| Grid `gdUnidOcup` — coluna `gdUnidOcupTabelaDescricao` | `TcxGridDBColumn` | "Lote" | `LotesBaias.Descricao` | — | Somente leitura. |
| Grid `gdUnidOcup` — coluna `gdUnidOcupTabelaRua` | `TcxGridDBColumn` | (sem caption própria, herda "Rua" do campo) | `UnidOcupacao.Rua` | — | Somente leitura; usada pelo atalho `miMarcarRua` (exclusivo desta tela). |
| Grid `gdUnidOcup` — coluna `gdUnidOcupTabelaTipo` | `TcxGridDBColumn` | (sem caption própria, herda "Tipo") | `LotesBaias.Tipo` traduzido via `CASE` (T=Terminação/S=Suplementação/R=Recepção/C=Cria/X=X-Recria/E=Engorda) | — | Somente leitura; usada pelo atalho "Marcar Lotes desse Tipo". |
| Grid `gdUnidOcup` — coluna `gdUnidOcupTabelaSituacao` | `TcxGridDBColumn` | "Situação" | `LotesBaias.Situacao` traduzido via `CASE` (F=Fechado/A=Aberto/P=Parc. Vendido) | — | Somente leitura; usada pelo atalho "Marcar Lotes dessa Situação". |
| `btnImprimir`/`btnSair` | `TcxButton` | "Imprimir"/"Sair" | — | — | — |
| `mmQuery` | `TcxMemo` | — | — | Oculto por padrão (`Visible=False` no `.dfm`) | Painel de debug — alternado por F9 (`FormKeyDown`); recebe o texto literal dos comandos SQL montados (inclusive o `EXEC spConsultaConsumo`). |

---

## 5) Jornada do usuário + Especificação funcional

### SP-01 — Abrir a tela (`FormShow`)
Carrega Fazendas permitidas; visualização padrão índice 0; mês padrão o mês corrente.

### SP-02 — Trocar Fazenda/Retiro
Recarrega Retiros; ao selecionar Retiro, recarrega Anos disponíveis e a grade de Lotes com
atributos ricos (Tipo/Situação/Rua traduzidos).

### SP-03 — Selecionar Lotes (grade + menu de contexto, 5 atalhos)

### SP-04 — Gerar o relatório (`btnImprimirClick`)

**Pseudocódigo fiel (resumido):**
```
criar cdsConsumo em memória com FieldDefs dinâmicas (cabeçalho + 31 dias × 6 métricas)
montar lista de Lotes marcados
EXEC spConsultaConsumo @Safra, @Retiro, @Lotes=<lista>, @DataIni=<1º dia do Mês/Ano>,
  @DataFim=<último dia>, @Tipo=<0 se modo Consolidado(0)/Cocho(4), senão 1>
percorrer o resultado (ordenado por Lote;Tipo;Data):
  quando muda de Lote ou é uma linha "Tipo=0" (resumo): abrir nova linha no pivot (Append),
    preencher cabeçalho (Empresa/Safra/Fazenda/Retiro/Data/Visualização/Lote/Descrições)
  se Tipo<>0: preencher a coluna do dia correspondente (MNCab<dd>/MSCab<dd>/MSxPV<dd>/
    QtdAnimais<dd>/Dieta<dd>/LCDia<dd>, conforme o modo de visualização)
Post
selecionar template conforme o modo; imprimir
```

### 5.3 Regras de negócio e validações

Nenhuma validação de parâmetros identificada antes de gerar o relatório. Não há campo de entrada
numérica livre nesta tela (apenas combos/lookup e checkbox de seleção) — logo não se aplica
verificação de aceitação de valor negativo via `BeforePost`/`OnValidate`/`OnEditValueChanged`
campo a campo (nenhum desses handlers existe nesta unit para um campo numérico digitável).

**Arredondamento (auditoria campo a campo, 2026-09-02):** a única operação aritmética feita nesta
unit é a conversão de unidade `TotalMN := FieldByName('TotalMN').AsFloat / 1000.00` (Kg→Toneladas,
aplicada somente quando `cbVisualizacao.ItemIndex = 0` e `Tipo = 0`, ver Conceito). **Não há
nenhuma chamada a `RoundTo`/`SimpleRoundTo`/`Round`/`Trunc`/`FormatFloat` em nenhum ponto de
`AnalArracoamento.pas`** — todos os campos `ftFloat` do pivot (`MediaMNCab`, `MediaMSCab`,
`MediaMSxPV`, `MNCab<dd>`, `MSCab<dd>`, `MSxPV<dd>` etc.) recebem o valor de
`spConsultaConsumo` (ou o resultado da divisão por 1000) sem qualquer arredondamento explícito no
Delphi; se houver arredondamento/formatação visual, ele ocorre no template de impressão (`.rtm`,
fora do escopo desta nota) ou dentro de `[[spConsultaConsumo]]` (já documentada separadamente) —
não neste `.pas`.

---

## 6) Integrações e dados

### 6.1 Integrações (internas)

- **`[[spConsultaConsumo]]`** (175 linhas, lida integralmente) — fonte dos dados.

### 6.2 Modelo de dados

Nenhuma tabela própria — `cdsConsumo` é um `ClientDataSet` em memória, montado dinamicamente
(pivot manual) a partir do resultado de `[[spConsultaConsumo]]`.

### 6.3 Triggers e Procedures do banco

- **`[[spConsultaConsumo]]`**.

---

## 7) Suporte: FAQ, mensagens, erros e troubleshooting

Nenhuma mensagem de validação própria identificada nesta unit.

---

## 9) Notas de revisão

- **2026-09-02** (auditoria de profundidade campo-a-campo — pós-achados do módulo Algodoeira)
  - **O que mudou:** releitura 100% literal de `AnalArracoamento.pas` (540 linhas) e `.dfm`
    (617 linhas) nesta sessão. Reescrita da seção 2 (dicionário de campos): a tabela resumida
    anterior condensava as 6 colunas do grid `gdUnidOcup` em uma única linha sem vínculo a campo
    de BD; agora cada coluna (`Marcar`, `UnidOcup`, `Descricao`, `Rua`, `Tipo`, `Situacao`) tem
    linha própria, com o campo BD de origem e se é editável (só `Marcar`) ou somente leitura
    (demais colunas, `Options.Editing=False`). **Corrigido achado impreciso:** `cbFazendas`
    (rotulado antes como "escopo") na verdade **não é parâmetro de `spConsultaConsumo`** — só
    filtra a combo de Retiros e alimenta o texto de cabeçalho do relatório; quem de fato filtra a
    consulta é `cbRetiros` (`@Retiro`). **Novo achado:** o default de `cbAno` é o ANO MAIS ANTIGO
    com lançamentos (primeiro registro de uma lista ordenada ascendentemente), não o ano corrente
    nem o mais recente — comportamento pouco intuitivo não documentado antes. Adicionada seção
    explícita de arredondamento (5.3): confirmado que **não existe nenhuma chamada a
    `RoundTo`/`SimpleRoundTo`/`Round`/`Trunc`/`FormatFloat`** nesta unit — a única operação
    aritmética é a divisão `/1000.00` (Kg→Toneladas) sem arredondamento; e que não há campo de
    entrada numérica livre na tela, logo não se aplica checagem de valor negativo. Confirmado via
    `[[iniModuloPecuaria]]` (mapa `sReferencia`→Tela) que `AnalArracoamento` já está mapeado com
    ✓ como acessível pelo menu principal, e que `[[spConsultaConsumo]]` já existe como nota
    satélite própria no vault (referência cruzada já estava correta, não precisou de correção).
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** releitura de `Pecuaria/AnalArracoamento.pas` + `.dfm`;
    `[[iniModuloPecuaria]]`; `[[spConsultaConsumo]]`.

- **2026-08-28** (criação da nota — módulo Pecuária)
  - **O que mudou:** nota criada do zero, a partir de leitura 100% literal de
    `Pecuaria/AnalArracoamento.pas` (540 linhas) + `.dfm` (título confirmado "Análise Diária do
    Arraçoamento"). Documentado o relatório de consumo pivotado por dia do mês, com pivot manual
    em Delphi a partir de `[[spConsultaConsumo]]` (lida integralmente). Achado: atalho de
    marcação por Rua exclusivo desta tela; conversão condicional de unidade (Kg→Toneladas) no
    modo Consolidado.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** código-fonte `Pecuaria/AnalArracoamento.pas` + `.dfm`;
    `[[spConsultaConsumo]]`; ver `[[AnalVendas]]` (padrão de seleção de Lotes).
