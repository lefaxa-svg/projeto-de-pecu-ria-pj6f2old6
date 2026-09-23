> **Nota de método**: este documento descreve uma tela de um sistema LEGADO já em produção,
> reconstruída por engenharia reversa do código-fonte — não é uma especificação de feature nova
> obtida por entrevista com um PO. Por isso, toda seção que normalmente viria de uma conversa de
> negócio (motivação, métricas, objetivos) foi preenchida por **inferência a partir do
> comportamento do código**, e está marcada explicitamente como `(inferência)`. Onde nem o código
> nem o contexto do módulo permitem inferir nada com segurança, o campo está como `N/A`.
> Fonte: leitura 100% literal de `Pecuaria/ConfAvalCochos.pas` (429 linhas, unit
> `ConfAvalCochos`, classe `TfmConfAvalCochos`) e do `.dfm` correspondente (título confirmado
> "Escores de Leitura de Cocho"), nesta sessão — 42º arquivo `.pas` lido do módulo Pecuária.
> **Resolve a referência cruzada pendente** desde `[[ResumoLC]]`: esta é a tela de cadastro de
> `ConfAvalCochos` (configuração de critérios de avaliação de Leitura de Cocho, vigente por
> período por Fazenda), cuja estrutura já havia sido inferida naquela nota a partir do uso em SQL
> — agora confirmada campo a campo. Busca por `ConfAvalCochos` na pasta `scripts/triggers` não
> retornou nenhum resultado — tabela sem trigger. Ver nota de método completa (limitação de
> DDL/tipos de coluna) em `[[ExportaDietas]]`, válida para todo o módulo.

---

**Status da implementação:** Legado — em produção (documentado via engenharia reversa, sem item de trabalho associado)

**Owner (curadoria):** @jefferson.arantes
**Tags:** #Pecuaria #Cocho #LeituraCocho #ConfAvalCochos #Cadastro

---

## 0) Resumo executivo

- **O que é:** cadastro "Escores de Leitura de Cocho" — para uma Fazenda e Data de vigência,
  define até **6 "notas" possíveis** de leitura de cocho (0 a 5, campos `Nota`/`Nota0`..`Nota4`),
  cada uma com seu próprio Ajuste de fornecimento (`Ajuste`/`Ajuste0`..`4`), Atitude do animal ao
  cocho (texto), Padrão (`Padrao`, numérico), Critérios (texto) e um flag de Anomalia
  (`Anomalia`/checkbox) — mais um `TipoAjuste` de cabeçalho (Kg/Animal ou Percentual/Animal) que
  define como o Ajuste de cada nota deve ser interpretado.
- **Confirma a estrutura já inferida em `[[ResumoLC]]`** a partir do uso em SQL (5 notas +
  principal, cada uma com Ajuste/Atitude/Critérios/Padrão/Anomalia) — agora com os tipos de campo
  confirmados via componentes Delphi.
- **Impacto principal:** CRUD direto na tabela `ConfAvalCochos` (sem trigger).

---

## 1) Conceito

| Termo | Definição |
|-------|-----------|
| Validação em cascata: cada nota só é obrigatoriamente detalhada se foi preenchida | `cdsCadastroBeforePost`: para cada uma das 6 notas, só valida Ajuste/Atitude/Critérios **se o campo `Nota<n>` correspondente não for nulo** — ou seja, as 6 notas são todas opcionais como conjunto, mas uma vez que uma `Nota<n>` é informada, seus 3 campos de detalhamento tornam-se obrigatórios. |
| `Padrao` e `Anomalia` (checkbox) não são validados como obrigatórios em nenhuma nota | Achado: apenas `Ajuste`/`Atitude`/`Criterios` são checados por `IsNull` — `Padrao` e `Anomalia` podem ficar vazios mesmo quando a Nota está preenchida. |
| Validação usa 6 variáveis booleanas independentes, mas todas levam ao mesmo `Abort` | `teste`..`teste4`: cada uma rastreia se sua respectiva nota passou na validação — mas como `Abort` já interrompe a execução na primeira falha encontrada (uma exceção silenciosa `EAbort`), o bloco final `If (not teste) or ... then Abort` é código nunca alcançado na prática (mesma classe de achado já documentada em `[[CustosRetiros]]`: `Abort` sempre interrompe antes de qualquer checagem posterior no mesmo `begin...end`). |
| `TipoAjuste` usa o mesmo padrão de rótulo K/P já visto em `[[ResumoLC]]` | `cdsCadastroTipoAjusteGetText`/`SetText`: `'K'`↔"KG - MATERIAL / ANIMAL", `'P'`↔"PERCENTUAL / ANIMAL" — idêntico ao `CASE` já documentado na consulta de `[[ResumoLC]]`. |

