> **Nota de método**: este documento descreve uma tela de um sistema LEGADO já em produção,
> reconstruída por engenharia reversa do código-fonte — não é uma especificação de feature nova
> obtida por entrevista com um PO. Por isso, toda seção que normalmente viria de uma conversa de
> negócio (motivação, métricas, objetivos) foi preenchida por **inferência a partir do
> comportamento do código**, e está marcada explicitamente como `(inferência)`. Onde nem o código
> nem o contexto do módulo permitem inferir nada com segurança, o campo está como `N/A`.
> Fonte: leitura 100% literal de `Pecuaria/EdTratosLC.pas` (404 linhas, unit `EdTratosLC`, classe
> `TfmEdTratosLC`) e do `.dfm` correspondente (título confirmado "Alteração do Lançamento Diário
> do Trato"), nesta sessão — 40º arquivo `.pas` lido do módulo Pecuária. Tela **modal/satélite
> mestre-detalhe**, chamada por **`[[TratosLC]]`** (botão "Editar", `Pecuaria/TratosLC.pas` linha
> 552 — `Application.CreateForm(TfmEdTratosLC, fmEdTratosLC)`, com `Tag`/`lblFazenda.Tag`/
> `lblRetiro.Caption` preenchidos pela chamadora) — **corrigido nesta auditoria**: a chamadora já
> estava identificável no próprio código-fonte e tem nota própria (`[[TratosLC]]`), a versão
> anterior desta nota não havia confirmado essa referência. Mestre `LancTratosLC` (cabeçalho, já visto em `[[LancAjustesLC]]`/
> `[[MovEstoqueTratos]]`) + detalhe `TratosPec` (itens de ração por trato/ordem, com triggers
> `[[TIU_TratosPec]]`/`[[TD_TratosPec]]` lidas integralmente nesta sessão). Ver nota de método
> completa (limitação de DDL/tipos de coluna) em `[[ExportaDietas]]`, válida para todo o módulo.

---

**Status da implementação:** Legado — em produção (documentado via engenharia reversa, sem item de trabalho associado)

**Owner (curadoria):** @jefferson.arantes
**Tags:** #Pecuaria #Trato #Cocho #LancTratosLC #TratosPec

---

## 0) Resumo executivo

- **O que é:** edição mestre-detalhe de um "Lançamento Diário do Trato" específico — o cabeçalho
  (`LancTratosLC`) traz Lote/Data/Leituras de Cocho/Desperdício/Sobra/Funcionário/Caminhão, e o
  detalhe (`TratosPec`) lista os itens de ração efetivamente fornecidos ao longo do dia (um item
  por horário/ordem de trato), cada um com Dieta/Fórmula/Quantidade de Animais/Quantidade de
  Ração.
- **Os totais do cabeçalho nunca são calculados pela aplicação** — `QtdMedAnimais`/
  `TotalDistrib`/`TotalDistribMS`/`CustoTotal`/`UltDieta` são recalculados automaticamente por
  `[[TIU_TratosPec]]`/`[[TD_TratosPec]]` a cada alteração de item, não por código Delphi nesta
  unit.
- **Impacto principal:** `UPDATE LancTratosLC` (cabeçalho) + CRUD em `TratosPec` (detalhe) —
  dispara `[[TIU_TratosPec]]`/`[[TD_TratosPec]]`.

---

## 1) Conceito

| Termo | Definição |
|-------|-----------|
| **BUG CONFIRMADO — `FieldByName('Raca')` (campo inexistente) quebra o preenchimento automático da Fórmula** | `gdTratosTabelaRacaoPropertiesEditValueChanged` (linha 333 de `EdTratosLC.pas`): `dmPecuaria.cdsCadDietas.Locate('Codigo', FieldByName('Raca').AsInteger, [loCaseInsensitive])` — o campo do dataset `cdsTratos` chama-se **`Racao`** (confirmado no `.dfm`, `DataBinding.FieldName='Racao'`, e na declaração `cdsTratosRacao: TIntegerField`), não `Raca`. `TField.FieldByName` com nome inexistente **lança exceção** (`EDatabaseError: Field 'Raca' not found`) — ou seja, toda vez que o usuário troca a Ração de um item do trato no grid, o handler estoura em erro antes de conseguir preencher `Formula` automaticamente. Achado de risco/bug real do código-fonte (não apenas documentação): o comportamento descrito abaixo ("Fórmula resolvida automaticamente") está implementado no código-fonte mas **não funciona em runtime** por este typo — precisa validação com o usuário/QA se o campo `Formula` é preenchido por algum outro caminho (ex.: trigger `[[TIU_TratosPec]]`) ou se realmente fica sempre zerado/manual nesta tela. |
| A Fórmula da Dieta deveria ser resolvida automaticamente ao escolher a Ração no item (mas ver bug acima) | `gdTratosTabelaRacaoPropertiesEditValueChanged`: ao trocar a Dieta (`Racao`) de um item, busca em `dmPecuaria.cdsCadDietas` (carregado com a **fórmula vigente na data do lançamento**, via `FormulasDietas` — nova tabela descoberta, versionada por Data) e preenche `Formula` automaticamente — o usuário não escolhe a Fórmula manualmente. |
| A Quantidade de Animais do item tem um default vindo do saldo do Lote, mas pode ser sobrescrita manualmente (`QtdAnimManual`) | `cdsTratosAfterInsert`: `QtdAnimais := cdsEdLancTratosLC.FieldByName('SaldoAnimais').AsInteger` (saldo agregado calculado na consulta mestre, via `vwSldSubGruposLotes`); `gdTratosTabelaQtdAnimaisPropertiesEditValueChanged`: se o valor editado divergir do saldo, marca `QtdAnimManual := 'S'` — um flag de auditoria indicando que o usuário sobrescreveu o valor sugerido. |
| Leituras de Cocho usam uma lista de "Notas" vigentes na data, vinda de `vwLeiturasCocho` | `FormShow`: `SELECT Nota Codigo, Nota, Ajuste, Atitude FROM vwLeiturasCocho WHERE Data = (última <= Data do lançamento)` — mesmo mecanismo de "Atitude"/vigência por data já visto em `[[LancAjustesLC]]`/`[[ResumoLC]]` (origem provável: `[[ConfAvalCochos]]`, lida e documentada integralmente — a ligação com a view `vwLeiturasCocho` continua presumida, não confirmada por leitura da view em si). |
| Edições cruzadas entre mestre e detalhe são bloqueadas com avisos específicos | `cdsEdLancTratosLCBeforeEdit`: bloqueia editar o cabeçalho se o detalhe estiver em edição ("Salve o Trato antes de efetuar essa operação"); `cdsTratosBeforeInsert`: bloqueia inserir um item se o cabeçalho estiver em edição ("Salve o Lançamento antes de Movimentar os Tratos.") — impede estados inconsistentes entre mestre e detalhe sendo editados simultaneamente. |
| A lista de Caminhões é na verdade uma lista de `Bens` (ativos) de um grupo parametrizável | `FormShow`: `SELECT ... FROM Bens B JOIN Parametros P ON B.Grupo = P.GrupoDistDietasPec WHERE B.UnidadeNegocio = <Fazenda>` — o "Caminhão" do lançamento é um Bem (ativo) cadastrado no ERP, do grupo configurado como "Grupo de Distribuição de Dietas Pecuária" — mesmo padrão de vínculo com `Bens` já visto em `[[Misturadores]]`. |

---

## 2) Dicionário de campos da tela (`.dfm`)

| Controle | Classe | Rótulo/Caption | Vinculado a (campo BD) | Obrigatório | Observações |
|---|---|---|---|---|---|
| `lblFazenda`/`lblRetiro`/`lblLote`/`lblBaia` | `TcxLabel`/`TcxDBLabel` | (contexto) | preenchidos pela chamadora/consulta | — | Apenas exibição. |
| `ceSequencial` | `TcxDBCurrencyEdit` | "Sequencial" | `LancTratosLC.Sequencial` | — | **Omitido da versão anterior.** `Enabled=False` — só exibição (chave do lançamento). |
| `deData` | `TcxDBDateEdit` | "Data" | `LancTratosLC.Data` | — | **Correção:** `Enabled=False` no `.dfm` (linha 97) — a Data **não é editável** nesta tela, ao contrário do que a versão anterior desta nota afirmava ("Editável no mestre"). É só exibição do dia do lançamento (usado, por ex., para resolver a Fórmula/Leitura de Cocho vigente). |
| `ceQtdMedAnimais` | `TcxDBCurrencyEdit` | "Nr. Animais" | `QtdMedAnimais` (calculado pela trigger) | — | `Enabled=False` — só-leitura, confirmado no `.dfm`. |
| `ceFuncionario` | `TcxDBCurrencyEdit` | — | `Funcionario` | Sim (BR-001) | Busca F2 (`dbDispAjudaPessoa`). Sem validação de sinal — `FieldByName('Funcionario').AsInteger <= 0` no BeforePost cobre 0 e negativos igualmente. |
| `cbCaminhao` | `TcxDBLookupComboBox` | — | `Caminhao` (FK `Bens`) | Sim (BR-002) | — |
| `ceDesperdicio`/`ceSobra` | `TcxDBCurrencyEdit` | — | `Desperdicio`/`Sobra` | Não | `DisplayFormat=',0.00;(,0.00)'` já prevê exibir negativo entre parênteses; nenhuma validação de sinal nesta unit — aceitam negativo. |
| `cbLC1`/`cbLC2` | `TcxDBLookupComboBox` | — | `LeituraCocho1`/`2` | Não | Lookup de `vwLeiturasCocho` (Notas vigentes na data). |
| Grid `gdTratosTabela` (bandas, detalhe) | `TcxGridDBBandedColumn` | "Seq." / "Trato" / "Hora" / "Ração" / "Nr. Animais" / "Manual" / "Realizado" | `Sequencial` / `Ordem` / `Hora` / `Racao` / `QtdAnimais` / `QtdAnimManual` / `Qtd` | Ver BR-003 a BR-006 | `Sequencial` (col. "Seq.") tem `Options.Editing=False` — só-leitura (**omitido da versão anterior**). `Ordem` (col. "Trato") é `TcxComboBoxProperties` com lista fixa `Items.Strings = '1'..'7'` (**omitido**) — só aceita 1 a 7, não digitação livre. `Hora` usa `EditMask='!90:00;1;_'` (formato HH:MM). `QtdAnimManual` é `TcxCheckBoxProperties` (S/N), `ImmediatePost=True`. |

---

## 5) Jornada do usuário + Especificação funcional

### SP-01 — Abrir a tela (`FormShow`)
Carrega Caminhões (`Bens` do grupo parametrizado); carrega o registro mestre (`LancTratosLC`,
filtrado por `fmEdTratosLC.Tag`, com o Saldo de Animais calculado via `vwSldSubGruposLotes`) e
entra em modo de edição automaticamente; carrega lookups de Leitura de Cocho (vigente na data) e
de Dietas (vigentes na data, com sua Fórmula).

### SP-02 — Editar o cabeçalho (Funcionário/Caminhão/Leituras/Desperdício/Sobra/Data)

**Pseudocódigo fiel:**
```
ao editar Funcionário: buscar e exibir Nome; avisar "Código do Funcionário Inválido." se não
  encontrado

ao gravar (Post) o cabeçalho:
  se Funcionario <= 0: avisar "Indique o Funcionário do Lançamento." e abortar
  senão se Caminhao <= 0: avisar "Indique o Caminhão do Lançamento." e abortar
  // ApplyUpdates via provider grava o UPDATE real (sem trigger em LancTratosLC — só reflete
  //   valores já calculados por TIU_TratosPec/TD_TratosPec, exceto os campos aqui editados)
  CommitTransacaoTabelas(...)
```

### SP-03 — Trocar de registro mestre (`dsEdLancTratosLCDataChange`)
Recarrega o detalhe (`TratosPec WHERE Lancamento=<mestre> ORDER BY Ordem`) — só se o mestre não
estiver em edição.

### SP-04 — Incluir/Editar/Excluir item de trato (navegador `dnTratos`)

**Pseudocódigo fiel:**
```
ao inserir novo item:
  QtdAnimais := SaldoAnimais do cabeçalho (default)

ao editar a Quantidade de Animais do item manualmente:
  se o novo valor difere do SaldoAnimais do cabeçalho: QtdAnimManual := 'S'

ao trocar a Ração do item:
  // BUG: código busca FieldByName('Raca') — campo inexistente (o campo real é 'Racao') —
  //   lança EDatabaseError em runtime; a Fórmula NÃO é preenchida automaticamente na prática
  buscar a Fórmula vigente na data (dmPecuaria.cdsCadDietas) e preenchê-la automaticamente

ao gravar (Post) um item:
  se Ordem <= 0: avisar "Indique o Trato do Registro." e abortar
  senão se QtdAnimais <= 0: avisar "Indique a Quantidade de Animais do Trato." e abortar
  senão se Racao <= 0: avisar "Indique a Ração do Trato." e abortar
  senão se Qtd <= 0.00: avisar "Indique a quantidade de Ração Realizada." e abortar
  senão se é Inclusão:
    Sequencial := LoadSequencia('TratosPec', 'Sequencial')
    Lancamento := <Sequencial do mestre>
  // ApplyUpdates via provider grava o INSERT/UPDATE real
  //   dispara TIU_TratosPec — recalcula Custo/MS do item e os totais do cabeçalho
  CommitTransacaoTabelas(...)

ao excluir um item:
  confirmar "Deseja Realmente Apagar o Registro Selecionado?"
  se confirmado: prosseguir (dispara TD_TratosPec — recalcula os totais do cabeçalho)
```

### 5.3 Regras de negócio e validações

#### BR-001 — Funcionário obrigatório
- **Mensagem:** "Indique o Funcionário do Lançamento."

#### BR-002 — Caminhão obrigatório
- **Mensagem:** "Indique o Caminhão do Lançamento."

#### BR-003 — Ordem do item obrigatória
- **Mensagem:** "Indique o Trato do Registro."

#### BR-004 — Quantidade de Animais do item obrigatória
- **Mensagem:** "Indique a Quantidade de Animais do Trato."

#### BR-005 — Ração do item obrigatória
- **Mensagem:** "Indique a Ração do Trato."

#### BR-006 — Quantidade de Ração Realizada obrigatória
- **Mensagem:** "Indique a quantidade de Ração Realizada."

#### BR-007 — Não é possível editar mestre e detalhe simultaneamente
- **Mensagens:** "Salve o Trato antes de efetuar essa operação" / "Salve o Lançamento antes de
  Movimentar os Tratos."

---

## 6) Integrações e dados

### 6.1 Integrações (internas)

- **`[[TratosLC]]`** — tela chamadora (lista de lançamentos diários de trato; botão "Editar" abre
  esta tela com `Tag`/`lblFazenda.Tag`/`lblRetiro.Caption` preenchidos).
- **`Bens`**/**`Parametros.GrupoDistDietasPec`** — lista de Caminhões.
- **`vwLeiturasCocho`** — lookup de Leitura de Cocho vigente na data (provável origem:
  `[[ConfAvalCochos]]`, lida e documentada integralmente — ligação com a view ainda presumida).
- **`FormulasDietas`** (nova tabela descoberta) — Fórmula vigente da Dieta na data.
- **`[[TIU_TratosPec]]`/`[[TD_TratosPec]]`** — mantêm os totais do cabeçalho sincronizados.
- **`vwSldSubGruposLotes`** — Saldo de Animais do Lote.

### 6.2 Modelo de dados

**Tabela `LancTratosLC`** (mestre, já parcialmente documentada em `[[LancAjustesLC]]`):

| Coluna | Papel nesta tela |
|---|---|
| `QtdMedAnimais`/`TotalDistrib`/`TotalDistribMS`/`UltDieta`/`CustoTotal` | Recalculados por `[[TIU_TratosPec]]`/`[[TD_TratosPec]]` — não editáveis diretamente. |
| `Funcionario`/`Caminhao`/`LeituraCocho1`/`2`/`Desperdicio`/`Sobra`/`Data` | Editáveis nesta tela. |

**Tabela `TratosPec`** (detalhe):

| Coluna | Tipo (Delphi/inferido) | Papel nesta tela |
|---|---|---|
| `Sequencial` | `TIntegerField` (persistente) — `int` (alta confiança) | Chave — gerada por `LoadSequencia`. |
| `Lancamento` | `TIntegerField` (persistente) — `int` (alta confiança) | FK para `LancTratosLC.Sequencial`. |
| `Ordem` | `TIntegerField` (persistente) — `int` (alta confiança) | Posição/horário do trato no dia. |
| `Hora` | `TStringField` (persistente) — `varchar` (alta confiança) | — |
| `Racao` | `TIntegerField` (persistente) — `int` (alta confiança) | FK para `Tabelas.Codigo` (`Tipo=183`). |
| `Formula` | `TIntegerField` (persistente) — `int` (alta confiança) | FK para `FormulasDietas.Sequencial`, preenchida automaticamente. |
| `QtdAnimais` | `TIntegerField` (persistente) — `int` (alta confiança) | Default = Saldo do Lote; editável. |
| `QtdAnimManual` | `TStringField` (persistente) — `char(1)` (alta confiança) | `S` se `QtdAnimais` foi sobrescrito manualmente. |
| `Qtd` | `TFMTBCDField` (persistente) — `decimal`/`numeric` (alta confiança) | Quantidade de ração fornecida (Kg). |
| `QtdMS`/`CustoDieta` | (não editáveis nesta tela) | Calculados por `[[TIU_TratosPec]]`. |

### 6.3 Triggers e Procedures do banco

- **`[[TIU_TratosPec]]`**/**`[[TD_TratosPec]]`** (lidas integralmente nesta sessão).

---

## 7) Suporte: FAQ, mensagens, erros e troubleshooting

### 7.2 Catálogo de mensagens e erros

| Mensagem exata | Causa |
|---|---|
| "Indique o Funcionário do Lançamento." | BR-001 |
| "Indique o Caminhão do Lançamento." | BR-002 |
| "Indique o Trato do Registro." | BR-003 |
| "Indique a Quantidade de Animais do Trato." | BR-004 |
| "Indique a Ração do Trato." | BR-005 |
| "Indique a quantidade de Ração Realizada." | BR-006 |
| "Salve o Trato antes de efetuar essa operação" | BR-007 (editar mestre com detalhe em edição) |
| "Salve o Lançamento antes de Movimentar os Tratos." | BR-007 (inserir item com mestre em edição) |
| "Código do Funcionário Inválido." | Busca de Funcionário sem correspondência |
| "Deseja Realmente Apagar o Registro Selecionado?" | Confirmação de exclusão de item |

---

## 9) Notas de revisão

- **2026-09-02** (auditoria de profundidade — releitura completa do `.pas`/`.dfm`)
  - **O que mudou:** **achado crítico novo:** `gdTratosTabelaRacaoPropertiesEditValueChanged`
    (linha 333) chama `FieldByName('Raca')` — campo inexistente no dataset (`cdsTratos` só tem
    `Racao`, confirmado no `.dfm` e na declaração de fields) — isso lança `EDatabaseError` em
    runtime toda vez que o usuário troca a Ração de um item, então o preenchimento automático da
    Fórmula descrito na seção 1/SP-04 **não funciona na prática**, apesar de implementado no
    código. Documentado como achado de risco/bug real (seção 1, SP-04). Corrigida a tela
    chamadora: identificada como `[[TratosLC]]` (linha 552 do `.pas`), que já tem nota própria — a
    versão anterior desta nota registrava "chamadora ainda não identificada". Corrigido erro
    factual: `deData` tem `Enabled=False` no `.dfm` — a Data **não é editável** nesta tela
    (contradizia SP-02/dicionário da versão anterior). Dicionário de campos (seção 2) ganhou
    `ceSequencial` (omitido), e detalhes de cada coluna do grid (`Sequencial` só-leitura, `Ordem`
    restrita a lista fixa 1–7, máscara de `Hora`) que estavam resumidos demais. Confirmado:
    nenhum campo desta tela tem validação de sinal (aceitam negativo onde o tipo permite).
  - **Impacto:** nenhum no sistema (documentação apenas). Achado do bug `FieldByName('Raca')`
    pode justificar abertura de RDM de correção — decisão fora do escopo desta auditoria.
  - **Referências:** releitura de `Pecuaria/EdTratosLC.pas` (404 linhas) e `.dfm` (1012 linhas)
    completos nesta sessão; `Pecuaria/TratosLC.pas` (linha 552) para a chamadora.

- **2026-08-28** (criação da nota — módulo Pecuária)
  - **O que mudou:** nota criada do zero, a partir de leitura 100% literal de
    `Pecuaria/EdTratosLC.pas` (404 linhas) + `.dfm` (título confirmado "Alteração do Lançamento
    Diário do Trato"). Documentado o mestre-detalhe `LancTratosLC`/`TratosPec`, com as triggers
    `[[TIU_TratosPec]]`/`[[TD_TratosPec]]` (lidas integralmente) mantendo os totais do cabeçalho
    sincronizados automaticamente. Descoberta a tabela `FormulasDietas` (Fórmula da Dieta
    versionada por data).
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** código-fonte `Pecuaria/EdTratosLC.pas` + `.dfm`; `[[TIU_TratosPec]]`,
    `[[TD_TratosPec]]`; ver `[[LancAjustesLC]]`, `[[MovEstoqueTratos]]`, `[[Misturadores]]`,
    `[[ResumoLC]]`.
