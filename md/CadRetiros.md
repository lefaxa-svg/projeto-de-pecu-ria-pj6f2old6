> **Nota de método**: este documento descreve uma tela de um sistema LEGADO já em produção,
> reconstruída por engenharia reversa do código-fonte — não é uma especificação de feature nova
> obtida por entrevista com um PO. Por isso, toda seção que normalmente viria de uma conversa de
> negócio (motivação, métricas, objetivos) foi preenchida por **inferência a partir do
> comportamento do código**, e está marcada explicitamente como `(inferência)`. Onde nem o código
> nem o contexto do módulo permitem inferir nada com segurança, o campo está como `N/A`.
> Fonte: leitura 100% literal de `Pecuaria/CadRetiros.pas` (382 linhas, unit `CadRetiros`, classe
> `TfmCadRetiros`) e do `.dfm` correspondente (título confirmado "Cadastro de Retiros"), nesta
> sessão — 36º arquivo `.pas` lido do módulo Pecuária. **Esta é a tela de cadastro central da
> tabela `Retiros`** — a unidade organizacional mais referenciada de todo o módulo (praticamente
> toda nota anterior cita `Retiro` como escopo). Busca por `Retiros` na pasta `scripts/triggers`
> não retornou nenhum resultado — tabela sem trigger. Ver nota de método completa (limitação de
> DDL/tipos de coluna) em `[[ExportaDietas]]`, válida para todo o módulo.

---

**Status da implementação:** Legado — em produção (documentado via engenharia reversa, sem item de trabalho associado)

**Owner (curadoria):** @jefferson.arantes
**Tags:** #Pecuaria #Retiro #Cadastro #Fazenda #Capataz

---

## 0) Resumo executivo

- **O que é:** cadastro em grade "Cadastro de Retiros" — registros da tabela própria `Retiros`
  (a unidade organizacional central do módulo, usada como escopo por praticamente toda tela já
  documentada), com Fazenda, Descrição, Área Total, % de Área Reservada, Área de Curral, um
  Capataz responsável (FK para `Pessoas`), Tipo (Confinamento/Pecuária Extensiva) e 4 códigos
  regulatórios/fiscais (`CCM`, `NIRF`, `INCRA`, `ERAS`).
- **`QtdUnidOcup` é somente-leitura nesta tela**: sempre fixado em `0` na inclusão
  (`cdsCadastroBeforePost`) — o contador real de Unidades de Ocupação é mantido por
  `[[TIU_UnidOcupacao]]` (já documentada), não por esta tela.
- **Impacto principal:** CRUD direto na tabela `Retiros` (sem trigger).
- **Caminho de menu (confirmado, auditoria 2026-09-02):** `Pecuaria/iniModuloPecuaria.pas`,
  item de menu com `sReferencia = 'CadRetiros'` — cria `TfmCadRetiros` e chama `ShowModal`
  diretamente, sem setar nenhuma propriedade pública (`iCodigo`/`iTipo`) antes de abrir, ao
  contrário de outras telas do módulo (ex. `[[CadRaca]]`, que seta `iTipo` antes do `ShowModal`).

---

## 1) Conceito

