> **Nota de método**: este documento descreve uma tela de um sistema LEGADO já em produção,
> reconstruída por engenharia reversa do código-fonte — não é uma especificação de feature nova
> obtida por entrevista com um PO. Por isso, toda seção que normalmente viria de uma conversa de
> negócio (motivação, métricas, objetivos) foi preenchida por **inferência a partir do
> comportamento do código**, e está marcada explicitamente como `(inferência)`. Onde nem o código
> nem o contexto do módulo permitem inferir nada com segurança, o campo está como `N/A`.
> Fonte: leitura 100% literal de `Pecuaria/EscoresConsMetas.pas` (213 linhas, unit
> `EscoresConsMetas`, classe `TfmEscoresConsMetas`) e do `.dfm` correspondente (título confirmado
> "Escores de Consumo x Meta"), nesta sessão — 7º arquivo `.pas` lido do módulo Pecuária.
> **Gêmea estrutural de `[[MSxPVMetas]]`** — mesmo padrão de cadastro CRUD em grade sobre o
> domínio genérico `Tabelas` (aqui `Tipo=222`, lá gravando em tabela própria `MSxPVMetaConsumo`).
> Triggers de `UPDATE`/`DELETE` em `Tabelas` (`TU_TABELAS`/`TD_TABELAS`, infraestrutura genérica
> de todo o ERP) lidas integralmente e documentadas em notas próprias — `Tipo=222` (Escore) **não
> tem** validação de exclusão nessas triggers (achado de risco registrado em `[[TD_TABELAS]]`).
> Ver nota de método completa (limitação de DDL/tipos de coluna) em `[[ExportaDietas]]`, válida
> para todo o módulo.

---

**Status da implementação:** Legado — em produção (documentado via engenharia reversa, sem item de trabalho associado)

**Owner (curadoria):** @jefferson.arantes
**Tags:** #Pecuaria #Nutricao #Cadastro #Escore #CondicaoCorporal

---

## 0) Resumo executivo

- **O que é:** cadastro em grade "Escores de Consumo x Meta" — registros de `Tabelas.Tipo=222`,
  cada um com um número de Escore, Descrição, faixa `De`/`Até` (numérica) e uma Cor associada
  (`cxColorComboBox`, campo `Tipos`). Funciona como tabela de domínio para classificação de
  Escore de Condição Corporal (ECC) ou métrica equivalente de consumo, com uma faixa de valores e
  uma cor de destaque visual, usada em relatório gráfico de acompanhamento que colore o valor
  conforme a faixa em que se enquadra.
- **Consumidor confirmado (auditoria 2026-09-08): `[[spGraficosPec01]]`**, chamada por
  `[[GraficosPec]]` (gráfico `GrafEscoresConsMeta`, índice 0) — `JOIN Tabelas E ON C.ConsMeta
  BETWEEN E.Faixa1 AND E.Faixa2 AND E.Tipo=222`, agrupando Lotes por faixa de "Consumo/Meta" em um
  gráfico de barras coloridas. A busca inicial por grep em `.pas` não encontrou o consumidor porque
  o SQL está embutido como propriedade de componente no `.dfm` de `GraficosPec`, não em código
  Delphi — `[[AvalCorporal]]` (candidata descartada anteriormente) usa `Tipo=182`, domínio distinto.
- **Impacto principal:** CRUD padrão em `Tabelas` (`Tipo=222`) via `ClientDataSet.Post`/`Delete`
  — dispara `[[TU_TABELAS]]` (edição) ou `[[TD_TABELAS]]` (exclusão), ambas sem validação
  específica para `Tipo=222`.

---

## 1) Conceito

| Termo | Definição |
|-------|-----------|
| Estrutura e comportamento idênticos a `[[MSxPVMetas]]`, aplicados ao domínio genérico `Tabelas` em vez de uma tabela própria | Mesmo padrão de tela (filtro + grid + navegador CRUD), mesmas mensagens de validação genéricas, mesmo helper `CommitTransacaoTabelas` — mas aqui a chave primária de negócio é `Codigo` (não `Sequencial`), sem geração automática: o próprio usuário digita o "Número do Escore" (BR-001), que se torna o `Codigo` do registro em `Tabelas`. |
| `Tipo` é fixado como `222` apenas em Inclusão, nunca alterável | `cdsCadastroBeforePost`: `else if cdsCadastro.State = dsInsert then cdsCadastro.FieldByName('Tipo').AsInteger := 222` — como `Tipo` não é setado em modo Edição, ele permanece com o valor já persistido (consistente, pois a consulta já filtra `WHERE Tipo=222`). |
| Filtro de consulta é por `Descricao LIKE '%texto%'`, não por Escore/faixa | `btnConsultaClick`: único filtro opcional é texto parcial na Descrição — diferente de `[[MSxPVMetas]]`, que filtra por igualdade exata em 2 campos numéricos. |
| Ordenação padrão é por `Faixa1` (o "De" da faixa), não pelo Código do Escore | `ORDER BY Faixa1` — a listagem é sempre por ordem crescente de faixa, não de número de escore (que pode não coincidir se os escores forem cadastrados fora de ordem). |

