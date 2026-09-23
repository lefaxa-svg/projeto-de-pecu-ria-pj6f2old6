> **Nota de método**: este documento descreve uma tela de um sistema LEGADO já em produção,
> reconstruída por engenharia reversa do código-fonte — não é uma especificação de feature nova
> obtida por entrevista com um PO. Por isso, toda seção que normalmente viria de uma conversa de
> negócio (motivação, métricas, objetivos) foi preenchida por **inferência a partir do
> comportamento do código**, e está marcada explicitamente como `(inferência)`. Onde nem o código
> nem o contexto do módulo permitem inferir nada com segurança, o campo está como `N/A`.
> Fonte: leitura 100% literal de `Pecuaria/CausaMortis.pas` (228 linhas, unit `CausaMortis`,
> classe `TfmCausaMortis`) e do `.dfm` correspondente (título confirmado "Cadastro de Causa
> Mortis"), nesta sessão — 12º arquivo `.pas` lido do módulo Pecuária. **Terceira tela do mesmo
> padrão de cadastro CRUD em grade sobre `Tabelas`** (após `[[EscoresConsMetas]]` `Tipo=222` e
> `[[AvalCorporal]]` `Tipo=182`), aqui `Tipo=180`. Triggers genéricas `[[TU_TABELAS]]`/
> `[[TD_TABELAS]]` (já documentadas) aplicam-se — `Tipo=180` **não tem** bloco de validação
> específico em nenhuma das duas. Ver nota de método completa (limitação de DDL/tipos de coluna)
> em `[[ExportaDietas]]`, válida para todo o módulo.

---

**Status da implementação:** Legado — em produção (documentado via engenharia reversa, sem item de trabalho associado)

**Owner (curadoria):** @jefferson.arantes
**Tags:** #Pecuaria #Cadastro #CausaMortis #Morte

---

## 0) Resumo executivo

- **O que é:** cadastro em grade "Cadastro de Causa Mortis" — registros de `Tabelas.Tipo=180`,
  cada um com Código, Descrição e um "Tipo da Morte" (`TipoVal`: `N`=Natural, `A`=Acidental,
  `S`=Sacrifício). Domínio consumido pela tela `[[MorteAnimaisPec]]` (campo `lcbCausa`,
  `TcxLookupComboBox`), que grava o `Codigo` escolhido em `RegMortesPec` — vínculo confirmado
  nesta auditoria (ver seção 6.1).
- **Quando usar (inferência):** configurado uma vez por protocolo; selecionado ao registrar a
  morte de um animal, para classificar a causa.
- **Impacto principal:** CRUD em `Tabelas` (`Tipo=180`) via `ClientDataSet.Post`/`Delete` — dispara
  `[[TU_TABELAS]]`/`[[TD_TABELAS]]`, ambas sem regra específica para `Tipo=180`.

---

## 1) Conceito

| Termo | Definição |
|-------|-----------|
| `TipoVal` é armazenado como 1 caractere mas exibido por extenso via `GetText`/`SetText` | `cdsCadastroTipoValGetText`/`SetText`: mapeia `'N'`↔"NATURAL", `'A'`↔"ACIDENTAL", `'S'`↔"SACRIFÍCIO" — mesmo padrão de campo `char(1)` com rótulo textual amigável via `TField.OnGetText`/`OnSetText` visto em outras notas do ERP (não específico deste módulo). |
| Botão "Aplicar" existe mas está permanentemente desabilitado e sem handler — **3ª ocorrência do mesmo padrão no módulo** | Igual a `[[AvalCorporal]]` (que tem 2 botões mortos: "Imprimir" e "Aplicar") e a `[[VisBrincoRep]]` ("Alterar Selecionado") — reforça a hipótese de um template de tela de cadastro simples copiado repetidamente no módulo, com um botão "Aplicar"/ação extra planejada mas nunca implementada em nenhuma das cópias vistas até agora. |
| Filtro "Tipo da Morte" replica os mesmos 3 valores do campo, mais uma opção "Todos" | `cbTipoMorte`: "..:: TODOS ::." (índice 0, sem filtro) / "NATURAL" / "ACIDENTAL" / "SACRIFÍCIO" — filtro por igualdade usando o primeiro caractere do texto selecionado (`Copy(cbTipoMorte.EditingText,1,1)`), mesmo truque usado em outras telas para evitar manter um segundo combo de códigos. |

---

## 2) Dicionário de campos da tela (`.dfm`)

### 2.1 Barra superior (`cxGroupBox2`) e critérios de seleção (`cxGroupBox3`)

| Controle | Classe | Rótulo/Caption | Vinculado a (campo BD) | Obrigatório | Observações |
|---|---|---|---|---|---|
| `dnNavega` | `TcxDBNavigator` | (sem caption própria) | `dsCadastro` | — | Botões visíveis: `Insert` (F3), `Delete` (F4, `ConfirmDelete=False` — confirmação é feita manualmente em `cdsCadastroBeforeDelete`), `Edit` (F5), `Post` (F6), `Cancel` (F7). Botões `First/Prior/Next/Last/PriorPage/NextPage/Refresh/SaveBookmark/GotoBookmark/Filter` todos com `Visible=False` — navegação acontece só pela grade. |
| `teDescricao` | `TcxTextEdit` | (grupo "Critérios de Seleção" → "Descrição") | filtro apenas (`LIKE`, case-insensitive) | Não | — |
| `cbTipoMorte` | `TcxComboBox` | (grupo "Tipo da Morte") | filtro apenas, sobre `TipoVal` | Não | 4 itens fixos, `DropDownListStyle=lsFixedList`, `ImmediatePost=True` (ver Conceito). |
| `btnConsulta` | `TcxButton` | "Consultar" | — | — | — |
| `btnExcel` | `TcxButton` | "Exportar" | — | — | Exporta a grade `gdCadastro` inteira via `ExportGrid4ToExcel`. |
| `btnAplicar` | `TcxButton` | "Aplicar" | — | — | **Permanentemente desabilitado (`Enabled=False`), sem `OnClick`** — funcionalidade não implementada. |

### 2.2 Grade de cadastro (`gdCadastroTabela`, sobre `cdsCadastro`)

| Coluna (`TcxGridDBColumn`) | Caption | Vinculado a (campo BD) | Obrigatório | Editável | Observações |
|---|---|---|---|---|---|
| `gdCadastroTabelaCodigo` | "Código" | `Codigo` (`TIntegerField`, PK) | Sim (gerado pelo sistema) | **Não** — `Properties.ReadOnly=True` e `Options.Editing=False`, estilo `dmITP.cxStyleDisable` (visualmente "acinzentado") | Somente leitura na grade porque o valor é atribuído automaticamente em `cdsCadastroBeforePost` via `LoadSequencia('Tabelas','Codigo','Tipo','180')` — nunca digitado pelo usuário. `PropertiesClassName=TcxCurrencyEditProperties`, `DisplayFormat='0'`/`EditFormat='0'` (sem casas decimais), `Nullable=False`, alinhado à direita. |
| `gdCadastroTabelaDescricao` | "Descrição" (herdado do nome do campo — sem `Caption` explícito no `.dfm`) | `Descricao` (`TStringField(200)`, `FixedChar=True`) | Sim — BR-001 | Sim | Coluna mais larga da grade (`Width=407`); é o campo padrão de foco ao inserir (`gdCadastroTabelaDescricao.FocusWithSelection` em `cdsCadastroBeforeInsert`). |
| `gdCadastroTabelaTipoVal` | "Tipo da Morte" | `TipoVal` (`TStringField(1)`, `FixedChar=True`) | Sim — BR-002 | Sim, via combo embutido na célula | `PropertiesClassName=TcxComboBoxProperties`, `DropDownListStyle=lsFixedList` (só aceita um dos 3 itens da lista), `ImmediatePost=True` (grava a seleção imediatamente ao trocar, sem esperar sair da célula). Itens: "NATURAL"/"ACIDENTAL"/"SACRIFÍCIO", mapeados para `N`/`A`/`S` pelo par `cdsCadastroTipoValGetText`/`SetText` (ver Conceito). |

Não há abas (`PageControl`) nesta tela — apenas os dois grupos acima (critérios de seleção +
grade única). Todos os controles editáveis do `.dfm` estão cobertos nas duas tabelas acima; não
há controles com `Visible=False` além dos botões do `TcxDBNavigator` já listados.

---

## 5) Jornada do usuário + Especificação funcional

### SP-01 — Abrir a tela (`FormShow`)
Aplica permissão de somente-leitura; executa consulta inicial sem filtros.

### SP-02 — Filtrar (`btnConsultaClick`)
`SELECT Codigo, Tipo, Descricao, TipoVal FROM Tabelas WHERE Tipo=180 [AND Descricao LIKE '%...%']
[AND TipoVal='N'/'A'/'S'] ORDER BY Codigo`.

### SP-03 — Incluir/Editar/Excluir na grade (navegador `dnNavega`, atalhos F3/F4/F5/F6/F7)

**Pseudocódigo fiel:**
```
ao inserir novo registro:
  focar a grade, coluna "Descrição" com seleção

ao gravar (Post):
  se Descricao (trim) = '': avisar "Indique a Descrição." e abortar
  se TipoVal é nulo: avisar "Selecione o Tipo da Morte." e abortar
  se é Inclusão:
    Codigo := LoadSequencia('Tabelas', 'Codigo', escopado por Tipo=180)
    Tipo := 180
  // ApplyUpdates via provider grava o INSERT/UPDATE real (dispara TU_TABELAS se Edição)
  CommitTransacaoTabelas(...)

ao excluir:
  confirmar "Deseja Realmente Excluir o Registro Selecionado?"
  se confirmado: prosseguir (dispara TD_TABELAS — sem regra específica para Tipo=180)
  senão: abortar
```

### SP-04 — Exportar para Excel (`btnExcelClick`)

### 5.3 Regras de negócio e validações

#### BR-001 — Descrição obrigatória
- **Mensagem:** "Indique a Descrição."

#### BR-002 — Tipo da Morte obrigatório
- **Mensagem:** "Selecione o Tipo da Morte."

#### BR-003 — Exclusão de Causa Mortis em uso não é bloqueada no banco
- **Achado:** ver `[[TD_TABELAS]]` — `Tipo=180` não tem bloco de validação de integridade
  referencial; mesma situação já documentada para `Tipo=222`/`Tipo=182`.

### 5.4 Cálculos e arredondamento

**Não há campo numérico de entrada nem fórmula de cálculo nesta tela.** Os únicos campos são
`Codigo` (inteiro, gerado por `LoadSequencia`, nunca digitado), `Descricao` (texto livre) e
`TipoVal` (código de 1 caractere escolhido em combo fixo). Não existe nenhuma chamada a
`RoundTo`/`SimpleRoundTo`/`Round`/`Trunc`/`FormatFloat` em `CausaMortis.pas`, e nenhum dos campos
aceita valor negativo (não há campo numérico livre — `Codigo` é somente leitura e sequencial).

---

## 6) Integrações e dados

### 6.1 Integrações (internas)

Nenhuma navegação para outras telas a partir daqui — cadastro autocontido. **Caminho de menu
confirmado** em `[[iniModuloPecuaria]]` (mapa `sReferencia`→Tela, seção 6.1): `sReferencia =
'CausaMortis'` abre esta tela diretamente (sem parâmetro de contexto).

**Consumidor confirmado:** `[[MorteAnimaisPec]]` — o campo `lcbCausa` (`TcxLookupComboBox`) dessa
tela é vinculado ao domínio `CausaMortis` (`Tabelas.Tipo=180`), gravando o `Codigo` selecionado em
`RegMortesPec`. Isso confirma o vínculo que antes estava marcado como não verificado nesta nota:
`RegMortesPec` é de fato a tabela de destino que referencia `Tabelas.Tipo=180` via essa tela
satélite.

### 6.2 Modelo de dados

**Tabela `Tabelas`** (genérica, `Tipo=180` = Causa Mortis):

| Coluna | Tipo (Delphi/inferido) | Papel nesta tela |
|---|---|---|
| `Codigo` | `TIntegerField` (persistente) — `int` (alta confiança) | Chave — gerada por `LoadSequencia` escopada por `Tipo`. |
| `Tipo` | `TIntegerField` (persistente) — `int` (alta confiança) | Fixado em `180` na inclusão. |
| `Descricao` | `TStringField` (persistente) — `varchar` (alta confiança) | Descrição da Causa Mortis. |
| `TipoVal` | `TStringField` (persistente, `GetText`/`SetText` customizados) — `char(1)` (alta confiança) | `N`/`A`/`S` — classificação Natural/Acidental/Sacrifício. |

### 6.3 Triggers e Procedures do banco

- **`[[TU_TABELAS]]`**/**`[[TD_TABELAS]]`** (genéricas, já documentadas) — sem regra específica
  para `Tipo=180`.
- `TI_TABELAS` (trigger de `INSERT`) **não existe** (confirmado em `[[ExportaDietas]]`).

---

## 7) Suporte: FAQ, mensagens, erros e troubleshooting

### 7.2 Catálogo de mensagens e erros

| Mensagem exata | Causa |
|---|---|
| "Indique a Descrição." | BR-001 |
| "Selecione o Tipo da Morte." | BR-002 |
| "Deseja Realmente Excluir o Registro Selecionado?" | Confirmação de exclusão |

---

## 9) Notas de revisão

- **2026-09-02** (auditoria de profundidade campo-a-campo)
  - **O que mudou:** releitura completa de `CausaMortis.pas`/`.dfm`. Dicionário de campos (seção 2)
    reescrito: antes a grade estava resumida em 1 linha só ("Grid `gdCadastroTabela` (colunas)");
    agora cada uma das 3 colunas (`Codigo`/`Descricao`/`TipoVal`) tem linha própria com classe,
    obrigatoriedade e observações — incluindo o motivo de `Codigo` ser somente-leitura na grade
    (`Properties.ReadOnly=True`/`Options.Editing=False`, valor atribuído por `LoadSequencia` em
    `BeforePost`) e os detalhes de formatação (`DisplayFormat='0'`, `ImmediatePost=True` no combo
    de `TipoVal`). Adicionado `dnNavega` (`TcxDBNavigator`), que não constava no dicionário —
    confirmados os botões visíveis/ocultos. Adicionada seção 5.4 declarando explicitamente que a
    tela **não tem** nenhum campo numérico de entrada nem fórmula de cálculo/arredondamento
    (`Codigo` é gerado, não digitado). Caminho de menu confirmado via `[[iniModuloPecuaria]]`
    (`sReferencia='CausaMortis'`, sem parâmetro de contexto) — antes constava como "não lido nesta
    sessão". Consumidor `RegMortesPec` confirmado via `[[MorteAnimaisPec]]` (campo `lcbCausa`),
    que já existe no vault e antes não era referenciado — a dúvida antiga sobre o vínculo com
    `Tabelas.Tipo=180` foi resolvida e removida do resumo executivo e da seção 6.1.
  - **Impacto:** nenhum no sistema (documentação apenas). Nenhuma regra de negócio nova encontrada
    — BR-001/BR-002/BR-003 confirmadas como já estavam. Gaps eram de profundidade/cross-reference,
    não de regra de negócio omitida.
  - **Referências:** código-fonte `Pecuaria/CausaMortis.pas` + `.dfm` (releitura integral);
    `[[iniModuloPecuaria]]`; `[[MorteAnimaisPec]]`.

- **2026-08-27** (criação da nota — módulo Pecuária)
  - **O que mudou:** nota criada do zero, a partir de leitura 100% literal de
    `Pecuaria/CausaMortis.pas` (228 linhas) + `.dfm` (título confirmado "Cadastro de Causa
    Mortis"). Documentado o cadastro de `Tabelas.Tipo=180` (Causa Mortis: Natural/Acidental/
    Sacrifício). Confirmada 3ª ocorrência do padrão "botão de ação permanentemente desabilitado
    sem handler" no módulo (`btnAplicar`, igual a `[[AvalCorporal]]`).
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** código-fonte `Pecuaria/CausaMortis.pas` + `.dfm`; ver `[[AvalCorporal]]`,
    `[[EscoresConsMetas]]`, `[[TU_TABELAS]]`, `[[TD_TABELAS]]`.