| Termo | Definição |
|-------|-----------|
| "Tipo" distingue Confinamento de Pecuária Extensiva — mesma dicotomia central do módulo | `cdsCadastroTipoGetText`/`SetText`: `'C'`↔"CONFINAMENTO", `'E'`↔"PECUÁRIA EXTENSIVA" — esse campo provavelmente determina qual conjunto de funcionalidades do módulo se aplica a cada Retiro (a maioria das telas já documentadas assume contexto de confinamento — trato, GPD, cocho — mas nenhuma unit vista até agora filtra explicitamente por `Retiros.Tipo`). |
| Existem 2 campos de "Capataz" com propósitos diferentes | `ceCapataz` (filtro de consulta, com "..::TODOS::.." como padrão) e a coluna "Capataz" da grade (`gdCadastroViewTabelaBandCapataz`, editável por linha) — ambos usam o mesmo padrão de busca F2/`BuscaPessoa`, mas um filtra a consulta e o outro grava o Capataz do Retiro. |
| Mensagens de validação têm nomes trocados em relação aos campos reais | `cdsCadastroBeforePost`: a validação de `AreaCurral` (campo real) usa a mensagem "Selecione a área **cultura**." — nome de campo desalinhado com o rótulo real da coluna ("Área Curral" no grid) — achado de inconsistência de nomenclatura. |
| Existe um handler `ceCapatazExit` inteiramente comentado (código morto) | Corpo inteiro dentro de `{ ... }` — resíduo de uma versão anterior da lógica de exibição do nome do Capataz filtro, substituída por `ceCapatazPropertiesEditValueChanged` (que tem a mesma função, ativa). |
| Rastreamento de foco de grade via `Enter`/`Exit` do GroupBox pai | `cxGroupBox1Enter`/`Exit`: `gdCadastro.Tag := 1`/`0` — mecanismo para saber se o foco está "dentro" da área da grade, usado por outra lógica não visível nesta unit (o `Tag` não é lido em nenhum outro ponto desta unit — possivelmente lido por uma classe base `TFormBase`, não capturável nesta leitura). |
| **Sem arredondamento e sem bloqueio de valor negativo nos campos numéricos de área/percentual (auditoria 2026-09-02)** | Releitura completa do `.pas` confirma: não há `RoundTo`/`SimpleRoundTo`/`Round`/`Trunc`/`FormatFloat` em nenhum ponto do código (nenhuma fórmula calculada — `AreaTotal`, `AreaCurral`, `PercAreaReservada` são digitados diretamente pelo usuário, sem cálculo derivado). O que existe é só **máscara de exibição** (`DisplayFormat`/`EditFormat = ',0.00;(,0.00)'` no `.dfm`, 2 casas decimais, negativo entre parênteses) — puramente visual, não arredonda o valor armazenado. `cdsCadastroBeforePost` valida apenas `IsNull` nesses 3 campos (BR-003/004/005) — **não valida sinal nem faixa**, então um valor negativo digitado é aceito e gravado sem aviso. Para `Capataz` (grid e filtro), `DecimalPlaces=0` e a validação `Capataz < 1` (BR-002) acaba bloqueando indiretamente valores negativos (e zero) — mas por checar limite mínimo, não por checar sinal explicitamente. |

---

## 2) Dicionário de campos da tela (`.dfm`)

> Auditoria de profundidade (2026-09-02): tabela reescrita para listar cada controle/coluna
> individualmente (inclusive `lblCapataz` e `dnNavega`, ausentes na versão anterior, e as 8
> colunas do grid banded, antes agrupadas em uma única linha). Ver item 9 para o resumo do que
> mudou.

### 2.1 Grupo "Fazenda" (filtro de escopo)

| Controle | Classe | Rótulo/Caption | Vinculado a (campo BD) | Obrigatório | Observações |
|---|---|---|---|---|---|
| `lcbDetPessoas` | `TcxLookupComboBox` | (grupo "Fazenda", sem rótulo próprio) | escopo obrigatório da consulta (`Fazenda`, via `dmConsulta.cdsUnidNeg`) | Sim (implícito — sem seleção `> 0`, `btnConsultaClick` não executa) | `Properties.ImmediatePost = True` + `OnEditValueChanged = lcbDetPessoasPropertiesEditValueChanged` — troca dispara `btnConsultaClick` automaticamente; pré-carregado com `_iUnidNegoc` no `FormShow`; lista restrita a `detpessoas` com `Pecuaria = 'S'`. |

### 2.2 Grupo "Critérios de Seleção" (filtros adicionais)

