> **Nota de método**: este documento descreve uma tela de um sistema LEGADO já em produção,
> reconstruída por engenharia reversa do código-fonte — não é uma especificação de feature nova
> obtida por entrevista com um PO. Por isso, toda seção que normalmente viria de uma conversa de
> negócio (motivação, métricas, objetivos) foi preenchida por **inferência a partir do
> comportamento do código**, e está marcada explicitamente como `(inferência)`. Onde nem o código
> nem o contexto do módulo permitem inferir nada com segurança, o campo está como `N/A`.
> Fonte: leitura 100% literal de `Pecuaria/CustosRetiros.pas` (290 linhas, unit `CustosRetiros`,
> classe `TfmCustosRetiros`) e do `.dfm` correspondente (título confirmado "Orçamento Anual do
> Confinamento"), nesta sessão — 18º arquivo `.pas` lido do módulo Pecuária. **Tela de
> formulário de registro único** (não grade) — 1 registro de `CustosRetiros` por combinação
> Safra+Retiro, com os botões "Inserir"/"Excluir" do navegador **ocultos no `.dfm`**
> (`Buttons.Insert.Visible = False`, `Buttons.Delete.Visible = False`) — ver achado de risco no
> Conceito. Busca por `CustosRetiros` na pasta `scripts/triggers` não retornou nenhum resultado —
> tabela sem trigger. Ver nota de método completa (limitação de DDL/tipos de coluna) em
> `[[ExportaDietas]]`, válida para todo o módulo.

---

**Status da implementação:** Legado — em produção (documentado via engenharia reversa, sem item de trabalho associado)

**Owner (curadoria):** @jefferson.arantes
**Tags:** #Pecuaria #Orcamento #Retiro #Custo #Confinamento

---

## 0) Resumo executivo

- **O que é:** formulário "Orçamento Anual do Confinamento" — para uma Fazenda/Retiro
  selecionados (na Safra corrente, `_iSafra`), permite editar um único registro orçamentário:
  Mês de Início do Orçamento, Valor Anual (`VlrAnual`), Capacidade Estática do confinamento
  (`CapEstatica`), Quantidade Total de Cabeças orçada (`QtdCabTotal`), Dias de Permanência
  orçados (`Permanencia`) e um Custo Diária **calculado automaticamente** a partir dos anteriores.
- **Quando usar (inferência):** planejamento orçamentário anual do confinamento por Retiro, para
  posterior comparação com custos reais (consumidor exato do valor não identificado nesta sessão
  — candidato: `[[spBalancoGeralPec]]`/`[[spAnalVendasPec]]`, que já lidam com custo por Retiro,
  mas nenhuma referência direta a `CustosRetiros` foi vista nesses procedures até agora).
- **Impacto principal:** `UPDATE`/`INSERT` em `CustosRetiros` (sem trigger associada).

---

## 1) Conceito

| Termo | Definição |
|-------|-----------|
| Custo Diária é calculado no cliente, não gravado por fórmula do banco | `ceVlrTotalPropertiesEditValueChanged`: `CustoDiaria := VlrAnual / (QtdCabTotal × Permanencia)` — recalculado ao editar o Valor Anual, **mas não ao editar `QtdCabTotal` ou `Permanencia` diretamente** (o evento só está amarrado ao campo Valor Total) — achado: se o usuário editar Capacidade/Cabeças/Permanência sem tocar no Valor Anual, o Custo Diária pode ficar desatualizado em relação aos novos valores até o próximo recálculo. |
| Trocar de Retiro força o registro em edição a ser gravado automaticamente | `cbRetirosPropertiesEditValueChanged`: `if cdsCustosRetiros.State in [dsInsert, dsEdit] then cdsCustosRetiros.Post` antes de recarregar — não há opção de descartar a edição em andamento ao trocar de Retiro (mesmo padrão de "Post forçado" já visto em `[[LancAjustesLC]]`). |
| **Achado de risco — sem caminho visível de criação do 1º registro do Retiro/Safra**: botões "Inserir"/"Excluir" do navegador estão **ocultos** no `.dfm` | Apenas "Alterar" (F5), "Salvar" (F6) e "Cancelar" (F7) estão visíveis/habilitados; `Buttons.Insert.Visible = False`. `cdsCustosRetirosBeforePost` trata o caso `State = dsInsert` (preenchendo `Sequencial`/`Safra`/`Retiro`), sugerindo que a inclusão de fato acontece em algum fluxo — mas **nenhum handler nesta unit dispara `Insert` automaticamente** (não há `AfterOpen`/`AfterScroll` chamando `cdsCustosRetiros.Insert` quando a consulta retorna vazia). Não é possível confirmar, apenas por esta unit, como o primeiro orçamento de um Retiro/Safra é efetivamente criado — pode ser um comportamento herdado de `TFormBase`/`dnNavega` não capturado nesta leitura, ou uma funcionalidade quebrada/incompleta. |
| Mês de Início usa o mesmo padrão `GetText`/`SetText` de código→rótulo | `cdsCustosRetirosMesIniGetText`/`SetText`: mapeia `1`..`12` para "01 - JANEIRO".."12 - DEZEMBRO" — variação numérica do padrão de rótulo textual já visto em outras telas (aqui sobre um inteiro, não um char). |
| Sem `RoundTo`/`Round` na divisão de `CustoDiaria`; nenhum campo aceita negativo (auditoria 2026-09-02) | Confirmado por releitura: `CustoDiaria := VlrAnual/(QtdCabTotal*Permanencia)` usa `AsFloat` puro, sem arredondamento — a precisão final depende só da definição de coluna (`TFMTBCDField`) no banco. Todos os 4 campos numéricos de entrada (`VlrAnual`/`CapEstatica`/`QtdCabTotal`/`Permanencia`) são validados com `<=0` (BR-003 a BR-006), o que já cobre negativos e zero uniformemente. |

---

## 2) Dicionário de campos da tela (`.dfm`)

| Controle | Classe | Rótulo/Caption | Vinculado a (campo BD) | Obrigatório | Observações |
|---|---|---|---|---|---|
| `cbFazendas` | `TcxLookupComboBox` | (grupo "Fazendas") | escopo (não gravado) | — | Pré-selecionada com `_iUnidNegoc`; ao trocar, recarrega `Retiros`. |
| `cbRetiros` | `TcxLookupComboBox` | (grupo "Retiros") | `Retiro` | Sim (BR-001) | Ao trocar, força Post pendente e recarrega o registro do novo Retiro/Safra. |
| `cbMes` | `TcxDBComboBox` | (grupo "Mês Início") | `MesIni` | Sim (BR-002) | Combo com os 12 meses (via `GetText`/`SetText`). |
| `ceVlrTotal` | `TcxDBCurrencyEdit` | (grupo "Vlr. Anual Orçamento") | `VlrAnual` | Sim (BR-003) | Ao mudar, recalcula `CustoDiaria`. |
| `ceCapEstatica` | `TcxDBCurrencyEdit` | (grupo "Cap. Estática") | `CapEstatica` | Sim (BR-004) | — |
| `ceQtdCabTotal` | `TcxDBCurrencyEdit` | (grupo "Qtd. Cab. Total") | `QtdCabTotal` | Sim (BR-005) | — |
| `cePermanencia` | `TcxDBCurrencyEdit` | (grupo "Dias Perm.") | `Permanencia` | Sim (BR-006) | — |
| `ceCustoDiaria` | `TcxDBCurrencyEdit` | (grupo "Custo Diária") | `CustoDiaria` | — | **Desabilitado** (`Enabled=False`) — campo somente-exibição, calculado. |
| `btnSair` | `TcxButton` | "Sair" | — | — | Fecha a tela (`Close`). |
| `dnNavega` | `TcxDBNavigator` | — | — | — | Apenas Alterar/Salvar/Cancelar visíveis — Inserir/Excluir ocultos. |

---

## 5) Jornada do usuário + Especificação funcional

### SP-01 — Abrir a tela (`FormShow`)
Aplica permissão de somente-leitura; carrega Fazendas permitidas; pré-seleciona `_iUnidNegoc`, o
que dispara (via `EditValueChanged`) o carregamento de Retiros e do registro de orçamento.

### SP-02 — Trocar Fazenda (`cbFazendasPropertiesEditValueChanged`)
`SELECT Sequencial, Descricao FROM Retiros WHERE Fazenda=<Fazenda> ORDER BY Descricao`; seleciona
o primeiro Retiro da lista automaticamente (`First` + atribuição a `cbRetiros.EditValue`).

### SP-03 — Trocar Retiro (`cbRetirosPropertiesEditValueChanged`)
Grava edição pendente (se houver); carrega:
```
SELECT Sequencial, Retiro, Safra, MesIni, VlrAnual, CapEstatica, QtdCabtotal, Permanencia,
       CustoDiaria
FROM CustosRetiros WHERE Safra = <_iSafra> AND Retiro = <cbRetiros>
```

### SP-04 — Editar e gravar (`cdsCustosRetirosBeforePost`)

**Pseudocódigo fiel:**
```
ao gravar (Post):
  se cbRetiros.EditValue <= 0: avisar "O Retiro Selecionado é Inválido." e abortar
  senão se MesIni <= 0: avisar "Selecione o Mês de Início do Orçamento." e abortar
  senão se VlrAnual <= 0.00: avisar "O Valor Anual do Orçamento deve ser maior que Zero(0.00)." e abortar
  senão se CapEstatica <= 0: avisar "Indique a Capacidade Estática do Confinamento." e abortar
  senão se QtdCabTotal <= 0: avisar "Indique a Quantidade Total de Cabeças para o Orçamento." e abortar
  senão se Permanencia <= 0: avisar "Indique quantos Dias de Permanência para o Orçamento." e abortar
  senão se é Inclusão:
    Sequencial := LoadSequencia('CustosRetiros', 'Sequencial')
    Safra := _iSafra
    Retiro := cbRetiros.EditValue
  // ApplyUpdates via provider grava o INSERT/UPDATE real (sem trigger)
  CommitTransacaoTabelas(...)
```
**Achado:** apesar de `Abort` ser chamado antes de `MessageDlg`/`SetFocus` em cada bloco (as
linhas `Abort;` aparecem **antes** de `xxx.SetFocus` no código-fonte), o `SetFocus` **nunca é
executado** — `Abort` interrompe o fluxo imediatamente ao lançar uma exceção silenciosa
(`EAbort`), então a chamada de foco após ele é código morto/inalcançável em todos os 6 blocos de
validação desta unit.

### 5.3 Regras de negócio e validações

#### BR-001 — Retiro selecionado deve ser válido
- **Mensagem:** "O Retiro Selecionado é Inválido."

#### BR-002 — Mês de Início obrigatório
- **Mensagem:** "Selecione o Mês de Início do Orçamento."

#### BR-003 — Valor Anual deve ser maior que zero
- **Mensagem:** "O Valor Anual do Orçamento deve ser maior que Zero(0.00)."

#### BR-004 — Capacidade Estática obrigatória e maior que zero
- **Mensagem:** "Indique a Capacidade Estática do Confinamento."

#### BR-005 — Quantidade Total de Cabeças obrigatória e maior que zero
- **Mensagem:** "Indique a Quantidade Total de Cabeças para o Orçamento."

#### BR-006 — Dias de Permanência obrigatórios e maiores que zero
- **Mensagem:** "Indique quantos Dias de Permanência para o Orçamento."

#### BR-007 — `SetFocus` pós-erro é código morto (achado de qualidade de código)
- **Achado:** ver Pseudocódigo fiel acima — `Abort` sempre precede `SetFocus` nos 6 blocos de
  validação, tornando o `SetFocus` inalcançável.

---

## 6) Integrações e dados

### 6.1 Integrações (internas)

- **`Retiros`**/**`DetPessoas`** — infraestrutura genérica de seleção de Fazenda/Retiro do módulo
  (mesmo padrão de outras telas). Nenhuma navegação para outras telas.
- Consumidor do orçamento (`CustosRetiros`) para comparação com custo real **não identificado**
  nesta sessão.

### 6.2 Modelo de dados

**Tabela `CustosRetiros`** (própria):

| Coluna | Tipo (Delphi/inferido) | Papel nesta tela |
|---|---|---|
| `Sequencial` | `TIntegerField` (persistente) — `int` (alta confiança) | Chave — gerada por `LoadSequencia`. |
| `Retiro` | `TIntegerField` (persistente) — `int` (alta confiança) | FK para `Retiros.Sequencial`. |
| `Safra` | `TIntegerField` (persistente) — `int` (alta confiança) | Fixada em `_iSafra` (contexto global). |
| `MesIni` | `TIntegerField` (persistente, `GetText`/`SetText` customizados) — `int` (alta confiança) | 1-12, mês de início do orçamento. |
| `VlrAnual` | `TFMTBCDField` (persistente) — `decimal`/`numeric` (alta confiança) | Valor orçado anual. |
| `CapEstatica` | `TIntegerField` (persistente) — `int` (alta confiança) | Capacidade estática orçada do confinamento. |
| `QtdCabTotal` | `TIntegerField` (persistente) — `int` (alta confiança) | Quantidade total de cabeças orçada. |
| `Permanencia` | `TIntegerField` (persistente) — `int` (alta confiança) | Dias de permanência orçados. |
| `CustoDiaria` | `TFMTBCDField` (persistente) — `decimal`/`numeric` (alta confiança) | Calculado no cliente = `VlrAnual / (QtdCabTotal × Permanencia)`, gravado como valor, não fórmula. |

### 6.3 Triggers e Procedures do banco

**Nenhuma.** Busca por `CustosRetiros` na pasta `scripts/triggers` não retornou nenhum resultado.

---

## 7) Suporte: FAQ, mensagens, erros e troubleshooting

### 7.2 Catálogo de mensagens e erros

| Mensagem exata | Causa |
|---|---|
| "O Retiro Selecionado é Inválido." | BR-001 |
| "Selecione o Mês de Início do Orçamento." | BR-002 |
| "O Valor Anual do Orçamento deve ser maior que Zero(0.00)." | BR-003 |
| "Indique a Capacidade Estática do Confinamento." | BR-004 |
| "Indique a Quantidade Total de Cabeças para o Orçamento." | BR-005 |
| "Indique quantos Dias de Permanência para o Orçamento." | BR-006 |

---

## 9) Notas de revisão

- **2026-09-02** (auditoria campo-a-campo — módulo Pecuária)
  - **O que mudou:** confirmado explicitamente (releitura completa) que `CustoDiaria` não usa
    nenhum arredondamento Delphi, e que as 4 validações numéricas (`<=0`) já cobrem negativos e
    zero de forma uniforme. Dicionário de campos e caminho de menu já estavam exaustivos —
    nenhuma outra alteração necessária.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** código-fonte `Pecuaria/CustosRetiros.pas` + `.dfm`.

- **2026-08-28** (criação da nota — módulo Pecuária)
  - **O que mudou:** nota criada do zero, a partir de leitura 100% literal de
    `Pecuaria/CustosRetiros.pas` (290 linhas) + `.dfm` (título confirmado "Orçamento Anual do
    Confinamento"). Documentado o formulário de registro único de orçamento por Safra/Retiro.
    Achados: botões Inserir/Excluir ocultos sem caminho claro de criação do 1º registro; `Abort`
    antes de `SetFocus` torna o foco pós-erro código morto em todos os 6 blocos de validação;
    recálculo de Custo Diária amarrado só ao campo Valor Anual.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** código-fonte `Pecuaria/CustosRetiros.pas` + `.dfm`; ver `[[LancAjustesLC]]`
    (padrão de Post forçado ao trocar seleção).
