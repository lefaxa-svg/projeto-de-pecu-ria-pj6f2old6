> **Nota de método**: este documento descreve uma tela de um sistema LEGADO já em produção,
> reconstruída por engenharia reversa do código-fonte — não é uma especificação de feature nova
> obtida por entrevista com um PO. Por isso, toda seção que normalmente viria de uma conversa de
> negócio (motivação, métricas, objetivos) foi preenchida por **inferência a partir do
> comportamento do código**, e está marcada explicitamente como `(inferência)`. Onde nem o código
> nem o contexto do módulo permitem inferir nada com segurança, o campo está como `N/A`.
> Fonte: leitura 100% literal de `Pecuaria/EdUnidOcupacao.pas` (480 linhas, unit
> `EdUnidOcupacao`, classe `TfmEdUnidOcupacao`) e do `.dfm` correspondente (título confirmado
> "Cadastro de Unidades de Ocupação"), nesta sessão — 48º arquivo `.pas` lido do módulo Pecuária.
> **Esta é a tela de edição de 1 registro `UnidOcupacao`** (Baia ou Pasto) — modal/satélite
> (`iSeq`=0 para novo/>0 para editar; `lblFazenda.Tag`/`lblRetiro.Tag`/`lblTipo.Caption`
> preenchidos pela tela chamadora), chamada por **`[[UnidOcupacao]]`** (`Pecuaria/UnidOcupacao.pas`
> — confirmado por referência a `fmEdUnidOcupacao` no código-fonte; a chamadora já tem nota
> própria) — **corrigido nesta auditoria**, a versão anterior desta nota registrava "chamadora
> ainda não identificada". Dispara `[[TIU_UnidOcupacao]]` (já documentada) ao gravar. Descobre
> `Tabelas.Tipo=168` (Tipo de Capim). Ver nota de método completa (limitação de DDL/tipos de
> coluna) em `[[ExportaDietas]]`, válida para todo o módulo.

---

**Status da implementação:** Legado — em produção (documentado via engenharia reversa, sem item de trabalho associado)

**Owner (curadoria):** @jefferson.arantes
**Tags:** #Pecuaria #UnidOcupacao #Baia #Pasto #Cadastro

---

## 0) Resumo executivo

- **O que é:** formulário de registro único para uma Unidade de Ocupação — que pode ser uma
  **Baia** (confinamento, área em m², com Lado/Rua/Ordem física, Comprimento de Cocho, Forma de
  Uso Convencional/Hospital/Rejeição) ou um **Pasto** (pecuária extensiva, área em Hectares, Tipo
  de Capim, Forma de Uso adicional "Rotacionado") — a tela **adapta seus campos e validações
  dinamicamente** conforme `lblTipo.Caption` recebido da chamadora.
- **Impacto principal:** `INSERT`/`UPDATE` em `UnidOcupacao` — dispara `[[TIU_UnidOcupacao]]`
  (recalcula `Retiros.QtdUnidOcup`, já documentada).

---

## 1) Conceito

| Termo | Definição |
|-------|-----------|
| Sem cálculos, logo sem arredondamento — mas todo campo numérico obrigatório já bloqueia negativo | Esta tela **não tem nenhuma fórmula de cálculo** (nenhum campo é resultado de outro) — confirmado por releitura completa: não há `Round`/`RoundTo`/`SimpleRoundTo`/`Trunc` em nenhum handler. Quanto a sinal: todos os campos numéricos obrigatórios (`Ordem`, `OrdemRua`, `AreaM2`/`AreaHa`, `CapacidadeUA`, `ComprimentoCocho`, `TipoCapim`) são validados no `BeforePost` com `<= 0`/`<=0.00` — essa checagem **já bloqueia negativo junto com zero** (diferença notável de outras telas do lote como `[[EdRecepcaoIngredientes]]`, onde os campos de classificação aceitam negativo livremente). Os únicos campos numéricos sem obrigatoriedade (`Funcionario`, `Caminhao`) não têm checagem de sinal, mas são FKs (`>0` esperado pelo domínio, não uma quantidade que faria sentido negativa). |
| A tela é literalmente 2 formulários em 1, alternados por `lblTipo.Caption` | `FormShow`: se `'BAIA'`, habilita Lado/Rua/Ordem da Rua, vincula `ceArea` a `AreaM2`, desabilita o lookup de Tipo de Capim, e popula `cbFormadeUso` com 3 itens (Convencional/Hospital/Rejeição); se `'PASTO'`, desabilita Lado/Rua/Ordem da Rua, vincula `ceArea` a `AreaHa`, habilita o Tipo de Capim, e popula `cbFormadeUso` com 4 itens (+ Rotacionado). Toda a validação em `BeforePost` está **duplicada** entre os 2 ramos (`if lblTipo.Caption='BAIA'` / `else if ='PASTO'`), com apenas pequenas diferenças (Pasto não valida Lado/Rua/Ordem da Rua, mas valida Tipo de Capim). |
| A tela decide sozinha se entra em modo Inserir ou Editar, baseada em `iSeq` | `FormShow`: `if iSeq>0 then Edit else if iSeq=0 then Insert` — diferente do padrão de outras telas do módulo, que usam o navegador (`dnNavega`) para isso; aqui a tela sempre abre já em modo de edição/inserção (nunca em modo de consulta), a menos que `cdsEdUnidOcupacao.ReadOnly=True` (setado externamente pela chamadora). |
| Cancelar uma Inclusão fecha a tela imediatamente | `cdsEdUnidOcupacaoBeforeCancel`: se `State=dsInsert`, chama `Close` — diferente do padrão de permanecer aberto após cancelar uma edição. |
| "Caminhão" reaparece como um lookup de `Bens`, mesmo grupo já visto em outras telas | `cbCaminhao` (lookup, campo `Caminhao`) — mesmo padrão de `[[Misturadores]]`/`[[EdTratosLC]]` (`Bens` do grupo `Parametros.GrupoDistDietasPec`), aqui associado à própria Unidade de Ocupação (não ao Lote/Lançamento) — sugere que cada Baia/Pasto pode ter um caminhão distribuidor de dieta padrão associado. |
| `CodigoFunc` (Funcionário responsável) usa busca F2 padrão do ERP | `ceEdCodFunc`: mesmo padrão de `BuscaPessoa`/`dbDispAjudaPessoa` já visto em dezenas de outras telas do módulo. |