| Controle | Classe | Rótulo/Caption | Vinculado a (campo BD) | Obrigatório | Observações |
|---|---|---|---|---|---|
| `teDescricao` | `TcxTextEdit` | (grupo "Descrição") | filtro apenas, sobre `Descricao` (LIKE) | Não | — |
| `ceCapataz` | `TcxCurrencyEdit` | (grupo "Capataz") | filtro apenas, sobre `Capataz` (=) | Não | `DecimalPlaces=0`, `Nullable=False` (`NullString='0'`); valor `0` = sem filtro; busca por F2 (`ceCapatazKeyDown` → `EdDispAjudaPessoa`). |
| `lblCapataz` | `TcxLabel` | (grupo "Capataz", ao lado de `ceCapataz`) | **não vinculado a campo BD** — só exibição | Não | Mostra o nome do Capataz filtrado, ou `"..::TODOS::.."` se `ceCapataz.Value = 0`; atualizado por `ceCapatazPropertiesEditValueChanged` (via `Properties.OnEditValueChanged`). O handler `OnExit` (`ceCapatazExit`) que também atualizaria esse label está com o corpo inteiro comentado — código morto, não executa nada (ver item 1). Faltava no dicionário anterior. |
| `btnConsulta` | `TcxButton` | "Consultar" | — | — | Dispara `SP-02`. |
| `btnExcel` | `TcxButton` | "Exportar" | — | — | Exporta o grid para Excel via `ExportGrid4ToExcel`. |

### 2.3 Navegação

| Controle | Classe | Rótulo/Caption | Vinculado a (campo BD) | Obrigatório | Observações |
|---|---|---|---|---|---|
| `dnNavega` | `TcxDBNavigator` | — | — | — | Faltava no dicionário anterior. Só 5 botões visíveis: Inserir (F3), Excluir (F4), Alterar (F5), Salvar (F6), Cancelar (F7); todos os demais (`First`, `Prior`, `Next`, `Last`, `Refresh`, `Filter`, `SaveBookmark`, `GotoBookmark`, `PriorPage`, `NextPage`) estão com `Visible = False`. `Buttons.ConfirmDelete = False` — a confirmação de exclusão é feita manualmente em `cdsCadastroBeforeDelete` (`MessageDlg`), não pelo navigator. |

### 2.4 Grid "Retiros" (`gdCadastroViewTabelaBand`, `TcxGridDBBandedTableView`)

3 bandas: Banda 0 (sem `Caption`, `Width=489`) agrupa Descrição/Capataz/Nome/Tipo; Banda 1
(`Caption='Área'`, `Width=272`) agrupa Total/Curral/Reservada; Banda 2 (sem `Caption`,
`Width=102`) contém só Qtd. U.O. **Achado de posicionamento:** a coluna `Tipo` tem
`Position.BandIndex = 0` e `ColIndex = 3` — ela pertence à **1ª banda** (a mesma de
Descrição/Capataz/Nome), não a uma banda própria; a versão anterior da nota não deixava isso
explícito.