---

## 2) Dicionário de campos da tela (`.dfm`)

| Controle | Classe | Rótulo/Caption | Vinculado a (campo BD) | Obrigatório | Observações |
|---|---|---|---|---|---|
| `lcbFazenda` | `TcxDBLookupComboBox` | (grupo "Fazenda") | `Fazenda` | Sim (BR-002) | Pré-selecionada com `_iUnidNegoc`; lista vem de `dmConsulta.cdsUnidNeg` recarregada no `FormShow` com SQL própria (`SELECT Sequencial Codigo, Descricao, Endereco Mascara FROM DetPessoas WHERE Pecuaria='S'`), não do dataset genérico de Fazendas usado por outras telas. |
| `deData` | `TcxDBDateEdit` | (grupo "Data") | `Data` | Sim (BR-001) | Data de vigência da configuração. |
| `cbTipoAjuste` | `TcxDBComboBox` | (grupo "Tipo de Ajuste") | `TipoAjuste` | Sim (BR-003) | `K`/`P`; itens fixos "KG - MATERIAL / ANIMAL"/"PERCENTUAL / ANIMAL", mapeados por `GetText`/`SetText` (ver Conceito). |
| `ceNota`/`ceNota0`..`ceNota4` | `TcxDBCurrencyEdit` | (grupo "Nota", em cada bloco "Primeira..Sexta Nota") | `Nota`/`Nota0`..`4` (`TIntegerField`) | Não (condicional, ver BR-004 a BR-009) | 6 slots de nota, um por `TcxGroupBox` ("Primeira Nota".."Sexta Nota"). Sem `DisplayFormat`/`EditFormat` explícito no `.dfm` (só `AssignedValues.DisplayFormat/EditFormat = True`, sem string associada) — usa o formato default do `TcxCurrencyEdit`, diferente dos campos `Ajuste`/`Padrao` abaixo que fixam `'0.000'`. |
| `ceAjuste`/`ceAjuste0`..`4` | `TcxDBCurrencyEdit` | (grupo "Ajuste") | `Ajuste`/`Ajuste0`..`4` (`TFloatField`) | Condicional | `DisplayFormat`/`EditFormat = '0.000'` (3 casas, só formatação de exibição — nenhum `RoundTo`/`Round`/`Trunc` é aplicado no código Delphi; o valor é gravado como o usuário digitar). Sem trava contra valor negativo (`TcxCurrencyEdit` sem `MinValue`) e sem checagem de sinal em `cdsCadastroBeforePost`. |
| `teAtitude`/`teAtitude0`..`4` | `TcxDBTextEdit` | (grupo "Atitude Adotada") | `Atitude`/`Atitude0`..`4` (`TStringField`, tamanho 100) | Condicional | — |
| `cePadrao`/`cePadrao0`..`4` | `TcxDBCurrencyEdit` | (grupo "Padrão Ideal") | `Padrao`/`Padrao0`..`4` (`TFloatField`) | Não | Sem validação de obrigatoriedade. Mesmo padrão de formatação de `Ajuste` (`'0.000'`, cosmético, sem arredondamento no código) e sem trava contra negativo. |
| `teCriterios`/`teCriterios1`..`4` | `TcxDBTextEdit` | (grupo "Critérios de Avaliação") | `Criterios`/`Criterios1`..`4` (`TStringField`, tamanho 200) | Condicional | — |
| `ceCriterios0` | `TcxDBTextEdit` | (grupo "Critérios de Avaliação" da "Segunda Nota") | `Criterios0` (`TStringField`, tamanho 200) | Condicional | **Inconsistência de nomenclatura no código-fonte**: apesar de ser exatamente o mesmo tipo de controle (`TcxDBTextEdit`) que `teCriterios`/`teCriterios1..4` nas outras 5 notas, o campo "Critérios" da Segunda Nota foi nomeado `ceCriterios0` (prefixo `ce`, normalmente reservado a `TcxDBCurrencyEdit` neste form) em vez de `teCriterios0` — provável erro de copiar/colar do desenvolvedor original; não afeta o comportamento, só a busca por nome no `.dfm`/`.pas`. |
| `chbAnomalia`/`chbAnomalia0`..`4` | `TcxDBCheckBox` | "Anomalia" | `Anomalia`/`Anomalia0`..`4` (`TStringField(1)`) | Não | Sem validação de obrigatoriedade. `ValueChecked='S'`/`ValueUnchecked='N'`, `NullStyle=nssUnchecked`. |
| `dnNavega` | `TcxDBNavigator` | — | — | — | Navegador CRUD padrão (Inserir F3/Excluir F4/Alterar F5/Salvar F6/Cancelar F7); `Buttons.ConfirmDelete=False` — a confirmação de exclusão é feita manualmente em `cdsCadastroBeforeDelete`, não pelo navegador. |