---

## 2) Dicionário de campos da tela (`.dfm`)

| Controle | Classe | Rótulo/Caption | Vinculado a (campo BD) | Obrigatório (Baia/Pasto) | Observações |
|---|---|---|---|---|---|
| `lblFazenda`/`lblRetiro`/`lblTipo` | `TcxLabel` | (contexto) | preenchidos pela chamadora | — | `lblTipo.Caption` = "BAIA" ou "PASTO", controla todo o comportamento da tela. |
| `ceSequencial` | `TcxDBCurrencyEdit` | "Sequencial" | `Sequencial` | — | **Omitido da versão anterior.** Grupo `Enabled=False` + `Properties.ReadOnly=True` — só exibição (chave gerada por `LoadSequencia`). |
| `teCodigo` | `TcxDBTextEdit` | — | `Codigo` | Sim / Sim | — |
| `ceOrdem` | `TcxDBCurrencyEdit` | — | `Ordem` | Sim / Sim | — |
| `teLado`/`teRua`/`ceOrdemRua` | `TcxDBTextEdit`/`TcxDBCurrencyEdit` | — | `Lado`/`Rua`/`OrdemRua` | Sim / Desabilitados | Só aplicável a Baias (posição física). |
| `ceArea` | `TcxDBCurrencyEdit` | (rótulo dinâmico "Área (M²)"/"Área (Ha)") | `AreaM2` ou `AreaHa` (dinâmico) | Sim / Sim | Vínculo de campo trocado em runtime. |
| `ceCapacidade` | `TcxDBCurrencyEdit` | — | `CapacidadeUA` | Sim / Sim | Capacidade em Unidades Animais. |
| `cbEstado` | `TcxDBComboBox` | — | `Estado` | Sim / Sim | `A`(tivo)/`D`(escanso)/`R`(eforma). |
| `cbFormadeUso` | `TcxDBComboBox` | — | `FormaUso` | Sim / Sim | Itens dinâmicos (3 ou 4, ver Conceito). **Confirmado:** `Properties.Items.Strings` está **vazio no `.dfm`** — a lista só existe em runtime, populada por `.Add()` em `FormShow`; abrir a tela sem passar por `FormShow` deixaria o combo sem itens. |
| `ceCompCocho` | `TcxDBCurrencyEdit` | — | `ComprimentoCocho` | Sim / Sim | — |
| `lkTiposCapim` | `TcxDBLookupComboBox` | — | `TipoCapim` | Desabilitado / Sim | `Tabelas.Tipo=168`, só aplicável a Pastos. |
| `ckCochoCoberto`/`ckSombra`/`ckArracoar`/`ckSalgar` | `TcxDBCheckBox` | — | `CochoCoberto`/`Sombra`/`Arracoar`/`Salgar` | Não | — |
| `ceEdCodFunc` | `TcxDBCurrencyEdit` | — | `Funcionario` | Não | Busca F2. |
| `cbCaminhao` | `TcxDBLookupComboBox` | — | `Caminhao` | Não | Lookup de `Bens` (grupo `GrupoDistDietasPec`). |