| Controle (coluna) | Classe | Rótulo/Caption | Vinculado a (campo BD) | Obrigatório | Observações |
|---|---|---|---|---|---|
| `gdCadastroViewTabelaBandDescricao` | `TcxGridDBBandedColumn` (`TcxTextEditProperties`) | "Descrição" | `Descricao` | Sim (BR-001) | Banda 0, `ColIndex=0`. Recebe foco automaticamente na inclusão (`cdsCadastroBeforeInsert` → `FocusWithSelection`). |
| `gdCadastroViewTabelaBandCapataz` | `TcxGridDBBandedColumn` (`TcxCurrencyEditProperties`) | "Cód." | `Capataz` | Sim (BR-002) | Banda 0, `ColIndex=1`. `DecimalPlaces=0`, `DisplayFormat`/`EditFormat = '0;(0)'` (negativo seria exibido entre parênteses), `Nullable=False` (`NullString='0'`); F2 abre busca de pessoa (`gdCadastroViewTabelaBandEditKeyDown` → `dbDispAjudaPessoa`); ao trocar, `OnEditValueChanged` (`gdCadastroViewTabelaBandCapatazPropertiesEditValueChanged`) busca e grava `Nome`, ou exibe "Código do Funcionário Inválido!" se não encontrado. |
| `gdCadastroViewTabelaBandNome` | `TcxGridDBBandedColumn` (`TcxTextEditProperties`) | "Capataz" | `Nome` | Não (auto-preenchido) | Banda 0, `ColIndex=2`. **`Options.Editing=False` e `Options.Focusing=False`** — somente leitura, com `Styles.Content = dmITP.cxStyleDisable` (estilo visual de campo desabilitado); preenchido só a partir do código digitado em `Capataz`. |
| `gdCadastroViewTabelaBandTipo` | `TcxGridDBBandedColumn` (`TcxComboBoxProperties`) | (sem `Caption` — cabeçalho da coluna fica em branco) | `Tipo` | Sim (BR-006) | Banda 0, `ColIndex=3`. `Properties.DropDownListStyle = lsFixedList`, `ImmediatePost=True`, 2 itens fixos ("CONFINAMENTO"/"PECUÁRIA EXTENSIVA"); `OnGetText`/`OnSetText` do `TField` convertem para `'C'`/`'E'` internamente. |
| `gdCadastroViewTabelaBandAreaTotal` | `TcxGridDBBandedColumn` (`TcxCurrencyEditProperties`) | "Total (ha)" | `AreaTotal` | Sim (BR-003) | Banda 1 ("Área"), `ColIndex=0`. `DisplayFormat`/`EditFormat = ',0.00;(,0.00)'` — 2 casas decimais, negativo entre parênteses; `Nullable=False` (`NullString='0.00'`). Ver item 1 sobre ausência de bloqueio real de valor negativo. |
| `gdCadastroViewTabelaBandAreaCultura` | `TcxGridDBBandedColumn` (`TcxCurrencyEditProperties`) | "Curral (ha)" | `AreaCurral` | Sim (BR-004, mensagem com nome de campo trocado) | Banda 1 ("Área"), `ColIndex=1`. Mesma máscara `,0.00;(,0.00)` e mesma observação sobre negativo. |
| `gdCadastroViewTabelaBandPercAreaReservada` | `TcxGridDBBandedColumn` (`TcxCurrencyEditProperties`) | "Reservada (%)" | `PercAreaReservada` | Sim (BR-005) | Banda 1 ("Área"), `ColIndex=2`. Mesma máscara `,0.00;(,0.00)`; sem validação de faixa 0–100 (aceita, por exemplo, 250 ou valor negativo — ver item 1). |
| `gdCadastroViewTabelaBandQtdUnidOcup` | `TcxGridDBBandedColumn` (sem `PropertiesClassName` customizada) | "Qtd. U.O." | `QtdUnidOcup` | Não (somente leitura) | Banda 2, `ColIndex=0`. `Options.Editing=False` e `Options.Focusing=False`; mantido por `[[TIU_UnidOcupacao]]`, fixado em `0` nesta tela na inclusão (`cdsCadastroBeforePost`). |

### 2.5 Grupos de códigos regulatórios/fiscais

| Controle | Classe | Rótulo/Caption | Vinculado a (campo BD) | Obrigatório | Observações |
|---|---|---|---|---|---|
| `teCCM` | `TcxDBTextEdit` | (grupo "C. C. M.") | `CCM` | Não | Ligado direto a `dsCadastro` (edita o registro focado no grid, não é filtro). Sem validação de formato; `TStringField` sem `Size` explícito no `.dfm` (default do driver — não confirmável só pelo código). |
| `teNIRF` | `TcxDBTextEdit` | (grupo "NIRF") | `NIRF` | Não | Idem — sem validação de formato, sem `Size` explícito. |
| `teINCRA` | `TcxDBTextEdit` | (grupo "INCRA") | `INCRA` | Não | Idem — sem validação de formato, sem `Size` explícito. |
| `teEras` | `TcxDBTextEdit` | (grupo "ERAS") | `ERAS` | Não | Idem — sem validação de formato; `Size=50` explícito no `.dfm` (único dos 4 com tamanho declarado). |