---

## 2) Dicionário de campos da tela (`.dfm`)

| Controle | Classe | Rótulo/Caption | Vinculado a (campo BD) | Obrigatório | Observações |
|---|---|---|---|---|---|
| `teDescricao` | `TcxTextEdit` | (grupo "Critérios de Seleção" → "Descrição") | filtro apenas | Não | Busca parcial (`LIKE '%...%'`). |
| `btnConsulta` | `TcxButton` | "Consultar" | — | — | — |
| `btnExcel` | `TcxButton` | "Exportar" | — | — | — |
| Grid `gdCadastroTabela` (colunas) | `TcxGridDBColumn` | "Escore" / "Descrição" / "De" / "Até" / "Cor" | `Codigo` / `Descricao` / `Faixa1` / `Faixa2` / `Tipos` | Ver BR-001 a BR-004 | Coluna "Cor" usa `cxColorComboBox` (seletor visual de cor) — campo `Tipos` (`TIntegerField`) provavelmente armazena um código de cor (`TColor` convertido para inteiro, `(inferência)`, não confirmável sem o schema). |

---

## 5) Jornada do usuário + Especificação funcional

### SP-01 — Abrir a tela (`FormShow`)
Aplica permissão de somente-leitura; executa a consulta inicial sem filtro de descrição.

### SP-02 — Filtrar (`btnConsultaClick`)
`SELECT Tipo, Codigo, Descricao, Faixa1, Faixa2, Mascara, Tipos FROM Tabelas WHERE Tipo=222
[AND Descricao LIKE '%texto%'] ORDER BY Faixa1`.

### SP-03 — Incluir/Editar/Excluir na grade (navegador `dnNavega`, atalhos F3/F4/F5/F6/F7)

**Pseudocódigo fiel (gravação):**
```
ao gravar (Post) um registro (Insert ou Edit):
  se Codigo <= 0: avisar "Indique o Número do Escore." e abortar
  se Descricao (trim) = '': avisar "Indique a Descrição do Escore." e abortar
  se Faixa1 = Null OU Faixa2 = Null: avisar "Indique a Faixa De / Até do Escore." e abortar
  se Tipos <= 0: avisar "Indique a Cor do Escore." e abortar
  se é Inclusão: Tipo := 222
  // ApplyUpdates via provider grava o INSERT/UPDATE real em Tabelas
  // dispara TU_TABELAS se for UPDATE (ver [[TU_TABELAS]] — sem regra específica para Tipo=222)
  CommitTransacaoTabelas(...)

ao excluir um registro:
  confirmar "Deseja Realmente Excluir o Registro Selecionado?"
  se confirmado: prosseguir (dispara TD_TABELAS — ver [[TD_TABELAS]], sem regra específica
                  para Tipo=222, logo SEM proteção contra exclusão de Escore em uso)
  senão: abortar
```

### SP-04 — Exportar para Excel (`btnExcelClick`)

### 5.3 Regras de negócio e validações

#### BR-001 — Número do Escore (Código) obrigatório e maior que zero
- **Mensagem:** "Indique o Número do Escore."

#### BR-002 — Descrição obrigatória
- **Mensagem:** "Indique a Descrição do Escore."

#### BR-003 — Faixa De/Até obrigatória (ambos não-nulos)
- **Mensagem:** "Indique a Faixa De / Até do Escore."
- **Achado**: a validação checa apenas "não nulo" (`<> Null`), não `Faixa1 < Faixa2` — é possível
  cadastrar uma faixa invertida ou com `Faixa1 = Faixa2` sem bloqueio.

#### BR-004 — Cor obrigatória
- **Mensagem:** "Indique a Cor do Escore."

#### BR-005 — Exclusão de Escore em uso não é bloqueada no banco
- **Achado:** ver `[[TD_TABELAS]]` — `Tipo=222` não tem bloco de validação de integridade
  referencial nessa trigger; a única barreira é a confirmação genérica "Deseja Realmente
  Excluir?" no lado da UI, sem checagem de uso.

---

## 6) Integrações e dados

### 6.1 Integrações (internas)

Nenhuma navegação para outras telas — cadastro autocontido. Caminho de menu confirmado em
`[[iniModuloPecuaria]]` (item `EscoresConsMetas`, sem parâmetro de contexto). **Consumidor
confirmado: `[[spGraficosPec01]]`/`[[GraficosPec]]`** (ver Resumo executivo) — `[[AvalCorporal]]`
permanece descartada como candidata (usa `Tipo=182`, domínio distinto).

### 6.2 Modelo de dados

**Tabela `Tabelas`** (genérica, `Tipo=222` = Escore de Consumo x Meta):

