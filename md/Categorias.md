> **Nota de método**: este documento descreve uma tela de um sistema LEGADO já em produção,
> reconstruída por engenharia reversa do código-fonte — não é uma especificação de feature nova
> obtida por entrevista com um PO. Por isso, toda seção que normalmente viria de uma conversa de
> negócio (motivação, métricas, objetivos) foi preenchida por **inferência a partir do
> comportamento do código**, e está marcada explicitamente como `(inferência)`. Onde nem o código
> nem o contexto do módulo permitem inferir nada com segurança, o campo está como `N/A`.
> Fonte: leitura 100% literal de `Pecuaria/Categorias.pas` (261 linhas, unit `Categorias`, classe
> `TfmCategorias`) e do `.dfm` correspondente (título confirmado "Cadastro de Categorias de
> Gado"), nesta sessão — 16º arquivo `.pas` lido do módulo Pecuária. **Resolve uma referência
> cruzada pendente**: esta é a tela de cadastro de `Tabelas.Tipo=172` (Categoria Pecuária), cujo
> bloco de proteção contra exclusão (`CHECKCATEGORIAPEC`) já havia sido identificado dentro de
> `[[TD_TABELAS]]` antes deste arquivo ser processado — confirmado que `CHECKCATEGORIAPEC` está
> **embutido no próprio código de `TD_TABELAS.sql`** (não é uma procedure separada — busca em
> `scripts/procedures` não encontrou arquivo próprio). `Tipo=172` é, portanto, o único domínio
> `Tabelas` do módulo com proteção de exclusão confirmada até agora (diferente de `166`/`180`/
> `182`/`185`/`222`, todos sem proteção). Ver nota de método completa (limitação de DDL/tipos de
> coluna) em `[[ExportaDietas]]`, válida para todo o módulo.

---

**Status da implementação:** Legado — em produção (documentado via engenharia reversa, sem item de trabalho associado)

**Owner (curadoria):** @jefferson.arantes
**Tags:** #Pecuaria #Cadastro #Categoria #SexoPec #FaixaEtaria

---

## 0) Resumo executivo

- **O que é:** cadastro em grade "Cadastro de Categorias de Gado" — registros de
  `Tabelas.Tipo=172`, cada um combinando Descrição, Sexo (`SexoPec`: M/F), uma Faixa Etária
  embutida (`FaixaIdadeIni`/`FaixaIdadeFinal` + rótulos `De`/`Ate`, mesmo padrão de
  `[[FaixaEtaria]]` mas **não vinculado** àquela tabela — são colunas próprias, não uma FK),
  um Fator de Conversão numérico (`Conversor`, coluna "FRC") e um flag "Evoluir" (`TipoVal`: `S`/
  outro→`N`, controla se a Categoria participa de evolução automática de idade/peso entre
  Categorias — **confirmado** via `[[EvolCategorias]]`: apenas Categorias com `TipoVal='S'`
  aparecem como opção de destino ao editar manualmente a evolução de um SubGrupo).
- **É o domínio central de Categoria Pecuária do ERP** — referenciado (achado de integridade)
  por `CHECKCATEGORIAPEC` dentro de `[[TD_TABELAS]]`, que impede a exclusão de uma Categoria em
  uso (única proteção de exclusão confirmada entre os domínios de `Tabelas` documentados no
  módulo até agora).
- **Impacto principal:** CRUD em `Tabelas` (`Tipo=172`) — dispara `[[TU_TABELAS]]`/
  `[[TD_TABELAS]]`; a exclusão passa pela checagem `CHECKCATEGORIAPEC`.

---

## 1) Conceito

| Termo | Definição |
|-------|-----------|
| "Evoluir" (`TipoVal`) tem lógica de default diferente do padrão `N`/`A`/`S` de `[[CausaMortis]]` | Aqui é um flag binário: `cdsCadastroBeforePost` força `TipoVal := 'N'` sempre que o valor não for exatamente `'S'` — ou seja, qualquer valor diferente de `'S'` (incluindo nulo) é normalizado para `'N'` na gravação. Rótulo da coluna no grid é "Evoluir" (não "Tipo" como em `CausaMortis`), sugerindo controle de participação em rotina de evolução automática entre Categorias por idade `(inferência)`. |
| "Sexo" usa o mesmo padrão `GetText`/`SetText` de mapeamento de código→rótulo já visto no módulo | `cdsCadastroSexoPecGetText`/`SetText`: `'M'`↔"MACHO", `'F'`↔"FÊMEA" — mesmo mecanismo de `[[CausaMortis]]` (lá para `TipoVal`), aqui para `SexoPec`. |
| A Faixa Etária é redundante com `[[FaixaEtaria]]` — não há vínculo entre as duas telas | `Categorias` tem seus próprios campos `FaixaIdadeIni`/`FaixaIdadeFinal`/`De`/`Ate` dentro do registro de `Tipo=172`, estruturalmente idênticos aos de `Tabelas.Tipo=185` (`[[FaixaEtaria]]`), mas **sem nenhuma FK ou referência cruzada** entre os dois — cada Categoria define sua própria faixa de idade inline, independente do cadastro central de Faixas Etárias `(achado de possível duplicação conceitual, não confirmável como bug sem mais contexto)`. |
| A ordenação padrão da consulta agrupa por "Evoluir" antes de Sexo/Idade | `ORDER BY TipoVal DESC, SexoPec, FaixaIdadeIni` — Categorias com `TipoVal='S'` (Evoluir) aparecem primeiro na grade, sugerindo que essas são numericamente/logicamente destacadas para conferência. |
| Mesma inconsistência de literais `'De'`/`'Até'` já vista em `[[FaixaEtaria]]` | A consulta de listagem (`btnConsultaClick`) usa `QuotedStr('De') De` e `QuotedStr('Até') Ate` como literais fixos em vez de ler as colunas reais `De`/`Ate` da tabela — **mesmo achado de risco já documentado em `[[FaixaEtaria]]`**, aqui reproduzido de forma idêntica (mesmo padrão de código copiado). |

---

## 2) Dicionário de campos da tela (`.dfm`)

> **Releitura de auditoria (2026-09-02):** tabela expandida — a versão anterior colapsava as 9
> colunas do grid em 1 única linha, omitindo `Options.Editing`/`Enabled`/`Styles` por coluna e o
> navegador `dnNavega`. Confirmado campo a campo contra `Categorias.dfm` linhas 37–70 (navegador) e
> 484–593 (colunas do grid).

**Critérios de seleção (topo da tela):**

| Controle | Classe | Rótulo/Caption | Vinculado a (campo BD) | Obrigatório | Observações |
|---|---|---|---|---|---|
| `teDescricao` | `TcxTextEdit` | (grupo "Descrição") | filtro apenas (`LIKE`, case-insensitive via `Upper`) | Não | — |
| `cbSexo` | `TcxComboBox` | (grupo "Sexo") | filtro apenas, sobre `SexoPec` | Não | `Properties.Items.Strings`: `'..:: TODOS ::..'` / `'MACHO '` / `'FÊMEA'` (confirmado literalmente no `.dfm`, linhas 751–754); índice 0 = sem filtro; `ImmediatePost=True`. |
| `btnConsulta` | `TcxButton` | "Consultar" | — | — | Dispara `btnConsultaClick` (SP-02). |
| `btnExcel` | `TcxButton` | "Exportar" | — | — | Dispara `btnExcelClick` (SP-04). |
| `btnImprimir` | `TcxButton` | "Imprimir" | — | — | **Permanentemente desabilitado** (`Enabled = False` no `.dfm`), sem `OnClick` — não implementado. |
| `btnAplicar` | `TcxButton` | "Aplicar" | — | — | **Permanentemente desabilitado** (`Enabled = False` no `.dfm`), sem `OnClick` — não implementado (diferente de `[[CadRaca]]`/`[[Misturadores]]`, aqui não há duplo papel de seletor; `iCodigo`/`iTipo` são públicos mas nenhum handler de duplo-clique foi declarado nesta unit — campos aparentemente vestigiais). |

**Navegador da grade:**

| Controle | Classe | Rótulo/Caption | Vinculado a (campo BD) | Obrigatório | Observações |
|---|---|---|---|---|---|
| `dnNavega` | `TcxDBNavigator` | (sem legenda própria) | `dsCadastro` (via `DataSource`) | — | Botões visíveis (com atalho): Inserir (F3), Excluir (F4), Alterar (F5), Salvar (F6), Cancelar (F7). Botões `First`/`Prior`/`Next`/`Last`/`PriorPage`/`NextPage`/`Refresh`/`SaveBookmark`/`GotoBookmark`/`Filter` têm `Visible = False` no `.dfm` — ocultos porque a navegação é feita direto na grade, não pelo navegador. `Buttons.ConfirmDelete = False` — a confirmação de exclusão não vem do navegador padrão, é feita manualmente em `cdsCadastroBeforeDelete` (BR de confirmação, ver SP-03). |

**Colunas da grade `gdCadastroDBTableView1` (edição inline, 1 linha = 1 registro de `Tabelas.Tipo=172`):**

| Controle (coluna) | Classe | Rótulo/Caption | Vinculado a (campo BD) | Obrigatório | Observações |
|---|---|---|---|---|---|
| `gdCadastroDBTableView1Codigo` | `TcxGridDBColumn` (`TcxCurrencyEditProperties`) | "Código" | `Codigo` | — (gerado pelo sistema) | **Somente leitura**: `Properties.ReadOnly = True` **e** `Options.Editing = False` **e** `Options.Moving = False`, com `Styles.Content = dmITP.cxStyleDisable` (aparência visualmente acinzentada) — o usuário nunca digita o Código; é atribuído por `LoadSequencia('Tabelas','Codigo','Tipo','172')` na gravação de inclusão. `DecimalPlaces=0`, `DisplayFormat='0'`. |
| `gdCadastroDBTableView1Descricao` | `TcxGridDBColumn` (texto livre) | "Descrição" | `Descricao` | **Sim** (BR-001) | Editável, sem máscara. Largura 180px. |
| `gdCadastroDBTableView1TipoVal` | `TcxGridDBColumn` (`TcxCheckBoxProperties`) | "Evoluir" | `TipoVal` | Não (normalizado no `BeforePost`) | Renderizada como **checkbox** (não texto): `ValueChecked='S'` / `ValueUnchecked='N'` / `DisplayChecked='S'` / `DisplayUnchecked='N'` / `NullStyle=nssUnchecked` (nulo exibido como desmarcado) / `ImmediatePost=True` (grava a alteração assim que o checkbox é clicado, sem esperar F6/Post explícito do navegador — diferente das colunas de texto). |
| `gdCadastroDBTableView1SexoPec` | `TcxGridDBColumn` (`TcxComboBoxProperties`) | "Sexo" | `SexoPec` | **Sim** (BR-002) | Combo de edição **dentro da grade** (distinto do `cbSexo` de filtro do topo): `DropDownListStyle=lsFixedList`, `Properties.Items.Strings = 'MACHO' / 'FÊMEA'` (sem opção vazia/"TODOS" — só 2 valores, confirmando que ficar em branco só ocorre em registro recém-inserido), `ImmediatePost=True`. O texto exibido/gravado (`M`/`F`) passa por `cdsCadastroSexoPecGetText`/`SetText` (mapeamento código↔rótulo), igual ao já documentado na seção 1. |
| `gdCadastroDBTableView1De` | `TcxGridDBColumn` (sem `PropertiesClassName`, texto simples) | (sem `Caption` — coluna com `IsCaptionAssigned=True` e caption vazia) | `De` | — | **Somente leitura**: `Options.Editing=False`, `Options.Focusing=False`, `Options.Moving=False`, `Styles.Content=dmITP.cxStyleDisable`. Sempre exibe o literal fixo `'De'` (gravado por `cdsCadastroAfterInsert` e retornado como literal fixo pela própria consulta SQL — ver achado de `'De'`/`'Até'` na seção 1). Largura 25px — coluna estreita, só rótulo. |
| `gdCadastroDBTableView1FaixaIdadeIni` | `TcxGridDBColumn` (`TcxCurrencyEditProperties`) | "Inicial" | `FaixaIdadeIni` | Não (sem validação de obrigatoriedade no `BeforePost`) | Editável. `DisplayFormat='0'`/`EditFormat='0'` (inteiro, sem casas decimais), `Nullable=False`, `NullString='0'` (nulo exibido como 0), `UseThousandSeparator=True`. **Sem `MinValue`/`MaxValue` definidos** — aceita valores negativos digitados (não há `OnValidate`/`OnEditValueChanged` nem checagem no `cdsCadastroBeforePost` que rejeite negativo ou faixa invertida — ver achado abaixo). |
| `gdCadastroDBTableView1Ate` | `TcxGridDBColumn` (sem `PropertiesClassName`, texto simples) | (sem `Caption`) | `Ate` | — | **Somente leitura**, mesmo padrão de `gdCadastroDBTableView1De`: `Options.Editing=False`/`Focusing=False`/`Moving=False`, `Styles.Content=dmITP.cxStyleDisable`. Sempre exibe o literal fixo `'Até'`. Largura 34px. |
| `gdCadastroDBTableView1FaixaIdadeFinal` | `TcxGridDBColumn` (`TcxCurrencyEditProperties`) | "Final" | `FaixaIdadeFinal` | Não (sem validação de obrigatoriedade no `BeforePost`) | Editável. Mesmas propriedades de formato/nulidade de `FaixaIdadeIni` (`DisplayFormat='0'`, `Nullable=False`, `NullString='0'`, `UseThousandSeparator=True`). **Sem `MinValue`/`MaxValue`** — mesmo achado: aceita negativo, e nada impede `FaixaIdadeFinal < FaixaIdadeIni` (BR-003, já documentada). |
| `gdCadastroDBTableView1Conversor` | `TcxGridDBColumn` (`TcxCurrencyEditProperties`) | "FRC" | `Conversor` | Não (default `1` na inclusão, via `cdsCadastroAfterInsert`) | "FRC" = Fator de Conversão (`TFloatField`). `DisplayFormat=',0.00'`/`EditFormat=',0.00'` (2 casas decimais, **apenas formatação de exibição/edição da máscara `cx`** — ver achado de arredondamento abaixo). `Nullable=False`, `NullString=',0.00'`. **Sem `MinValue`/`MaxValue`** — aceita valor negativo ou zero digitado livremente; propósito exato de uso downstream não confirmável sem consumidor identificado. |

#### Achado — Nenhum arredondamento explícito de código, e campos numéricos aceitam negativo sem validação

- Releitura completa de `Categorias.pas` (261 linhas) **não encontrou nenhuma chamada** a
  `RoundTo`, `SimpleRoundTo`, `Round`, `Trunc` ou `FormatFloat` em nenhum evento do formulário
  (`BeforePost`, `AfterInsert`, `GetText`/`SetText`, etc.) — os únicos "arredondamentos" visíveis
  são as máscaras de **exibição** `DisplayFormat`/`EditFormat` dos componentes `cx` no `.dfm`
  (`'0'` para `FaixaIdadeIni`/`FaixaIdadeFinal`, `',0.00'` para `Conversor`), que formatam a
  apresentação mas **não alteram nem truncam o valor efetivamente gravado no banco**.
- **Nenhum dos 3 campos numéricos editáveis da grade** (`FaixaIdadeIni`, `FaixaIdadeFinal`,
  `Conversor`) tem `Properties.MinValue` no `.dfm`, nem qualquer `OnValidate`/`OnEditValueChanged`
  no `.pas` — confirmado por busca literal na unit inteira: os únicos handlers de validação
  existentes são os dois `if` de `cdsCadastroBeforePost` (BR-001/BR-002), que checam apenas
  `Descricao`/`SexoPec` (texto). Ou seja, **valores negativos são tecnicamente aceitos** para
  Idade Inicial, Idade Final e Fator de Conversão — não há bloqueio de UI nem de código do lado do
  cliente (permanece a ser confirmado se há `CHECK` constraint no lado do banco, fora do escopo
  desta tela).

---

## 5) Jornada do usuário + Especificação funcional

### SP-01 — Abrir a tela (`FormShow`)
Aplica permissão de somente-leitura; `cbSexo` inicia no índice 0 (sem filtro); executa consulta
inicial.

### SP-02 — Filtrar (`btnConsultaClick`)
```
SELECT Codigo, Tipo, RTRIM(Descricao) Descricao, 'De' De, FaixaIdadeIni, 'Até' Ate,
       FaixaIdadeFinal, SexoPec, Conversor, TipoVal
FROM Tabelas WHERE Tipo = 172
[AND Upper(Descricao) LIKE Upper('%...%')]
[AND SexoPec = 'M'/'F']
ORDER BY TipoVal DESC, SexoPec, FaixaIdadeIni
```
**Achado:** mesmo problema de literais fixos `'De'`/`'Até'` já visto em `[[FaixaEtaria]]`.

### SP-03 — Incluir/Editar/Excluir na grade (navegador `dnNavega`, atalhos F3/F4/F5/F6/F7)

**Pseudocódigo fiel:**
```
ao inserir novo registro:
  focar a grade, coluna "Descrição" com seleção
  De := 'De'
  Ate := 'Até'
  Conversor := 1

ao gravar (Post):
  se Descricao (trim) = '': avisar "Indique a Descrição." e abortar (foca coluna 1)
  senão se SexoPec (trim) = '': avisar "Indique o Sexo." e abortar (foca coluna 6)
  senão:
    se é Inclusão:
      Codigo := LoadSequencia('Tabelas', 'Codigo', escopado por Tipo=172)
      Tipo := 172
    se TipoVal <> 'S': TipoVal := 'N'   -- normalização, sempre executada
  // ApplyUpdates via provider grava o INSERT/UPDATE real (dispara TU_TABELAS se Edição)
  CommitTransacaoTabelas(...)

ao excluir:
  confirmar "Deseja Realmente Excluir o Registro Selecionado?"
  se confirmado: prosseguir (dispara TD_TABELAS, que EXECUTA CHECKCATEGORIAPEC para Tipo=172 —
    pode bloquear a exclusão se a Categoria estiver em uso; ver [[TD_TABELAS]])
  senão: abortar
```

### SP-04 — Exportar para Excel (`btnExcelClick`)

### 5.3 Regras de negócio e validações

#### BR-001 — Descrição obrigatória
- **Mensagem:** "Indique a Descrição."

#### BR-002 — Sexo obrigatório
- **Mensagem:** "Indique o Sexo."

#### BR-003 — Nenhuma validação de faixa etária invertida ou sobreposta entre Categorias
- **Achado:** mesma lacuna já documentada em `[[FaixaEtaria]]`, reproduzida aqui de forma
  independente (campos próprios, não compartilhados).

#### BR-004 — Exclusão de Categoria em uso É bloqueada no banco (diferente das demais telas do grupo)
- **Achado positivo:** ao contrário de `Tipo=166/180/182/185/222`, `Tipo=172` tem proteção via
  `CHECKCATEGORIAPEC` (embutida em `[[TD_TABELAS]]`) — impede exclusão de Categoria referenciada
  por outras tabelas do módulo.

---

## 6) Integrações e dados

### 6.1 Integrações (internas)

Nenhuma navegação para outras telas — cadastro autocontido. **Caminho de menu confirmado** via
`[[iniModuloPecuaria]]` (mapa `sReferencia`→Tela, seção 6.1 daquela nota): item de menu
`sReferencia = 'Categorias'` abre `TfmCategorias` diretamente, **sem parâmetro de contexto**
(diferente de telas como `Hospitalizacoes`/`RecepcaoAnimais`, que recebem `sTipo`/`sTipoRom`) —
menu principal do módulo Pecuária.

**Domínio central** referenciado por diversas outras rotinas do módulo:
- `[[TU_TABELAS]]`/`[[TD_TABELAS]]` (genéricas) — citam "Categoria Pecuária" e, no caso de
  `TD_TABELAS`, embutem a checagem `CHECKCATEGORIAPEC` (ver BR-004).
- `[[EvolCategorias]]` (tela "Evolução de Categorias de Animais") — **consome diretamente o flag
  `TipoVal` desta tela**: seu `btnConfirmarSelClick` filtra o lookup de Categorias por
  `Codigo <> 0 and TipoVal = 'S'`, confirmando em código que "Evoluir" (`TipoVal='S'`) controla
  quais Categorias podem ser destino de evolução automática entre SubGrupos — resolve a dúvida
  antes marcada como "não confirmável em detalhe sem o consumidor" no resumo executivo (seção 0).
- `[[ResumoCategorias]]` (relatório "Resumos por Categorias") e as procedures que ela chama —
  `[[spResCategoriasPec]]` (visão "Fluxo", também usada por `[[ControleDiario]]`) e
  `[[spResConsumoCat]]` (visão "Consumo") — agrupam e exibem movimentação/consumo por Categoria
  (`Tabelas.Tipo=172`), sem gravar nela.
- `[[spConsEvolCategorias]]` — procedure de consulta usada por `[[EvolCategorias]]` na etapa de
  Seleção; não referencia `Categorias.pas` diretamente, mas opera sobre o mesmo domínio
  (`@CatAtual`, Categoria sugerida por SubGrupo).

### 6.2 Modelo de dados

**Tabela `Tabelas`** (genérica, `Tipo=172` = Categoria Pecuária):

| Coluna | Tipo (Delphi/inferido) | Papel nesta tela |
|---|---|---|
| `Codigo` | `TIntegerField` (persistente) — `int` (alta confiança) | Chave — gerada por `LoadSequencia` escopada por `Tipo`. |
| `Tipo` | `TIntegerField` (persistente) — `int` (alta confiança) | Fixado em `172` na inclusão. |
| `Descricao` | `TStringField` (persistente) — `varchar` (alta confiança) | Nome da Categoria. |
| `SexoPec` | `TStringField` (persistente, `GetText`/`SetText` customizados) — `char(1)` (alta confiança) | `M`/`F`. |
| `De`/`Ate` | `TStringField` (persistente) — `varchar` (alta confiança) | Rótulos textuais da faixa (mesmo achado de literais fixos na listagem de `[[FaixaEtaria]]`). |
| `FaixaIdadeIni`/`FaixaIdadeFinal` | `TIntegerField` (persistente) — `int` (alta confiança) | Faixa etária própria da Categoria (não vinculada a `[[FaixaEtaria]]`). |
| `Conversor` | `TFloatField` (persistente) — `float`/`real` (alta confiança) | "FRC" — Fator de Conversão, default `1`; propósito exato não confirmado. |
| `TipoVal` | `TStringField` (persistente) — `char(1)` (alta confiança) | Flag "Evoluir" (`S`/`N`, normalizado para `N` se diferente de `S`). |

### 6.3 Triggers e Procedures do banco

- **`[[TU_TABELAS]]`**/**`[[TD_TABELAS]]`** (genéricas, já documentadas) — `Tipo=172` **tem**
  bloco de proteção (`CHECKCATEGORIAPEC`, embutido em `TD_TABELAS.sql`) contra exclusão de
  Categoria em uso — único caso confirmado no módulo até agora.
- `TI_TABELAS` (trigger de `INSERT`) **não existe** (confirmado em `[[ExportaDietas]]`).

---

## 7) Suporte: FAQ, mensagens, erros e troubleshooting

### 7.2 Catálogo de mensagens e erros

| Mensagem exata | Causa |
|---|---|
| "Indique a Descrição." | BR-001 |
| "Indique o Sexo." | BR-002 |
| "Deseja Realmente Excluir o Registro Selecionado?" | Confirmação de exclusão |
| (mensagem de erro de `CHECKCATEGORIAPEC`, ver `[[TD_TABELAS]]`) | BR-004 — exclusão bloqueada |

---

## 9) Notas de revisão

- **2026-09-02** (auditoria de profundidade nível-campo — módulo Pecuária)
  - **O que mudou:** releitura completa de `Categorias.pas` (261 linhas) e `Categorias.dfm`
    (896 linhas). Gaps reais corrigidos:
    1. **Seção 2 (dicionário de campos)** — a tabela anterior colapsava as 9 colunas do grid
       (`gdCadastroDBTableView1`) em 1 única linha genérica. Reescrita como 3 tabelas separadas
       (Critérios de seleção / Navegador `dnNavega` / Colunas do grid), com cada coluna do grid
       documentada individualmente, incluindo as 2 colunas antes omitidas `De`/`Ate` (rótulos
       fixos, somente leitura, `Styles.Content=cxStyleDisable`) e o controle `dnNavega`
       (`TcxDBNavigator`) que não constava na tabela.
    2. **Arredondamento/sinal** — confirmado por releitura literal que `Categorias.pas` **não
       usa** `RoundTo`/`SimpleRoundTo`/`Round`/`Trunc`/`FormatFloat` em nenhum evento; as máscaras
       `DisplayFormat`/`EditFormat` do `.dfm` são só de exibição. Confirmado também que
       `FaixaIdadeIni`, `FaixaIdadeFinal` e `Conversor` **não têm `MinValue`/`MaxValue`** nem
       `OnValidate`/`OnEditValueChanged` — aceitam valor negativo sem bloqueio de tela (achado novo,
       registrado na seção 2).
    3. **Caminho de menu** — confirmado via `[[iniModuloPecuaria]]` (mapa `sReferencia`→Tela, já
       existente no vault): `sReferencia='Categorias'` abre `TfmCategorias` direto, sem parâmetro
       de contexto. Corrigida a seção 6.1, que antes dizia "menu ainda não lido nesta sessão".
    4. **Satélites** — `[[EvolCategorias]]`, `[[ResumoCategorias]]`, `[[spConsEvolCategorias]]` e
       `[[spResCategoriasPec]]` já existiam no vault (não estavam "não processadas" como a nota
       antiga sugeria); adicionadas como referências cruzadas explícitas na seção 6.1 e no resumo
       executivo (seção 0), confirmando em código que `TipoVal='S'` é consumido por
       `EvolCategorias` para filtrar Categorias elegíveis como destino de evolução.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** releitura de `Pecuaria/Categorias.pas` + `.dfm`; `[[iniModuloPecuaria]]`,
    `[[EvolCategorias]]`, `[[ResumoCategorias]]`, `[[spConsEvolCategorias]]`,
    `[[spResCategoriasPec]]`.

- **2026-08-28** (criação da nota — módulo Pecuária)
  - **O que mudou:** nota criada do zero, a partir de leitura 100% literal de
    `Pecuaria/Categorias.pas` (261 linhas) + `.dfm` (título confirmado "Cadastro de Categorias de
    Gado"). Documentado o cadastro de `Tabelas.Tipo=172` (Categoria Pecuária), domínio central já
    citado em `[[TD_TABELAS]]`/`[[TU_TABELAS]]`. Confirmado que `CHECKCATEGORIAPEC` está embutido
    no próprio `TD_TABELAS.sql` (não é procedure separada). Achados: mesma inconsistência de
    literais `'De'`/`'Até'` fixos na listagem já vista em `[[FaixaEtaria]]`; Faixa Etária própria
    da Categoria não vinculada ao cadastro central `[[FaixaEtaria]]`; `Tipo=172` é o único domínio
    do módulo com proteção de exclusão confirmada.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** código-fonte `Pecuaria/Categorias.pas` + `.dfm`; ver `[[FaixaEtaria]]`,
    `[[CausaMortis]]`, `[[TU_TABELAS]]`, `[[TD_TABELAS]]`.