---

## 5) Jornada do usuário + Especificação funcional

### SP-01 — Abrir a tela (`FormShow`)
Aplica permissão de somente-leitura; carrega Fazendas habilitadas ao módulo; pré-seleciona
`_iUnidNegoc`; inicializa o rótulo do filtro de Capataz; executa consulta inicial.

### SP-02 — Filtrar (`btnConsultaClick`)
```
SELECT R.Sequencial, R.Fazenda, R.Descricao, R.AreaTotal, R.PercAreaReservada, R.AreaCurral,
       R.QtdUnidOcup, R.Capataz, P.Nome, R.Tipo, R.CCM, R.NIRF, R.INCRA, R.ERAS
FROM Retiros R JOIN Pessoas P ON R.Capataz = P.Codigo
WHERE Fazenda = <lcbDetPessoas>
[AND Upper(R.Descricao) LIKE Upper('%...%')]
[AND R.Capataz = <ceCapataz>]
ORDER BY Descricao
```
Só executa se `lcbDetPessoas.EditValue > 0`.

### SP-03 — Incluir/Editar/Excluir na grade (navegador `dnNavega`, atalhos F3/F4/F5/F6/F7)

**Pseudocódigo fiel:**
```
ao inserir novo registro:
  focar a grade, coluna "Descrição" com seleção

ao trocar o Capataz na grade:
  se Capataz > 0: buscar e exibir Nome via BuscaPessoa; se não encontrado, avisar "Código do
    Funcionário Inválido!"
  senão: limpar Nome

ao gravar (Post):
  se Descricao (trim) = '': avisar "Indique a Descrição." e abortar
  senão se Capataz < 1: avisar "Indique o capataz." e abortar
  senão se AreaTotal nula: avisar "Selecione a área total." e abortar
  senão se AreaCurral nula: avisar "Selecione a área cultura." e abortar (nome de campo trocado —
    ver Conceito)
  senão se PercAreaReservada nulo: avisar "Selecione o percentual de área reservada." e abortar
  senão se Tipo nulo: avisar "Selecione um tipo." e abortar
  senão se é Inclusão:
    Sequencial := LoadSequencia('Retiros', 'Sequencial')
    Fazenda := lcbDetPessoas.EditValue
    QtdUnidOcup := 0
  // ApplyUpdates via provider grava o INSERT/UPDATE real (sem trigger)
  CommitTransacaoTabelas(...)

ao excluir:
  confirmar "Deseja Realmente Excluir o Registro Selecionado?"
  se confirmado: prosseguir
  senão: abortar
```

### SP-04 — Exportar para Excel (`btnExcelClick`)

### 5.3 Regras de negócio e validações

#### BR-001 — Descrição obrigatória
- **Mensagem:** "Indique a Descrição."

#### BR-002 — Capataz obrigatório
- **Mensagem:** "Indique o capataz."

#### BR-003 — Área Total obrigatória
- **Mensagem:** "Selecione a área total."

#### BR-004 — Área Curral obrigatória
- **Mensagem:** "Selecione a área cultura." (nota: mensagem referencia "cultura", mas o campo real é `AreaCurral`)

#### BR-005 — Percentual de Área Reservada obrigatório
- **Mensagem:** "Selecione o percentual de área reservada."

#### BR-006 — Tipo (Confinamento/Extensiva) obrigatório
- **Mensagem:** "Selecione um tipo."

#### BR-007 — Sem validação de duplicidade de Descrição por Fazenda
- **Achado:** é possível cadastrar 2 Retiros com a mesma Descrição na mesma Fazenda.

#### BR-008 — Exclusão de Retiro em uso não é bloqueada nesta unit
- **Achado:** nenhuma checagem de dependências (Lotes, SubGrupos, movimentos) antes de excluir um
  Retiro — não é possível confirmar se há proteção em outra camada sem mais contexto.