---

## 5) Jornada do usuário + Especificação funcional

### SP-01 — Abrir a tela (`FormShow`)
Carrega Caminhões (`Bens`); carrega o registro (`UnidOcupacao WHERE Sequencial=<iSeq>`, mesmo se
`iSeq=0`, resultando em dataset vazio); adapta campos/validações conforme `lblTipo.Caption`;
carrega Tipos de Capim (`Tabelas.Tipo=168`); entra em modo Editar (`iSeq>0`) ou Inserir
(`iSeq=0`), se não somente-leitura.

### SP-02 — Gravar (`cdsEdUnidOcupacaoBeforePost`)

**Pseudocódigo fiel (ramo BAIA):**
```
AreaHa := 0.00 (zerada, o campo relevante é AreaM2)
se Codigo vazio: avisar "Indique um Código." e abortar
senão se Ordem <= 0: avisar "Indique uma Ordem." e abortar
senão se Lado vazio: avisar "Indique um Lado." e abortar
senão se Rua vazia: avisar "Indique uma Rua." e abortar
senão se OrdemRua <= 0: avisar "Indique uma Ordem da Rua." e abortar
senão se AreaM2 <= 0: avisar "Indique uma Área (Metros Quadrados)." e abortar
senão se CapacidadeUA <= 0: avisar "Indique uma Capacidade." e abortar
senão se Estado vazio: avisar "Indique um Estado." e abortar
senão se FormaUso vazia: avisar "Indique uma Forma de Uso." e abortar
senão se ComprimentoCocho <= 0: avisar "Indique um Comprimento para o Cocho." e abortar
```

**Pseudocódigo fiel (ramo PASTO):** idêntico, exceto: não valida Lado/Rua/OrdemRua; usa `AreaHa`
em vez de `AreaM2`; adiciona validação de `TipoCapim > 0` ("Indique um Tipo de Capim.").

**Comum a ambos, ao final:**
```
se é Inclusão:
  Sequencial := LoadSequencia('UnidOcupacao', 'Sequencial')
  Safra := _iSafra; Fazenda := lblFazenda.Tag; Retiro := lblRetiro.Tag
  Tipo := primeiro caractere de lblTipo.Caption ('B' ou 'P')
// ApplyUpdates via provider grava o INSERT/UPDATE real (dispara TIU_UnidOcupacao)
CommitTransacaoTabelas(...)
```

### SP-03 — Excluir (`cdsEdUnidOcupacaoBeforeDelete`)
Confirmação padrão; sem checagem de dependências (Lotes vinculados) nesta unit.

### 5.3 Regras de negócio e validações

Ver Pseudocódigo acima — 10 validações para Baia, 11 para Pasto (BR-001 a BR-011, mensagens
listadas na tabela abaixo).

---

## 6) Integrações e dados

### 6.1 Integrações (internas)

