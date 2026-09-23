> **Nota de método**: este documento descreve uma tela de um sistema LEGADO já em produção,
> reconstruída por engenharia reversa do código-fonte — não é uma especificação de feature nova
> obtida por entrevista com um PO. Por isso, toda seção que normalmente viria de uma conversa de
> negócio (motivação, métricas, objetivos) foi preenchida por **inferência a partir do
> comportamento do código**, e está marcada explicitamente como `(inferência)`. Onde nem o código
> nem o contexto do módulo permitem inferir nada com segurança, o campo está como `N/A`.
> Fonte: leitura 100% literal de `Pecuaria/EstoqueBrincos.pas` (419 linhas, unit
> `EstoqueBrincos`, classe `TfmEstoqueBrincos`) e do `.dfm` correspondente (título confirmado
> "Estoque de Brincos SisBov"), nesta sessão — 47º arquivo `.pas` lido do módulo Pecuária. **Esta
> é a tela chamadora de `[[RegBrincosNovos]]`** (tanto em modo Cadastro quanto em modo Edição de
> caixa, resolvendo a referência pendente daquela nota) e de `[[spCorrigeEstoqueBrincos]]` (lida
> integralmente nesta sessão). Ver nota de método completa (limitação de DDL/tipos de coluna) em
> `[[ExportaDietas]]`, válida para todo o módulo.

---

**Status da implementação:** Legado — em produção (documentado via engenharia reversa, sem item de trabalho associado)

**Owner (curadoria):** @jefferson.arantes
**Tags:** #Pecuaria #Brinco #SisBov #Estoque #Auditoria

---

## 0) Resumo executivo

- **O que é:** grade "Estoque de Brincos SisBov" — consulta agrupada (por Caixa) de todos os
  brincos já registrados (`BrincosIndividuais.DataRegCx IS NOT NULL`), com filtros por
  Proprietário/Fazenda/período/Status (Estoque/Brincado)/faixa de Caixa/faixa de SisBov, e um
  conjunto de **ações de manutenção em massa** sobre a caixa selecionada: Incluir novos (abre
  `[[RegBrincosNovos]]` em modo Cadastro), Alterar dados da caixa (abre `[[RegBrincosNovos]]` em
  modo Edição), Excluir todos os brincos da caixa, e Corrigir duplicidades
  (`[[spCorrigeEstoqueBrincos]]`).
- **Impacto principal:** `DELETE`/`UPDATE` em massa em `BrincosIndividuais` (via
  `ExcluirBrincosCaixa`, SQL direto) ou via `[[spCorrigeEstoqueBrincos]]`.

---

## 1) Conceito

| Termo | Definição |
|-------|-----------|
| A grade é agrupada por Caixa, e as ações usam os valores de sumário do grupo focado | `AlterarBrincosCaixa`/`ExcluirBrincosCaixa`/`btnCorrecaoClick`: todos leem `tvEstoqueBrincos.DataController.Summary.GroupSummaryValues[...]` para obter o Brinco Inicial/Final (índices de sumário 2/3) e a Quantidade por Caixa (índice 0) do **grupo atualmente focado** — as ações operam sobre a caixa inteira, não sobre uma linha individual. |
| "Excluir" tem 2 efeitos distintos conforme o status do brinco | `ExcluirBrincosCaixa`: brincos ainda `StatusBrinco='E'` (nunca aplicados) são **excluídos fisicamente**; brincos já `StatusBrinco='B'` (Brincados/aplicados a um animal) **não são excluídos** — apenas têm os campos de registro de caixa **limpos** (`RegSisBov:='N'`, `DataRegCx`/`ProprietarioCx`/etc. := `Null`), preservando o vínculo do brinco com o animal. |
| "Correção" delega a lógica ao banco, mas usa a mesma faixa de Brinco Inicial/Final do sumário do grupo | `btnCorrecaoClick`: mensagem de confirmação explícita ("Os Brincos repetidos em estoque serão apagados, permanecendo somente os brincos já utilizados em animais.") — reflete exatamente o comportamento de `[[spCorrigeEstoqueBrincos]]`. |
| Botão "Correção" tem permissão granular própria | `btnCorrecao.Enabled := TemPermissao(btnCorrecao.Tag, ...)` — avaliado uma vez no `FormShow`, diferente de `[[EvolCategorias]]` (que reavalia a permissão dinamicamente a cada mudança de estado). |
| A consulta principal comenta a linha de debug (`mmQuery.Lines`) | `btnConsultarClick`: `//mmQuery.Lines:= S;` está comentado — o painel de debug `mmQuery` existe e é alternável (`Ctrl+F9`), mas não é alimentado pela consulta principal (só é alimentado por `btnCorrecaoClick`, que passa `EXEC spCorrigeEstoqueBrincos` para o painel). |