#### BR-009 — Sem bloqueio de valor negativo em `AreaTotal`/`AreaCurral`/`PercAreaReservada` (achado, auditoria 2026-09-02)
- **Achado:** `cdsCadastroBeforePost` só valida `IsNull` nesses 3 campos; não há checagem de sinal
  nem de faixa (ex.: `PercAreaReservada` aceita valores fora de 0–100, incluindo negativos). Sem
  `RoundTo`/`Round`/`Trunc` em qualquer ponto do código — os campos são gravados com o valor
  digitado, só com máscara de exibição de 2 casas decimais (`DisplayFormat`/`EditFormat` no
  `.dfm`), sem arredondamento real. Ver item 1 (Conceito).

---

## 6) Integrações e dados

### 6.1 Integrações (internas)

- **`Pessoas`** — via `Capataz`.
- **`[[TIU_UnidOcupacao]]`** — mantém `QtdUnidOcup` atualizado (não esta tela).
- Consumida por praticamente todas as telas do módulo já documentadas (via `Retiros.Sequencial`
  como escopo de Fazenda/Retiro).

### 6.2 Modelo de dados

**Tabela `Retiros`** (própria, central):

| Coluna | Tipo (Delphi/inferido) | Papel nesta tela |
|---|---|---|
| `Sequencial` | `TIntegerField` (persistente) — `int` (alta confiança) | Chave — gerada por `LoadSequencia`. |
| `Fazenda` | `TIntegerField` (persistente) — `int` (alta confiança) | FK para a Fazenda (Unidade de Negócio). |
| `Descricao` | `TStringField` (persistente) — `varchar` (alta confiança) | Nome do Retiro. |
| `AreaTotal` | `TFloatField` (persistente) — `float`/`real` (alta confiança) | Área total, sem unidade explícita no código (provavelmente hectares, `(inferência)`). |
| `PercAreaReservada` | `TFloatField` (persistente) — `float`/`real` (alta confiança) | Percentual de área de reserva legal/ambiental `(inferência)`. |
| `AreaCurral` | `TFloatField` (persistente) — `float`/`real` (alta confiança) | Área ocupada por currais/instalações. |
| `QtdUnidOcup` | `TIntegerField` (persistente) — `int` (alta confiança) | Contador mantido por `[[TIU_UnidOcupacao]]`, fixado em `0` nesta tela na inclusão. |
| `Capataz` | `TIntegerField` (persistente) — `int` (alta confiança) | FK para `Pessoas.Codigo`. |
| `Tipo` | `TStringField` (persistente, `GetText`/`SetText` customizados) — `char(1)` (alta confiança) | `C`/`E` — Confinamento/Pecuária Extensiva. |
| `CCM`/`NIRF`/`INCRA`/`ERAS` | `TStringField` (persistente) — `varchar` (alta confiança) | Códigos regulatórios/fiscais, sem validação de formato — CCM (Cadastro de Contribuinte Mobiliário), NIRF, INCRA e ERAS são siglas de registros fundiários/fiscais brasileiros `(inferência sobre o significado das siglas, não confirmável só pelo código)`. |

### 6.3 Triggers e Procedures do banco

**Nenhuma.** Busca por `Retiros` na pasta `scripts/triggers` não retornou nenhum resultado.

---

## 7) Suporte: FAQ, mensagens, erros e troubleshooting

### 7.2 Catálogo de mensagens e erros

| Mensagem exata | Causa |
|---|---|
| "Indique a Descrição." | BR-001 |
| "Indique o capataz." | BR-002 |
| "Selecione a área total." | BR-003 |
| "Selecione a área cultura." | BR-004 |
| "Selecione o percentual de área reservada." | BR-005 |
| "Selecione um tipo." | BR-006 |
| "Código do Funcionário Inválido!" / "Funcionario Inexistente!" | Busca de Capataz sem correspondência |
| "Deseja Realmente Excluir o Registro Selecionado?" | Confirmação de exclusão |