**Caminho de menu:** confirmado via `[[iniModuloPecuaria]]` — referência `EscoreLC` no mapa `sReferencia`→Tela aponta para esta tela (`ConfAvalCochos`). A nota anterior não documentava o caminho de acesso; corrigido nesta auditoria.

**Nota sobre arredondamento:** releitura confirma que nenhuma fórmula de cálculo existe nesta tela — `Ajuste`/`Padrao` (e seus 5 pares numerados) têm apenas `DisplayFormat`/`EditFormat = '0.000'` no `.dfm` (formatação de exibição/edição, 3 casas decimais), sem qualquer `RoundTo`/`SimpleRoundTo`/`Round`/`Trunc` no código Delphi (`cdsCadastroBeforePost` só faz checagem de `IsNull`, nunca manipula o valor numérico). Nenhum dos campos `Nota*`/`Ajuste*`/`Padrao*` tem trava contra valor negativo — nem `MinValue` no componente, nem checagem de sinal na validação.

---

## 5) Jornada do usuário + Especificação funcional

### SP-01 — Abrir a tela (`FormShow`)
Carrega Fazendas habilitadas ao módulo; pré-seleciona `_iUnidNegoc`; carrega todas as
configurações (`SELECT * FROM ConfAvalCochos ORDER BY Data`, sem filtro de Fazenda/período).

**Achado:** diferente de quase todas as outras telas de cadastro do módulo, esta não tem nenhum
filtro de consulta (botão "Consultar", campos de busca) — carrega **todos** os registros da
tabela de uma vez, sempre.

### SP-02 — Incluir/Editar/Excluir na grade (navegador `dnNavega`)

**Pseudocódigo fiel:**
```
ao gravar (Post):
  para cada Nota<n> (0 a 5) preenchida:
    se Ajuste<n> nulo: avisar "Indique o Ajuste da <ordinal> nota." e abortar
    senão se Atitude<n> nula: avisar "Indique a atitude da <ordinal> nota." e abortar
    senão se Criterios<n> nulo: avisar "Indique os critérios da <ordinal> nota." e abortar
  se Data nula: avisar "Indique a Data." e abortar
  senão se Fazenda nula: avisar "Indique a fazenda." e abortar
  senão se TipoAjuste nulo: avisar "Indique o tipo de ajuste." e abortar
  senão se é Inclusão:
    Sequencial := LoadSequencia('ConfAvalCochos', 'Sequencial')
  // ApplyUpdates via provider grava o INSERT/UPDATE real (sem trigger)
  CommitTransacaoTabelas(...)

ao excluir:
  confirmar "Deseja Realmente Excluir o Registro Selecionado?"
  se confirmado: prosseguir
  senão: abortar
```

### 5.3 Regras de negócio e validações

#### BR-001 — Data obrigatória
- **Mensagem:** "Indique a Data."

#### BR-002 — Fazenda obrigatória
- **Mensagem:** "Indique a fazenda."

#### BR-003 — Tipo de Ajuste obrigatório
- **Mensagem:** "Indique o tipo de ajuste."

#### BR-004 a BR-009 — Ajuste/Atitude/Critérios obrigatórios para cada Nota preenchida
- **Mensagens:** "Indique o Ajuste da <primeira..sexta> nota." / "Indique a atitude da <...>
  nota." / "Indique os critérios da <...> nota." (nota: erro de digitação "critérios" grafado
  "crit​érios"/"crit​érrios" de forma inconsistente entre as 6 mensagens no texto original).

#### BR-010 — Sem validação de duplicidade de Data/Fazenda
- **Achado:** é possível cadastrar 2 configurações para a mesma Fazenda na mesma Data — a lógica
  de "vigência" em `[[ResumoLC]]` (próxima configuração menos 1 dia) assume implicitamente que
  não há duplicidade, mas nada impede isso no cadastro.

---

## 6) Integrações e dados

### 6.1 Integrações (internas)

- Consumida por **`[[ResumoLC]]`** (relatório de distribuição de leituras de cocho) e
  presumivelmente pela view `vwLeiturasCocho` (usada em `[[LancAjustesLC]]`/`[[EdTratosLC]]`),
  ainda não confirmada por leitura direta da view.

### 6.2 Modelo de dados

**Tabela `ConfAvalCochos`** (própria):

