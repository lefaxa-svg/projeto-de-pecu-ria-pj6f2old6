> **Nota de método**: este documento descreve uma tela de um sistema LEGADO já em produção,
> reconstruída por engenharia reversa do código-fonte — não é uma especificação de feature nova
> obtida por entrevista com um PO. Por isso, toda seção que normalmente viria de uma conversa de
> negócio (motivação, métricas, objetivos) foi preenchida por **inferência a partir do
> comportamento do código**, e está marcada explicitamente como `(inferência)`. Onde nem o código
> nem o contexto do módulo permitem inferir nada com segurança, o campo está como `N/A`.
> Fonte: leitura 100% literal de `Pecuaria/FaixaEtaria.pas` (220 linhas, unit `FaixaEtaria`,
> classe `TfmFaixaEtaria`) e do `.dfm` correspondente (título confirmado "Cadastro de Faixa
> Etária"), nesta sessão — 13º arquivo `.pas` lido do módulo Pecuária. **Quarta tela do mesmo
> padrão de cadastro CRUD em grade sobre `Tabelas`** (após `[[EscoresConsMetas]]` `Tipo=222`,
> `[[AvalCorporal]]` `Tipo=182` e `[[CausaMortis]]` `Tipo=180`), aqui `Tipo=185`. Triggers
> genéricas `[[TU_TABELAS]]`/`[[TD_TABELAS]]` (já documentadas) aplicam-se — `Tipo=185` **não
> tem** bloco de validação específico em nenhuma das duas. Ver nota de método completa (limitação
> de DDL/tipos de coluna) em `[[ExportaDietas]]`, válida para todo o módulo.

---

**Status da implementação:** Legado — em produção (documentado via engenharia reversa, sem item de trabalho associado)

**Owner (curadoria):** @jefferson.arantes
**Tags:** #Pecuaria #Cadastro #FaixaEtaria

---

## 0) Resumo executivo

- **O que é:** cadastro em grade "Cadastro de Faixa Etária" — registros de `Tabelas.Tipo=185`,
  cada um definindo uma faixa numérica de idade (`FaixaIdadeIni`/`FaixaIdadeFinal`) com rótulos de
  texto livre para o início e o fim da faixa (`De`/`Ate`, ex.: "De 0 até 12 meses").
- **Quando usar (inferência):** configurado uma vez por protocolo, para segmentar o rebanho por
  faixa etária. **Consumidor confirmado**: `[[spTransfAnimaisPec]]` recalcula a Faixa Etária do
  animal na transferência (opção "Faixa Etária" de `[[TransfBrincos]]`, `@AtuaFxEtaria='S'`).
- **Impacto principal:** CRUD em `Tabelas` (`Tipo=185`) via `ClientDataSet.Post`/`Delete` — dispara
  `[[TU_TABELAS]]`/`[[TD_TABELAS]]`, ambas sem regra específica para `Tipo=185`.

---

## 1) Conceito

| Termo | Definição |
|-------|-----------|
| Rótulos de texto ("De"/"Até") vêm pré-preenchidos com texto genérico na inclusão | `cdsFaixaEtariaAfterInsert`: `De := 'De'`, `Ate := 'Até'` — o usuário deve editar manualmente para o texto real (ex.: "0 meses"/"12 meses"); não são gerados a partir dos valores numéricos de `FaixaIdadeIni`/`FaixaIdadeFinal`, são campos de texto livre independentes. |
| Filtro por faixa usa 2 campos numéricos, mas a lógica de comparação é assimétrica em relação ao nome | `btnConsultaClick`: se ambos `ceFaixaInicial`/`ceFaixaFinal` forem `>0`, filtra `FaixaIdadeIni >= ceFaixaInicial AND FaixaIdadeFinal <= ceFaixaFinal` — ou seja, busca faixas cadastradas **inteiramente contidas** dentro do intervalo informado, não faixas que meramente se sobrepõem a ele `(inferência sobre a intenção; comportamento literal confirmado)`. |
| Botão "Imprimir" está **habilitado** no `.dfm` mas não tem nenhum `OnClick` declarado no código | Diferente do padrão "botão desabilitado" visto em `[[AvalCorporal]]`/`[[CausaMortis]]`/`[[VisBrincoRep]]` — aqui `btnImprimir.Enabled` não é `False` (habilitado por padrão), porém `btnImprimirClick` **não existe** entre os `procedure` da classe `TfmFaixaEtaria` — clicar no botão não produz nenhum efeito. `btnAplicar`, por sua vez, segue o padrão já visto: `Enabled = False` fixo no `.dfm` e também sem handler. |

---

## 2) Dicionário de campos da tela (`.dfm`)

| Controle | Classe | Rótulo/Caption | Vinculado a (campo BD) | Obrigatório | Observações |
|---|---|---|---|---|---|
| `ceFaixaInicial` | `TcxCurrencyEdit` | (grupo "De Faixa Inicial") | filtro apenas | Não | Só aplica filtro se ambos os campos forem `>0`. |
| `ceFaixaFinal` | `TcxCurrencyEdit` | (grupo "Até Faixa Final") | filtro apenas | Não | Idem. |
| `btnConsulta` | `TcxButton` | "Consultar" | — | — | — |
| `btnExcel` | `TcxButton` | "Exportar" | — | — | — |
| `btnImprimir` | `TcxButton` | "Imprimir" | — | — | **Habilitado, mas sem `OnClick` declarado** — não implementado (achado). |
| `btnAplicar` | `TcxButton` | "Aplicar" | — | — | **Permanentemente desabilitado, sem handler** — não implementado. |
| Grid `gdFaixaEtariaDBTableView1` (colunas) | `TcxGridDBColumn` | "Código" / "Inicial" / "Até" / "Final" | `Codigo` / `FaixaIdadeIni` / `Ate` / `FaixaIdadeFinal` | Ver BR-001/BR-002 | Coluna "De" (rótulo de texto do início) não está entre as colunas do grid listadas no `.dfm` — apenas "Inicial" (numérico) é exibida; o campo de texto `De` existe no dataset mas não tem coluna própria confirmada nesta leitura. |

---

## 5) Jornada do usuário + Especificação funcional

### SP-01 — Abrir a tela (`FormShow`)
Executa consulta inicial sem filtros de faixa.

### SP-02 — Filtrar (`btnConsultaClick`)
```
SELECT Codigo, Tipo, 'De' De, FaixaIdadeIni, 'Até' Ate, FaixaIdadeFinal
FROM Tabelas WHERE Tipo = 185
[AND FaixaIdadeIni >= ceFaixaInicial AND FaixaIdadeFinal <= ceFaixaFinal]  -- só se ambos > 0
```
**Achado:** os literais `'De'` e `'Até'` são gerados na própria consulta SQL como apelidos de
coluna, não lidos da tabela — mas os nomes de coluna do dataset (`sqlFaixaEtariaDe`/
`sqlFaixaEtariaAte`) são `TStringField`s reais e distintos dos literais da consulta; a
inconsistência entre o SQL literal (`'De' De`) e os campos declarados (`De`, `Ate` como colunas de
`Tabelas`) sugere que o SQL da consulta está **incorreto/vestigial** — deveria provavelmente
selecionar as colunas reais `De`/`Ate` da tabela, não literais fixos. Isso significa que **o
resultado da consulta sempre mostra "De"/"Até" como texto fixo em vez do conteúdo real dos
registros**, mesmo que o usuário tenha digitado rótulos customizados na inclusão/edição — achado
de risco relevante.

### SP-03 — Incluir/Editar/Excluir na grade (navegador `dnNavega`, atalhos F3/F4/F5/F6/F7)

**Pseudocódigo fiel:**
```
ao inserir novo registro:
  focar a grade, coluna "Inicial" (FaixaIdadeIni) com seleção
  De := 'De'
  Ate := 'Até'

ao gravar (Post):
  se FaixaIdadeIni < 0: avisar "Indique a Faixa de Idade Inicial." e abortar
  senão se FaixaIdadeFinal <= 0: avisar "Indique a Faixa de Idade Final." e abortar
  senão se é Inclusão:
    Codigo := LoadSequencia('Tabelas', 'Codigo', escopado por Tipo=185)
    Tipo := 185
  // ApplyUpdates via provider grava o INSERT/UPDATE real (dispara TU_TABELAS se Edição)
  CommitTransacaoTabelas(...)

ao excluir:
  confirmar "Deseja Realmente Excluir o Registro Selecionado?"
  se confirmado: prosseguir (dispara TD_TABELAS — sem regra específica para Tipo=185)
  senão: abortar
```

### SP-04 — Exportar para Excel (`btnExcelClick`)

### 5.3 Regras de negócio e validações

#### BR-001 — Faixa de Idade Inicial não pode ser negativa
- **Mensagem:** "Indique a Faixa de Idade Inicial."
- **Achado:** a validação é `< 0` (não `<= 0`), então `FaixaIdadeIni = 0` é aceito (faz sentido
  para representar "desde o nascimento").

#### BR-002 — Faixa de Idade Final obrigatória e maior que zero
- **Mensagem:** "Indique a Faixa de Idade Final."

#### BR-003 — Nenhuma validação de que `FaixaIdadeFinal > FaixaIdadeIni`
- **Achado:** é possível cadastrar uma faixa "invertida" (ex.: Inicial=12, Final=6) sem bloqueio.

#### BR-004 — Nenhuma validação de sobreposição entre faixas
- **Achado:** é possível cadastrar múltiplas faixas com intervalos numéricos sobrepostos — não há
  checagem de unicidade/consistência entre registros.

#### BR-005 — Exclusão de Faixa Etária em uso não é bloqueada no banco
- **Achado:** ver `[[TD_TABELAS]]` — `Tipo=185` não tem bloco de validação de integridade
  referencial; mesma situação já documentada para `Tipo=180`/`182`/`222`.

---

## 6) Integrações e dados

### 6.1 Integrações (internas)

Nenhuma navegação para outras telas — cadastro autocontido. Caminho de menu confirmado em
`[[iniModuloPecuaria]]` (item `FaixaEtaria`, sem parâmetro de contexto). **Consumidor confirmado
(auditoria 2026-09-08): `[[spTransfAnimaisPec]]`** — se `@AtuaFxEtaria='S'` (opção "Faixa Etária"
de `[[TransfBrincos]]`), recalcula a Faixa Etária do animal transferido buscando em
`Tabelas WHERE Tipo=185 AND DATEDIFF(MONTH, Nascimento, Data) BETWEEN FaixaIdadeIni AND
FaixaIdadeFinal`.

### 6.2 Modelo de dados

**Tabela `Tabelas`** (genérica, `Tipo=185` = Faixa Etária):

| Coluna | Tipo (Delphi/inferido) | Papel nesta tela |
|---|---|---|
| `Codigo` | `TIntegerField` (persistente) — `int` (alta confiança) | Chave — gerada por `LoadSequencia` escopada por `Tipo`. |
| `Tipo` | `TIntegerField` (persistente) — `int` (alta confiança) | Fixado em `185` na inclusão. |
| `De` | `TStringField` (persistente) — `varchar` (alta confiança) | Rótulo textual do início da faixa — **porém a consulta de listagem (SP-02) sempre retorna o literal `'De'`, não o valor real da coluna** (achado de risco). |
| `Ate` | `TStringField` (persistente) — `varchar` (alta confiança) | Rótulo textual do fim da faixa — mesmo achado que `De`. |
| `FaixaIdadeIni` | `TIntegerField` (persistente) — `int` (alta confiança) | Início numérico da faixa (unidade não especificada no código — provavelmente meses, `(inferência)`). |
| `FaixaIdadeFinal` | `TIntegerField` (persistente) — `int` (alta confiança) | Fim numérico da faixa. |

### 6.3 Triggers e Procedures do banco

- **`[[TU_TABELAS]]`**/**`[[TD_TABELAS]]`** (genéricas, já documentadas) — sem regra específica
  para `Tipo=185`.
- `TI_TABELAS` (trigger de `INSERT`) **não existe** (confirmado em `[[ExportaDietas]]`).

---

## 7) Suporte: FAQ, mensagens, erros e troubleshooting

### 7.2 Catálogo de mensagens e erros

| Mensagem exata | Causa |
|---|---|
| "Indique a Faixa de Idade Inicial." | BR-001 |
| "Indique a Faixa de Idade Final." | BR-002 |
| "Deseja Realmente Excluir o Registro Selecionado?" | Confirmação de exclusão |

---

## 9) Notas de revisão

- **2026-09-08** (auditoria campo-a-campo — módulo Pecuária)
  - **O que mudou:** caminho de menu confirmado via `[[iniModuloPecuaria]]`; dicionário de campos
    e achado de bug SQL (literais `'De'`/`'Até'`) revisados e confirmados sem mudanças.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** ver `[[iniModuloPecuaria]]`.

- **2026-09-08** (auditoria campo-a-campo — resolução do consumidor pendente)
  - **O que mudou:** resolvida a dúvida "consumidor não identificado" — confirmado (via leitura de
    `[[spTransfAnimaisPec]]`) que `Tabelas.Tipo=185` é consumida ao transferir animais
    (`[[TransfBrincos]]`, opção "Faixa Etária", `@AtuaFxEtaria='S'`), recalculando a Faixa Etária
    pela idade em meses na data da transferência.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** `[[spTransfAnimaisPec]]`, `[[TransfBrincos]]`.

- **2026-08-28** (criação da nota — módulo Pecuária)
  - **O que mudou:** nota criada do zero, a partir de leitura 100% literal de
    `Pecuaria/FaixaEtaria.pas` (220 linhas) + `.dfm` (título confirmado "Cadastro de Faixa
    Etária"). Documentado o cadastro de `Tabelas.Tipo=185`. Achados: consulta de listagem (SP-02)
    retorna literais fixos `'De'`/`'Até'` em vez do conteúdo real das colunas (possível bug
    vestigial); botão "Imprimir" habilitado mas sem handler (diferente do padrão "desabilitado"
    visto em telas anteriores); sem validação de faixa invertida ou sobreposição; sem
    delete-protection para `Tipo=185` (mesma lacuna já vista em `Tipo=180/182/222`).
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** código-fonte `Pecuaria/FaixaEtaria.pas` + `.dfm`; ver `[[CausaMortis]]`,
    `[[AvalCorporal]]`, `[[EscoresConsMetas]]`, `[[TU_TABELAS]]`, `[[TD_TABELAS]]`.