---

## 2) Dicionário de campos da tela (`.dfm`)

| Controle | Classe | Rótulo/Caption | Vinculado a (campo BD) | Obrigatório | Observações |
|---|---|---|---|---|---|
| `ceProp` | `TcxCurrencyEdit` | — | filtro apenas, `ProprietarioCx` | Não | Busca F2 ("P3"); ao trocar, recarrega `cbFazenda`. |
| `cbFazenda` | `TcxLookupComboBox` | — | filtro apenas, `FazendaCx` | Não | + "..:: TODAS ::..". |
| `meBrincoIni`/`meBrincoFinal` | `TcxMaskEdit` | — | filtro apenas, `SisBov` | Não | Validados via `ValidaSisBov`. |
| `ceCaixaIni`/`ceCaixaFinal` | `TcxCurrencyEdit` | — | filtro apenas, `NumeroCx` | Não | — |
| `cbDataBase` | `TcxComboBox` | — | filtro apenas (`DataRegCx` ou `DataPlanilhaCx`) | — | — |
| `deInicio`/`deFinal` | `TcxDateEdit` | (grupo "Período") | filtro apenas | Não | — |
| `cbStatus` | `TcxComboBox` | — | filtro apenas, `StatusBrinco` | — | — |
| `btnConsultar`/`btnSair` | `TcxButton` | — | — | — | — |
| `btnCorrecao` | `TcxButton` | "Correção de Estoque" | — | — | Permissão granular própria. |
| Grid `tvEstoqueBrincos` (colunas) | `TcxGridDBColumn` | Sequencial / SisBov / Data Registro / Proprietário/Fazenda / Nr. Caixa / Data Planilha / Status | (ver consulta) | — | Agrupado por Caixa. |
| `dnNavega` | `TcxDBNavigator` | — | — | — | Botões interceptados manualmente (Inserir/Excluir/Alterar → ações de caixa). |

---

## 5) Jornada do usuário + Especificação funcional

### SP-01 — Abrir a tela (`FormShow`)
Aplica permissão de somente-leitura e a permissão granular de "Correção"; filtros de data limpos;
executa consulta inicial; expande todos os grupos.

### SP-02 — Consultar (`btnConsultarClick`)
```
SELECT B.Sequencial, B.SisBov, B.DataRegCx, B.NumeroCx, B.DataPlanilhaCx, B.ProprietarioCx,
       B.FazendaCx, <Nome+Fazenda> PropFaz, <StatusBrinco traduzido: E=ESTOQUE, B=BRINCADO>
FROM BrincosIndividuais B JOIN Pessoas P ... JOIN DetPessoas F ...
WHERE B.DataRegCx IS NOT NULL
[AND B.ProprietarioCx=...] [AND B.FazendaCx=...] [AND DataRegCx/DataPlanilhaCx BETWEEN ...]
[AND B.StatusBrinco=...] [AND B.NumeroCx=... ou BETWEEN ...] [AND B.SisBov=... ou BETWEEN ...]
ORDER BY B.SisBov
```

### SP-03 — Incluir (botão "Inserir" do navegador, índice 6)
Abre `[[RegBrincosNovos]]` em modo Cadastro (`meBrincoIni.Enabled=True`, padrão); reconsulta se
não cancelado.

### SP-04 — Alterar dados da caixa selecionada (`AlterarBrincosCaixa`, botão índice 8)
Abre `[[RegBrincosNovos]]` pré-preenchido com os dados da caixa focada (Proprietário/Fazenda/
Data/faixa de Brincos/Qtd por Caixa/Nr. Caixa/Data Planilha), com os 5 campos de
sequência/caixa **desabilitados** (`meBrincoIni.Enabled:=False`, ativando o modo Edição
daquela tela); reconsulta se não cancelado.

### SP-05 — Excluir a caixa selecionada (`ExcluirBrincosCaixa`, botão índice 7)