- **`[[UnidOcupacao]]`** — tela chamadora (listagem de Unidades de Ocupação).
- **`Tabelas.Tipo=168`** (Tipo de Capim, novo domínio descoberto) — só relevante para Pastos.
- **`Bens`**/**`Parametros.GrupoDistDietasPec`** — Caminhão associado.
- **`[[TIU_UnidOcupacao]]`** — já documentada, mantém `Retiros.QtdUnidOcup` sincronizado.

### 6.2 Modelo de dados

**Tabela `UnidOcupacao`** (central — Baia ou Pasto):

| Coluna | Tipo (Delphi/inferido) | Papel nesta tela |
|---|---|---|
| `Sequencial` | `TIntegerField` (persistente) — `int` (alta confiança) | Chave — gerada por `LoadSequencia`. |
| `Codigo` | `TStringField` (persistente) — `varchar` (alta confiança) | Identificador da U.O. |
| `Ordem` | `TIntegerField` (persistente) — `int` (alta confiança) | Ordem de exibição/física. |
| `Lado`/`Rua`/`OrdemRua` | `TStringField`/`TStringField`/`TIntegerField` (persistente) — `varchar`/`varchar`/`int` (alta confiança) | Posição física — só para Baias. |
| `Safra`/`Fazenda`/`Retiro` | `TIntegerField` (persistente) — `int` (alta confiança) | Escopo, fixados na inclusão. |
| `Tipo` | `TStringField` (persistente) — `char(1)` (alta confiança) | `B`(aia)/`P`(asto), fixado na inclusão a partir de `lblTipo.Caption`. |
| `AreaM2`/`AreaHa` | `TFMTBCDField` (persistente) — `decimal`/`numeric` (alta confiança) | Um dos 2 é sempre zerado conforme o Tipo. |
| `CapacidadeUA` | `TIntegerField` (persistente) — `int` (alta confiança) | Capacidade em Unidades Animais. |
| `Estado` | `TStringField` (persistente, `GetText`/`SetText` customizados) — `char(1)` (alta confiança) | `A`/`D`/`R` — Ativo/Descanso/Reforma. |
| `FormaUso` | `TStringField` (persistente, `GetText`/`SetText` customizados) — `char(1)` (alta confiança) | `C`/`R`/`H`/`J` — Convencional/Rotacionado/Hospital/Rejeição. |
| `ComprimentoCocho` | `TFMTBCDField` (persistente) — `decimal`/`numeric` (alta confiança) | — |
| `CochoCoberto`/`Sombra`/`Arracoar`/`Salgar` | `TStringField` (persistente, checkbox) — `char(1)` (alta confiança) | — |
| `TipoCapim` | `TIntegerField` (persistente) — `int` (alta confiança) | FK para `Tabelas.Codigo` (`Tipo=168`) — só para Pastos. |
| `Funcionario` | `TIntegerField` (persistente) — `int` (alta confiança) | FK para `Pessoas.Codigo`. |
| `Caminhao` | `TIntegerField` (persistente) — `int` (alta confiança) | FK para `Bens.Codigo`. |

### 6.3 Triggers e Procedures do banco

- **`[[TIU_UnidOcupacao]]`** (já documentada).

---

## 7) Suporte: FAQ, mensagens, erros e troubleshooting

### 7.2 Catálogo de mensagens e erros

| Mensagem exata | Causa |
|---|---|
| "Indique um Código." | BR-001 |
| "Indique uma Ordem." | BR-002 |
| "Indique um Lado." / "Indique uma Rua." / "Indique uma Ordem da Rua." | BR-003/004/005 (só Baia) |
| "Indique uma Área (Metros Quadrados)." / "Indique uma Área (Hectares)." | BR-006 (dinâmica) |
| "Indique uma Capacidade." | BR-007 |
| "Indique um Estado." | BR-008 |
| "Indique uma Forma de Uso." | BR-009 |
| "Indique um Comprimento para o Cocho." | BR-010 |
| "Indique um Tipo de Capim." | BR-011 (só Pasto) |
| "Funcionário não Cadastrado" | Busca de Funcionário sem correspondência |
| "Ocorreu um Erro na Gravação da Unidade de Ocupação." | Falha em `CommitTransacaoTabelas` |
| "Deseja Realmente Excluir o Registro Selecionado?" | Confirmação de exclusão |

---

## 9) Notas de revisão

- **2026-09-02** (auditoria de profundidade — releitura completa do `.pas`/`.dfm`)
  - **O que mudou:** dicionário de campos (seção 2) ganhou `ceSequencial` (omitido, só-leitura) e
    a confirmação de que `cbFormadeUso.Properties.Items.Strings` está vazio no `.dfm` (populado só
    em runtime por `FormShow`). Corrigida a tela chamadora: identificada como `[[UnidOcupacao]]`
    (referência a `fmEdUnidOcupacao` confirmada no código-fonte), que já tem nota própria — a
    versão anterior registrava "chamadora ainda não identificada". Confirmado e citado
    explicitamente (seção 1): esta tela não tem nenhuma fórmula de cálculo (sem
    `Round`/`RoundTo`/`Trunc`), e todos os campos numéricos obrigatórios já bloqueiam negativo
    junto com zero via checagem `<=0` no `BeforePost` — dicionário/BR já estavam corretos quanto a
    isso, só faltava a declaração explícita pedida pelo padrão de profundidade do módulo. Fora
    esses gaps pontuais, a nota já estava exaustiva (dual Baia/Pasto, triggers, modelo de dados).
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** releitura de `Pecuaria/EdUnidOcupacao.pas` (480 linhas) e `.dfm` (~800 linhas)
    completos nesta sessão; `Pecuaria/UnidOcupacao.pas` para a chamadora.

- **2026-08-28** (criação da nota — módulo Pecuária)
  - **O que mudou:** nota criada do zero, a partir de leitura 100% literal de
    `Pecuaria/EdUnidOcupacao.pas` (480 linhas) + `.dfm` (título confirmado "Cadastro de Unidades
    de Ocupação"). Documentado o formulário dual Baia/Pasto, com validações e vínculos de campo
    adaptados dinamicamente conforme `lblTipo.Caption`. Descoberto `Tabelas.Tipo=168` (Tipo de
    Capim).
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** código-fonte `Pecuaria/EdUnidOcupacao.pas` + `.dfm`;
    `[[TIU_UnidOcupacao]]`; ver `[[Misturadores]]`, `[[EdTratosLC]]` (padrão de Caminhão via
    `Bens`).