| Coluna | Tipo (Delphi/inferido) | Papel nesta tela |
|---|---|---|
| `Sequencial` | `TIntegerField` (persistente) — `int` (alta confiança) | Chave — gerada por `LoadSequencia`. |
| `Data` | `TSQLTimeStampField` (persistente) — `datetime` (alta confiança) | Data de vigência. |
| `Fazenda` | `TIntegerField` (persistente) — `int` (alta confiança) | FK para a Fazenda. |
| `TipoAjuste` | `TStringField` (persistente, `GetText`/`SetText` customizados) — `char(1)` (alta confiança) | `K`/`P`. |
| `Nota`, `Nota0`..`Nota4` | `TIntegerField` (persistente) — `int` (alta confiança) | 6 slots de nota/escore de leitura de cocho. |
| `Ajuste`, `Ajuste0`..`Ajuste4` | `TFloatField` (persistente) — `float`/`real` (alta confiança) | Ajuste de fornecimento associado a cada nota. |
| `Atitude`, `Atitude0`..`Atitude4` | `TStringField` (persistente) — `varchar` (alta confiança) | Descrição da atitude do animal ao cocho. |
| `Padrao`, `Padrao0`..`Padrao4` | `TFloatField` (persistente) — `float`/`real` (alta confiança) | Sem validação de obrigatoriedade. |
| `Criterios`, `Criterios0`..`Criterios4` | `TStringField` (persistente) — `varchar` (alta confiança) | Critérios de avaliação da nota. |
| `Anomalia`, `Anomalia0`..`Anomalia4` | `TStringField` (persistente, checkbox) — `char(1)` (alta confiança) | Flag de nota "anômala"/fora do esperado. |

### 6.3 Triggers e Procedures do banco

**Nenhuma.** Busca por `ConfAvalCochos` na pasta `scripts/triggers` não retornou nenhum resultado.

---

## 7) Suporte: FAQ, mensagens, erros e troubleshooting

### 7.2 Catálogo de mensagens e erros

| Mensagem exata | Causa |
|---|---|
| "Indique a Data." | BR-001 |
| "Indique a fazenda." | BR-002 |
| "Indique o tipo de ajuste." | BR-003 |
| "Indique o Ajuste/a atitude/os critérios da <ordinal> nota." | BR-004 a BR-009 |
| "Deseja Realmente Excluir o Registro Selecionado?" | Confirmação de exclusão |

---

## 9) Notas de revisão

- **2026-09-02** (auditoria de profundidade campo-a-campo — módulo Pecuária)
  - **O que mudou:** releitura completa de `.pas` (429 linhas) e `.dfm` (1545 linhas). Gaps reais
    encontrados e corrigidos na seção 2: caminho de menu não estava documentado — confirmado via
    `[[iniModuloPecuaria]]` (referência `EscoreLC`); identificada inconsistência de nomenclatura
    no `.dfm` — o campo "Critérios" da Segunda Nota é `ceCriterios0` (prefixo `ce`, de
    `TcxDBCurrencyEdit`) em vez de `teCriterios0` (padrão das outras 5 notas), apesar de ser um
    `TcxDBTextEdit` idêntico — provável erro de copiar/colar do desenvolvedor original;
    confirmado explicitamente que `Ajuste`/`Padrao` usam `DisplayFormat='0.000'` apenas como
    formatação cosmética (sem `RoundTo`/`Round`/`Trunc` no código) e que nenhum campo numérico
    tem trava contra valor negativo; origem específica da lista de `lcbFazenda` (SQL própria
    filtrando `DetPessoas.Pecuaria='S'`) detalhada.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** releitura de `Pecuaria/ConfAvalCochos.pas` + `.dfm`; `[[iniModuloPecuaria]]`.

- **2026-08-28** (criação da nota — módulo Pecuária)
  - **O que mudou:** nota criada do zero, a partir de leitura 100% literal de
    `Pecuaria/ConfAvalCochos.pas` (429 linhas) + `.dfm` (título confirmado "Escores de Leitura de
    Cocho"). **Resolve a referência cruzada pendente** desde `[[ResumoLC]]`, confirmando campo a
    campo a estrutura de `ConfAvalCochos` já inferida por uso em SQL. Achados: `Padrao`/
    `Anomalia` sem validação; `Abort` torna o bloco de checagem final código morto (mesmo padrão
    de `[[CustosRetiros]]`); sem filtro de consulta na tela (carrega tudo); sem validação de
    duplicidade Data/Fazenda.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** código-fonte `Pecuaria/ConfAvalCochos.pas` + `.dfm`; ver `[[ResumoLC]]`,
    `[[LancAjustesLC]]`, `[[EdTratosLC]]`, `[[CustosRetiros]]`.
