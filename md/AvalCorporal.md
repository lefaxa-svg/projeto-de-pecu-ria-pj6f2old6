> **Nota de método**: este documento descreve uma tela de um sistema LEGADO já em produção,
> reconstruída por engenharia reversa do código-fonte — não é uma especificação de feature nova
> obtida por entrevista com um PO. Por isso, toda seção que normalmente viria de uma conversa de
> negócio (motivação, métricas, objetivos) foi preenchida por **inferência a partir do
> comportamento do código**, e está marcada explicitamente como `(inferência)`. Onde nem o código
> nem o contexto do módulo permitem inferir nada com segurança, o campo está como `N/A`.
> Fonte: leitura 100% literal de `Pecuaria/AvalCorporal.pas` (218 linhas, unit `AvalCorporal`,
> classe `TfmAvalCorporal`) e do `.dfm` correspondente (título confirmado "Avaliação Corporal dos
> Animais"), nesta sessão — 11º arquivo `.pas` lido do módulo Pecuária. Tela de **cadastro CRUD em
> grade** sobre o domínio genérico `Tabelas` (`Tipo=182`) — **domínio distinto** de
> `[[EscoresConsMetas]]` (`Tipo=222`), apesar do nome sugerir sobreposição; não confirmar
> confusão entre os dois. Triggers genéricas `[[TU_TABELAS]]`/`[[TD_TABELAS]]` (já documentadas)
> aplicam-se aqui também — `Tipo=182` **não tem** bloco de validação específico em nenhuma das
> duas. Ver nota de método completa (limitação de DDL/tipos de coluna) em `[[ExportaDietas]]`,
> válida para todo o módulo.

---

**Status da implementação:** Legado — em produção (documentado via engenharia reversa, sem item de trabalho associado)

**Owner (curadoria):** @jefferson.arantes
**Tags:** #Pecuaria #Nutricao #Cadastro #AvaliacaoCorporal #ECC

---

## 0) Resumo executivo

- **O que é:** cadastro em grade "Avaliação Corporal dos Animais" — registros de
  `Tabelas.Tipo=182`, cada um com um Escore (`Codigo`), uma "Condição" (`Mascara` — texto livre,
  provavelmente uma expressão/faixa de condição corporal, não confirmável em detalhe sem ver seu
  consumidor), Descrição e um flag Ativo/Inativo (`Ativa`, checkbox `S`/`N`). Provável tabela de
  domínio para classificar o Escore de Condição Corporal (ECC) do rebanho `(inferência)`.
- **Quando usar (inferência):** configurado uma vez por protocolo; consultado por outra rotina do
  módulo — confirmado via grep (2026-09-01) que `TfmAvalCorporal` só é referenciada em
  `iniModuloPecuaria.pas` (item de menu) em toda a pasta `Pecuaria/`; não há satélite que a abra
  como seletor.
- **Impacto principal:** CRUD em `Tabelas` (`Tipo=182`) via `ClientDataSet.Post`/`Delete` — dispara
  `[[TU_TABELAS]]`/`[[TD_TABELAS]]`, ambas sem regra específica para `Tipo=182`.

---

## 1) Conceito

| Termo | Definição |
|-------|-----------|
| Combo rotulado "Ativo" no `.dfm`, mas nomeado `cbSexo` no código — **resíduo de nome de tela copiada** | Achado de qualidade de código: o componente `cbSexo: TcxComboBox` (nome sugere filtro de Sexo do animal) na verdade filtra o campo `Ativa` (`S`/`N`) com itens "QUALQUER"/"SIM"/"NÃO" (`Caption` do grupo no `.dfm` é " Ativo ", não "Sexo") — forte indício de que esta tela foi copiada de outra tela do módulo que tinha um filtro de Sexo, e o nome do componente não foi atualizado ao mudar seu propósito. Não afeta o comportamento (o filtro funciona corretamente sobre `Ativa`), é puramente um achado de nomenclatura/manutenibilidade. |
| Botões "Imprimir" e "Aplicar" existem na tela mas estão **permanentemente desabilitados e sem handler** | `btnImprimir`/`btnAplicar` têm `Enabled = False` fixo no `.dfm`, e **nenhum `OnClick` é declarado** para eles no `.pas` (não aparecem na lista de `procedure` da classe) — funcionalidade planejada mas nunca implementada, mesmo padrão de "botão morto" já visto em `[[VisBrincoRep]]` (lá era `btnAlterar`, aqui são 2 botões). |
| Nova Avaliação inicia sempre como "Inativa" | `cdsCadastroAfterInsert`: `cdsCadastro.FieldByName('Ativa').AsString := 'N'` — o usuário precisa marcar manualmente o checkbox "Ativo" para ativar o novo registro; não é o padrão oposto (ativo por padrão) visto em outros cadastros do ERP. |
| Código do Escore é gerado automaticamente por `LoadSequencia`, escopado por `Tipo` | `cdsCadastroBeforePost`: `LoadSequencia('Tabelas', 'Codigo', 'Tipo', '182')` — variante do helper `LoadSequencia` com 2 parâmetros extras (nome da coluna de escopo + valor), diferente do uso simples de 2 parâmetros visto em `[[MSxPVMetas]]`/`[[PrevisoesGPD]]` — aqui a sequência é seguramente escopada para não colidir com códigos de outros `Tipo` na mesma tabela `Tabelas`. |
| Não há campo numérico calculado nesta tela — arredondamento/sinal não se aplicam | Confirmado por releitura completa (2026-09-02): esta tela é um CRUD puro de tabela de domínio (`Codigo`/`Descricao`/`Mascara`/`Ativa`), sem nenhuma fórmula de peso, escore ou percentual computada em código Delphi (nenhum `RoundTo`/`SimpleRoundTo`/`Round`/`Trunc`/`FormatFloat` na unit). `Codigo` (Escore) é apenas sequência inteira gerada por `LoadSequencia`, não um valor calculado a partir de outros campos — não há, portanto, questão de arredondamento ou aceitação de valor negativo a documentar aqui. |
| Controle de permissão de somente-leitura usa `cdsCadastro.Tag = 10831` | `FormShow`: `cdsCadastro.ReadOnly := NOT TemPermissao(cdsCadastro.Tag, __sUsuario)` — o código de permissão consultado é o `Tag` do próprio `TClientDataSet` (`10831`, fixado no `.dfm`), não um valor calculado em runtime; se o usuário não tiver essa permissão cadastrada, a grade abre em modo somente-leitura (navegador/edição inline continuam visíveis, mas `Post`/`Insert`/`Delete` falham ao tentar alterar um dataset `ReadOnly`). |

---

## 2) Dicionário de campos da tela (`.dfm`)

| Controle | Classe | Rótulo/Caption | Vinculado a (campo BD) | Obrigatório | Observações |
|---|---|---|---|---|---|
| `teDescricao` | `TcxTextEdit` | (grupo "Critérios de Seleção" → "Descrição") | filtro apenas (`LIKE`, case-insensitive via `Upper`) | Não | — |
| `teMascara` | `TcxTextEdit` | (grupo "Condição") | filtro apenas (`LIKE`, case-insensitive) | Não | — |
| `cbSexo` | `TcxComboBox` | " Ativo " (nome do componente é resíduo — ver Conceito) | filtro apenas, sobre `Ativa` | Não | Itens: "QUALQUER" (padrão, índice 0, sem filtro) / "SIM" / "NÃO". |
| `btnConsulta` | `TcxButton` | "Consultar" | — | — | — |
| `btnExcel` | `TcxButton` | "Exportar" | — | — | — |
| `btnImprimir`/`btnAplicar` | `TcxButton` | "Imprimir" / "Aplicar" | — | — | **Permanentemente desabilitados, sem handler** — funcionalidade não implementada. |
| Grid `gdCadastroDBTableView1` (colunas) | `TcxGridDBColumn` | "Escore" / "Condição" / "Descrição" / "Ativo" | `Codigo` (formato inteiro `'0'`) / `Mascara` / `Descricao` / `Ativa` (checkbox `S`/`N`) | Ver BR-001 a BR-003 | — |

---

## 5) Jornada do usuário + Especificação funcional

### SP-01 — Abrir a tela (`FormShow`)
Aplica permissão de somente-leitura (`cdsCadastro.ReadOnly := NOT TemPermissao(cdsCadastro.Tag=10831, __sUsuario)`
— ver Conceito); `cbSexo` (filtro Ativo) inicia em "QUALQUER"; executa consulta inicial sem filtros de texto.

### SP-02 — Filtrar (`btnConsultaClick`)
`SELECT Codigo, Tipo, Descricao, Mascara, Ativa FROM Tabelas WHERE Tipo=182 [AND Descricao LIKE
'%...%'] [AND Mascara LIKE '%...%'] [AND Ativa = 'S'/'N'] ORDER BY Codigo`.

### SP-03 — Incluir/Editar/Excluir na grade (navegador `dnNavega`, atalhos F3/F4/F5/F6/F7)

**Pseudocódigo fiel:**
```
ao inserir novo registro:
  focar a grade, coluna "Condição" (Mascara) com seleção
  Ativa := 'N'  (padrão inativo)

ao gravar (Post):
  se Descricao (trim) = '': avisar "Indique a Descrição." e abortar
  se Mascara é nula: avisar "Indique a Condição." e abortar
  se Ativa é nula: avisar "Selecione se está ativo ou não." e abortar
  se é Inclusão:
    Codigo := LoadSequencia('Tabelas', 'Codigo', escopado por Tipo=182)
    Tipo := 182
  // ApplyUpdates via provider grava o INSERT/UPDATE real (dispara TU_TABELAS se Edição)
  CommitTransacaoTabelas(...)

ao excluir:
  confirmar "Deseja Realmente Excluir o Registro Selecionado?"
  se confirmado: prosseguir (dispara TD_TABELAS — sem regra específica para Tipo=182)
  senão: abortar
```

### SP-04 — Exportar para Excel (`btnExcelClick`)

### 5.3 Regras de negócio e validações

#### BR-001 — Descrição obrigatória
- **Mensagem:** "Indique a Descrição."

#### BR-002 — Condição (Mascara) obrigatória
- **Mensagem:** "Indique a Condição."

#### BR-003 — Flag Ativo/Inativo obrigatório (não nulo)
- **Mensagem:** "Selecione se está ativo ou não."
- **Achado**: como o campo é um checkbox (`S`/`N`) e o novo registro já inicia com `Ativa='N'`
  (ver Conceito), esta validação **nunca falha na prática** para novos registros — só seria
  relevante se o valor pudesse ficar nulo por algum outro caminho não coberto nesta unit.

#### BR-004 — Exclusão de Avaliação em uso não é bloqueada no banco
- **Achado:** ver `[[TD_TABELAS]]` — `Tipo=182` não tem bloco de validação de integridade
  referencial; mesma situação já documentada para `Tipo=222` em `[[EscoresConsMetas]]`.

---

## 6) Integrações e dados

### 6.1 Integrações (internas)

Nenhuma navegação para outras telas — cadastro autocontido, acessado a partir do menu do módulo
Pecuária (`iniModuloPecuaria.pas`, ainda não lido nesta sessão). **Consumidor desta tabela ainda
não identificado.**

### 6.2 Modelo de dados

**Tabela `Tabelas`** (genérica, `Tipo=182` = Avaliação Corporal):

| Coluna | Tipo (Delphi/inferido) | Papel nesta tela |
|---|---|---|
| `Codigo` | `TIntegerField` (persistente) — `int` (alta confiança) | Escore — gerado por `LoadSequencia` escopado por `Tipo`. |
| `Tipo` | `TIntegerField` (persistente) — `int` (alta confiança) | Fixado em `182` na inclusão. |
| `Descricao` | `TStringField` (persistente, `FixedChar=True`) — `char(200)`/`varchar(200)` (tamanho confirmado no `.dfm`: `sqlCadastroDescricao.Size = 200`) | Descrição do nível de avaliação. |
| `Mascara` | `TStringField` (persistente, `FixedChar=True`) — `char(10)`/`varchar(10)` (tamanho confirmado no `.dfm`: `sqlCadastroMascara.Size = 10`) | "Condição" — texto/expressão associada ao Escore, limitado a 10 caracteres; formato exato não confirmável sem o consumidor. |
| `Ativa` | `TStringField` (persistente, checkbox `S`/`N`, `FixedChar=True`) — `char(1)` (tamanho confirmado: `sqlCadastroAtiva.Size = 1`) | Flag de ativação — novo registro inicia `'N'`. |

### 6.3 Triggers e Procedures do banco

- **`[[TU_TABELAS]]`**/**`[[TD_TABELAS]]`** (genéricas, já documentadas) — sem regra específica
  para `Tipo=182`.
- `TI_TABELAS` (trigger de `INSERT`) **não existe** (confirmado em `[[ExportaDietas]]`).

---

## 7) Suporte: FAQ, mensagens, erros e troubleshooting

### 7.2 Catálogo de mensagens e erros

| Mensagem exata | Causa |
|---|---|
| "Indique a Descrição." | BR-001 |
| "Indique a Condição." | BR-002 |
| "Selecione se está ativo ou não." | BR-003 |
| "Deseja Realmente Excluir o Registro Selecionado?" | Confirmação de exclusão |

---

## 9) Notas de revisão

- **2026-09-02** (auditoria de profundidade campo-a-campo — módulo Pecuária)
  - **O que foi verificado:** releitura 100% literal de `Pecuaria/AvalCorporal.pas` (218 linhas) e
    `Pecuaria/AvalCorporal.dfm` (807 linhas) nesta sessão, com foco nos 4 pontos do checklist de
    profundidade: (a) dicionário de campos/colunas de grade completo; (b) fórmulas de cálculo com
    citação explícita de arredondamento/sinal; (c) caminho de menu confirmado; (d) satélites
    referenciados.
  - **Conclusão:** dicionário de campos (seção 2) já estava exaustivo — todos os controles do
    `.dfm` (`teDescricao`, `teMascara`, `cbSexo`, `btnConsulta`, `btnExcel`, `btnImprimir`,
    `btnAplicar`, as 4 colunas do grid `gdCadastroDBTableView1`) já constavam, incluindo os 2
    botões permanentemente desabilitados/sem handler. Não há campo `Visible=False` oculto na
    `.dfm`. Confirmado que a tela **não possui nenhuma fórmula de cálculo** (peso/escore/percentual)
    — é um CRUD puro sobre `Tabelas.Tipo=182` — portanto a exigência de citar `RoundTo`/
    `SimpleRoundTo`/aceitação de negativo não se aplica; isso foi declarado explicitamente na nova
    linha da seção 1 (Conceito), pois a nota anterior não deixava essa ausência explícita.
    Caminho de menu reconfirmado em `iniModuloPecuaria.pas` linha 138 (`sReferencia = 'AvalCorporal'`
    → `Application.CreateForm(TfmAvalCorporal, ...)`, sem parâmetro de contexto) e batendo com
    `[[iniModuloPecuaria]]` seção 6.1. Não há satélite chamado por esta tela.
  - **Gaps reais encontrados e corrigidos:** (1) tamanhos dos campos `Descricao` (`Size=200`),
    `Mascara` (`Size=10`) e `Ativa` (`Size=1`) não estavam citados na seção 6.2 — adicionados a
    partir do `.dfm` (`TStringField.Size`, todos `FixedChar=True`); (2) o código de permissão
    (`cdsCadastro.Tag = 10831`) usado em `TemPermissao` no `FormShow` não estava documentado —
    adicionado na seção 1 (Conceito) e referenciado em SP-01.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** código-fonte `Pecuaria/AvalCorporal.pas` + `.dfm`; `Pecuaria/iniModuloPecuaria.pas`
    linha 138; `[[iniModuloPecuaria]]`.

- **2026-08-27** (criação da nota — módulo Pecuária)
  - **O que mudou:** nota criada do zero, a partir de leitura 100% literal de
    `Pecuaria/AvalCorporal.pas` (218 linhas) + `.dfm` (título confirmado "Avaliação Corporal dos
    Animais"). Documentado o cadastro de `Tabelas.Tipo=182`, confirmado como domínio **distinto**
    de `[[EscoresConsMetas]]` (`Tipo=222`). Achados: nome de componente `cbSexo` resíduo de tela
    copiada (filtra `Ativa`, não Sexo), botões "Imprimir"/"Aplicar" permanentemente desabilitados
    e sem handler (funcionalidade não implementada), novo registro inicia inativo.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** código-fonte `Pecuaria/AvalCorporal.pas` + `.dfm`; ver `[[EscoresConsMetas]]`,
    `[[TU_TABELAS]]`, `[[TD_TABELAS]]`.