| Coluna | Tipo (Delphi/inferido) | Papel nesta tela |
|---|---|---|
| `Tipo` | `TIntegerField` (persistente) — `int` (alta confiança) | Fixado em `222` na inclusão. |
| `Codigo` | `TIntegerField` (persistente) — `int` (alta confiança) | Número do Escore — chave de negócio, digitada pelo usuário (sem geração automática). |
| `Descricao` | `TStringField` (persistente) — `varchar` (alta confiança) | Descrição do Escore. |
| `Faixa1` | `TFloatField` (persistente) — `float`/`numeric` (alta confiança) | Limite inferior ("De") da faixa. |
| `Faixa2` | `TFloatField` (persistente) — `float`/`numeric` (alta confiança) | Limite superior ("Até") da faixa. |
| `Mascara` | `TStringField` (persistente, consultado mas não editado/validado nesta unit) — `varchar` (alta confiança) | Não usado ativamente por esta tela (lido na consulta, não referenciado em nenhuma validação/gravação explícita — possível campo legado ou usado por outro consumidor). |
| `Tipos` | `TIntegerField` (persistente) — `int` (alta confiança) | Código de Cor (via `cxColorComboBox`) — ver achado de tipo em "Dicionário de campos". |

### 6.3 Triggers e Procedures do banco

- **`[[TU_TABELAS]]`** (`ON Tabelas FOR UPDATE`) — genérica; sem regra específica para `Tipo=222`.
- **`[[TD_TABELAS]]`** (`ON Tabelas FOR DELETE`) — genérica; sem regra específica para `Tipo=222`
  (diferente de `Tipo=172` Categoria Pecuária, que tem `CHECKCATEGORIAPEC`) — ver BR-005.
- `TI_TABELAS` (trigger de `INSERT`) **não existe** (confirmado em `[[ExportaDietas]]`).

---

## 7) Suporte: FAQ, mensagens, erros e troubleshooting

### 7.2 Catálogo de mensagens e erros

| Mensagem exata | Causa |
|---|---|
| "Indique o Número do Escore." | BR-001 |
| "Indique a Descrição do Escore." | BR-002 |
| "Indique a Faixa De / Até do Escore." | BR-003 |
| "Indique a Cor do Escore." | BR-004 |
| "Deseja Realmente Excluir o Registro Selecionado?" | Confirmação de exclusão |

---

## 9) Notas de revisão

- **2026-09-08** (auditoria campo-a-campo — módulo Pecuária)
  - **O que mudou:** caminho de menu confirmado via `[[iniModuloPecuaria]]`. Corrigida candidata
    de consumidor: `[[AvalCorporal]]` (lida em sessão posterior) usa `Tipo=182`, não `222` —
    descartada como candidata; consumidor real permanece não identificado.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** ver `[[iniModuloPecuaria]]`, `[[AvalCorporal]]`.

- **2026-09-08** (auditoria campo-a-campo — resolução do consumidor pendente)
  - **O que mudou:** grep por `Tipo=222` em todo o diretório `Pecuaria/`, incluindo `.dfm`, revela
    o consumidor real: `GraficosPec.dfm` embute a consulta como propriedade de componente
    (`CommandText`), invisível a um grep restrito a `.pas` — `JOIN Tabelas E ON C.ConsMeta BETWEEN
    E.Faixa1 AND E.Faixa2 AND E.Tipo=222`, usada pelo gráfico `GrafEscoresConsMeta` de
    `[[GraficosPec]]` via `[[spGraficosPec01]]`. Consumidor real identificado e cross-referenciado.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** `Pecuaria/GraficosPec.dfm`; `[[GraficosPec]]`, `[[spGraficosPec01]]`.

- **2026-08-27** (criação da nota — módulo Pecuária)
  - **O que mudou:** nota criada do zero, a partir de leitura 100% literal de
    `Pecuaria/EscoresConsMetas.pas` (213 linhas) + `.dfm` (título confirmado "Escores de Consumo x
    Meta"). Confirmada como gêmea estrutural de `[[MSxPVMetas]]`, gravando em `Tabelas.Tipo=222`.
    Triggers genéricas `TU_TABELAS`/`TD_TABELAS` lidas integralmente e documentadas em notas
    próprias (reutilizáveis por qualquer tela do módulo que edite/exclua registros de `Tabelas`);
    confirmado que `Tipo=222` não tem proteção de integridade na exclusão, ao contrário de
    `Tipo=172` (Categoria Pecuária). Achados: falta de validação `Faixa1 < Faixa2`, campo
    `Mascara` lido mas não utilizado nesta unit.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** código-fonte `Pecuaria/EscoresConsMetas.pas` + `.dfm`;
    `scripts/triggers/TU_TABELAS.sql`, `TD_TABELAS.sql`; ver `[[MSxPVMetas]]`, `[[TU_TABELAS]]`,
    `[[TD_TABELAS]]`.