**Pseudocódigo fiel:**
```
confirmar "Serão Excluídos todos os Brincos da Caixa Selecionada. Deseja Continuar?"
se confirmado:
  DELETE BrincosIndividuais WHERE StatusBrinco='E' AND ProprietarioCx=... AND FazendaCx=...
    AND NumeroCx=... AND SisBov BETWEEN <BrincoIni> AND <BrincoFim>
  UPDATE BrincosIndividuais SET RegSisBov='N', DataRegCx=Null, ProprietarioCx=Null, FazendaCx=Null,
    QtdBrincosCx=Null, NumeroCx=Null, QtdCx=Null, DataPlanilhaCx=Null
    WHERE StatusBrinco='B' AND ProprietarioCx=... AND FazendaCx=... AND NumeroCx=...
    AND SisBov BETWEEN <BrincoIni> AND <BrincoFim>
  avisar "Brincos da Caixa Selecionada Excluídos com Sucesso."
  reconsultar
```

### SP-06 — Corrigir Estoque (`btnCorrecaoClick`)
```
confirmar "Os Brincos repetidos em estoque serão apagados, permanecendo somente os brincos já
  utilizados em animais. Deseja continuar?"
se confirmado:
  EXEC spCorrigeEstoqueBrincos @Safra=_iSafra, @Prop, @Faz, @Caixa, @BrincoIni, @BrincoFim,
    @Usuario, @Sessao
  avisar "Correção Finalizada com Sucesso!" (ou erro)
  reconsultar
```

### 5.3 Regras de negócio e validações

Nenhuma validação de parâmetros de filtro identificada — a consulta sempre executa.

---

## 6) Integrações e dados

### 6.1 Integrações (internas)

- **`[[RegBrincosNovos]]`** — aberta em modo Cadastro (Incluir) e modo Edição (Alterar).
- **`[[spCorrigeEstoqueBrincos]]`** (75 linhas, lida integralmente) — correção de duplicidades.
- **`[[BibPec]]`** (`ValidaSisBov`).

### 6.2 Modelo de dados

Nenhuma tabela própria — consulta e gerencia `BrincosIndividuais` diretamente.

### 6.3 Triggers e Procedures do banco

- **`[[spCorrigeEstoqueBrincos]]`**.
- **`[[TU_BrincosIndividuais]]`** (achado, auditoria 2026-09-08) — dispara no `UPDATE
  BrincosIndividuais` de `ExcluirBrincosCaixa` (ramo `StatusBrinco='B'`), mas seu corpo só age se
  `UPDATE(IncSisBov)` — campo **não** alterado por este `UPDATE` (que só limpa `RegSisBov`/
  `DataRegCx`/`ProprietarioCx`/`FazendaCx`/etc.) — dispara mas é efetivamente no-op aqui.

---

## 7) Suporte: FAQ, mensagens, erros e troubleshooting

### 7.2 Catálogo de mensagens e erros

| Mensagem exata | Causa |
|---|---|
| "Código do Proprietário Inválido." | Busca de Proprietário sem correspondência |
| "Brinco esta Incorreto." | Dígito verificador SisBov inválido no filtro |
| "Serão Excluídos todos os Brincos da Caixa Selecionada. Deseja Continuar?" | Confirmação de exclusão em massa |
| "Brincos da Caixa Selecionada Excluídos com Sucesso." | Sucesso da exclusão |
| "Erro na Exclusão dos Brincos da Caixa." + detalhe | Falha na exclusão |
| "Os Brincos repetidos em estoque serão apagados, permanecendo somente os brincos já utilizados em animais. Deseja continuar?" | Confirmação da Correção |
| "Correção Finalizada com Sucesso!" | Sucesso da Correção |
| "Erro na Correção do Estoque de Brincos da Caixa Selecionada." + detalhe | Falha na Correção |

---

## 9) Notas de revisão

- **2026-09-08** (auditoria campo-a-campo — módulo Pecuária)
  - **O que mudou:** identificada `[[TU_BrincosIndividuais]]` como disparada (mas no-op, pois não
    altera `IncSisBov`) pelo `UPDATE` de `ExcluirBrincosCaixa`.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** ver `[[TU_BrincosIndividuais]]`.

- **2026-08-28** (criação da nota — módulo Pecuária)
  - **O que mudou:** nota criada do zero, a partir de leitura 100% literal de
    `Pecuaria/EstoqueBrincos.pas` (419 linhas) + `.dfm` (título confirmado "Estoque de Brincos
    SisBov"). **Resolve a referência pendente** sobre a chamadora do modo Edição de
    `[[RegBrincosNovos]]`. Documentadas as ações de manutenção em massa por caixa (Incluir/
    Alterar/Excluir/Corrigir), incluindo `[[spCorrigeEstoqueBrincos]]` (lida integralmente).
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** código-fonte `Pecuaria/EstoqueBrincos.pas` + `.dfm`;
    `[[spCorrigeEstoqueBrincos]]`; ver `[[RegBrincosNovos]]`, `[[BibPec]]`.