---

## 9) Notas de revisão

- **2026-09-02** (auditoria de profundidade nível-campo — pós-achados do módulo Algodoeira)
  - **O que mudou:** releitura 100% literal de `Pecuaria/CadRetiros.pas` (382 linhas) e
    `CadRetiros.dfm` diretamente do código-fonte (não confiando na nota anterior). Gaps reais
    encontrados e corrigidos:
    1. **Dicionário de campos incompleto (item 2):** a tabela anterior agrupava as 8 colunas do
       grid banded (`gdCadastroViewTabelaBand`) em uma única linha — reescrita com uma linha por
       coluna, incluindo detalhes de banda/posição, máscaras de formato e comportamento
       `Options.Editing=False`/`Options.Focusing=False` de `Nome` e `QtdUnidOcup`. Também
       faltavam por completo `lblCapataz` (label de exibição do filtro, sem campo BD associado)
       e `dnNavega` (navigator, com botões F3–F7 e os demais ocultos) — ambos adicionados.
    2. **Posicionamento de banda do grid corrigido:** a coluna `Tipo` pertence à 1ª banda
       (`BandIndex=0`), junto com Descrição/Capataz/Nome, não a uma banda própria — não estava
       claro na versão anterior.
    3. **Ausência de arredondamento e de bloqueio de valor negativo (item b da auditoria):**
       confirmado que não há `RoundTo`/`SimpleRoundTo`/`Round`/`Trunc`/`FormatFloat` em nenhum
       ponto do `.pas` — os campos de área/percentual não têm fórmula calculada, e a única
       "formatação" é a máscara visual `,0.00;(,0.00)` do `.dfm`. `cdsCadastroBeforePost` só
       valida `IsNull` em `AreaTotal`/`AreaCurral`/`PercAreaReservada`, não valida sinal nem
       faixa — registrado como achado novo (BR-009), já que a nota anterior não mencionava esse
       aspecto.
    4. **Caminho de menu confirmado:** `sReferencia = 'CadRetiros'` em
       `Pecuaria/iniModuloPecuaria.pas`, sem parâmetros extras antes do `ShowModal` — adicionado
       ao Resumo Executivo.
    5. **Satélites:** nenhum satélite listado como "não processado" foi encontrado nesta nota —
       a única dependência externa (`[[TIU_UnidOcupacao]]`) já estava correta e já existe no
       vault; nenhuma correção de referência cruzada necessária.
  - **O que já estava correto e foi apenas confirmado:** BR-001/002/003/005/006/007/008, o
    achado de nome de campo trocado em BR-004, o código morto em `ceCapatazExit`, a tabela
    `Retiros` sem triggers, e o mapeamento completo `Tipo` (`C`/`E`).
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** código-fonte `Pecuaria/CadRetiros.pas` + `.dfm`;
    `Pecuaria/iniModuloPecuaria.pas`; `pecuaria/iniModuloPecuaria.md`; ver `[[TIU_UnidOcupacao]]`.

- **2026-08-28** (criação da nota — módulo Pecuária)
  - **O que mudou:** nota criada do zero, a partir de leitura 100% literal de
    `Pecuaria/CadRetiros.pas` (382 linhas) + `.dfm` (título confirmado "Cadastro de Retiros").
    Documentado o cadastro central de `Retiros`, incluindo o campo `Tipo`
    (Confinamento/Pecuária Extensiva) que provavelmente segmenta o uso do módulo. Achados:
    mensagem de validação com nome de campo trocado (BR-004); `QtdUnidOcup` mantido por
    `[[TIU_UnidOcupacao]]`, não por esta tela; sem validação de duplicidade ou proteção de
    exclusão.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** código-fonte `Pecuaria/CadRetiros.pas` + `.dfm`; ver `[[TIU_UnidOcupacao]]`.
