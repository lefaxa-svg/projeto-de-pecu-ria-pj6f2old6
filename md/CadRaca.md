> **Nota de método**: este documento descreve uma tela de um sistema LEGADO já em produção,
> reconstruída por engenharia reversa do código-fonte — não é uma especificação de feature nova
> obtida por entrevista com um PO. Por isso, toda seção que normalmente viria de uma conversa de
> negócio (motivação, métricas, objetivos) foi preenchida por **inferência a partir do
> comportamento do código**, e está marcada explicitamente como `(inferência)`. Onde nem o código
> nem o contexto do módulo permitem inferir nada com segurança, o campo está como `N/A`.
> Fonte: releitura 100% literal de `Pecuaria/CadRaca.pas` (235 linhas, unit `CadRaca`, classe
> `TfmCadRaca`) e do `.dfm` correspondente (título confirmado "Cadastro de Raças"; 811 linhas),
> em auditoria de profundidade de 2026-09-02. Tela **genérica reutilizável** sobre `Tabelas`
> (`Tipo` **não é fixo no código** — é uma propriedade pública `iTipo` que a tela chamadora deve
> preencher antes de `ShowModal`). **`Tipo=166`=Raça está CONFIRMADO** (auditoria 2026-09-02) por
> duas fontes independentes: (1) `Pecuaria/iniModuloPecuaria.pas`, linha 154-158 —
> `sReferencia='CadRaca'` cria `TfmCadRaca` e faz `fmCadRaca.iTipo:= 166` antes do `ShowModal`; (2)
> o `CommandText` de design-time do próprio `sqlCadRaca` no `.dfm` (`WHERE Tipo=166`, usado apenas
> como placeholder de design — em runtime é sempre sobrescrito por `btnConsultaClick`). Diferente
> das 4 telas anteriores do mesmo padrão (`[[CausaMortis]]`, `[[AvalCorporal]]`,
> `[[EscoresConsMetas]]`, `[[FaixaEtaria]]`), que fixam `Tipo` como constante. Triggers genéricas
> `[[TU_TABELAS]]`/`[[TD_TABELAS]]` (já documentadas) aplicam-se. Ver nota de método completa
> (limitação de DDL/tipos de coluna) em `[[ExportaDietas]]`, válida para todo o módulo.

---

**Status da implementação:** Legado — em produção (documentado via engenharia reversa, sem item de trabalho associado)

**Owner (curadoria):** @jefferson.arantes
**Tags:** #Pecuaria #Cadastro #Raca #SisBov

---

## 0) Resumo executivo

- **O que é:** cadastro em grade "Cadastro de Raças" — registros de `Tabelas` filtrados por
  `Tipo=166` (**confirmado**, ver nota de método), injetado via propriedade pública `iTipo`, com
  Descrição (máx. 200 caracteres), Máscara (texto livre, máx. 10 caracteres — limite curto,
  provavelmente um código/sigla e não texto descritivo), "Raça SisBov" (`DescricaoVar`, máx. 200
  caracteres — provável campo de integração com o sistema SISBOV/rastreabilidade bovina nacional,
  obrigatório), Período de Gestação em meses (inteiro, sem validação) e uma Observação (memo, máx.
  500 caracteres).
- **Único ponto de entrada confirmado — menu principal, modo cadastro puro:**
  `Pecuaria/iniModuloPecuaria.pas` (`sReferencia='CadRaca'`) é a **única** unit em todo o código
  (`grep` "CadRaca" na árvore `ITPApplication_Modulos\source`, 2026-09-02) que referencia
  `TfmCadRaca`/`CadRaca`, além da própria unit — e ela **não** habilita `btnAplicar` antes do
  `ShowModal`. Logo, o único fluxo real e confirmado é cadastro autônomo a partir do menu.
- **Duplo papel — cadastro E seletor modal, mas o modo seletor está sem chamador confirmado
  (achado de arquitetura, reafirmado na auditoria 2026-09-02):** a tela pode ser usada tanto como
  cadastro CRUD comum quanto como **picker modal**: duplo-clique na grade
  (`gdCadRacaDBTableView1DblClick`) só produz efeito **se `btnAplicar.Enabled = True`** (por
  padrão `False` no `.dfm` — precisa ser habilitado pela tela chamadora antes de `ShowModal`),
  retornando `iCodigo` (propriedade pública) e `ModalResult := mrOK`. Como o único chamador
  conhecido (`iniModuloPecuaria`) não habilita `btnAplicar`, o modo seletor é **código morto ou
  não utilizado dentro do módulo Pecuária** — pode ter sido usado por outro módulo/tela fora desta
  árvore de código, ou ser vestígio de uma feature nunca conectada. Nenhuma tela satélite do vault
  Pecuária (`CadRaca.md` é folha, não há telas que a chamem documentadas) referencia este
  comportamento de seleção.
- **Impacto principal:** CRUD em `Tabelas` (`Tipo=166`) via `ClientDataSet.Post`/`Delete` —
  dispara `[[TU_TABELAS]]`/`[[TD_TABELAS]]`.

---

## 1) Conceito

| Termo | Definição |
|-------|-----------|
| `iTipo`/`iCodigo` são propriedades públicas, não constantes — tela genérica parametrizável | Diferente das demais telas de cadastro simples do módulo (que fixam `Tipo=NNN` em `BeforePost`), aqui `iTipo` é lido em `AfterInsert`/`BeforePost`/`btnConsultaClick` como valor **externo**, e `iCodigo` é escrito de volta ao selecionar um item via duplo-clique — arquitetura de "cadastro genérico reutilizável e opcionalmente seletor", não vista nas 4 telas anteriores do mesmo grupo. Na prática, o único chamador conhecido (`iniModuloPecuaria.pas`) sempre injeta `iTipo:=166`, fixando o comportamento efetivo. |
| Botão "Aplicar" (aqui sem `Caption`, só `Hint='Aplicar'`) controla se o duplo-clique funciona como seleção | Ver Resumo executivo — comportamento condicional único desta tela no módulo até agora. |
| "Raça SisBov" é o único campo de texto obrigatório além da Descrição | `DescricaoVar` — validado em `BeforePost` com a mesma seriedade que `Descricao`; sugere que este campo tem importância de integração externa (SISBOV é o sistema brasileiro de rastreabilidade de bovinos, mas a integração real não é visível nesta unit — `(inferência)`). |
| `PeriodoGestacao` e `Mascara` não têm nenhuma validação | Achado: campos aceitos sem checagem de obrigatoriedade/faixa. |

---

## 2) Dicionário de campos da tela (`.dfm`)

| Controle | Classe | Rótulo/Caption | Vinculado a (campo BD) | Obrigatório | Observações |
|---|---|---|---|---|---|
| `teDescricao` | `TcxTextEdit` | (grupo "Descrição", dentro de "Critérios de Seleção") | filtro apenas (`LIKE`, não persistido) | Não | — |
| `teRacaSisBov` | `TcxTextEdit` | (grupo "Raça SisBov", dentro de "Critérios de Seleção") | filtro apenas (`LIKE`, sobre `DescricaoVar`, não persistido) | Não | — |
| `btnConsulta` | `TcxButton` | "Consultar" | — | — | Reexecuta a consulta com os filtros digitados. |
| `dnNavega` | `TcxDBNavigator` | (sem Caption; botões individuais com `Hint`) | — | — | Botões **First/PriorPage/Prior/Next/NextPage/Last/Refresh/SaveBookmark/GotoBookmark/Filter todos com `Visible=False`** — só ficam visíveis Insert (F3), Delete (F4), Edit (F5), Post (F6), Cancel (F7). `Buttons.ConfirmDelete=False` (a confirmação de exclusão é feita manualmente em `cdsCadRacaBeforeDelete`, não pelo navigator). |
| `btnExcel` | `TcxButton` | "Exportar" | — | — | Exporta a grade via `ExportGrid4ToExcel`. |
| `btnImprimir` | `TcxButton` | "Imprimir" | — | — | **Permanentemente desabilitado** (`Enabled=False` no `.dfm`) e sem `OnClick` declarado — funcionalidade não implementada. |
| `btnAplicar` | `TcxButton` | (sem Caption, `Hint`="Aplicar") | — | — | **Desabilitado por padrão** (`Enabled=False` no `.dfm`) — só seria habilitado pela tela chamadora, para ativar o modo "seletor" do duplo-clique na grade (ver Conceito/Resumo executivo). Nenhum chamador conhecido o habilita. |
| Grid `gdCadRacaDBTableView1`, coluna `Codigo` | `TcxGridDBColumn` | "Cod." | `Codigo` (`int`) | — (gerado) | `Options.Editing=False`, `Options.Focusing=False` — coluna somente leitura na grade (chave gerada por `LoadSequencia`, não editável manualmente); estilo visual `cxStyleDisable`. |
| Grid `gdCadRacaDBTableView1`, coluna `Descricao` | `TcxGridDBColumn` | "Descrição" | `Descricao` (`varchar(200)`, `FixedChar=True`) | **Sim** (BR-001) | Editável diretamente na célula da grade (não há campo de edição em tela separado). |
| Grid `gdCadRacaDBTableView1`, coluna `Mascara` | `TcxGridDBColumn` | "Máscara" | `Mascara` (`varchar(10)`, `FixedChar=True`) | Não | Sem validação de obrigatoriedade/formato; **tamanho máximo de apenas 10 caracteres** no BD — texto livre, mas de fato só cabe um código/sigla curto, não uma máscara descritiva longa. |
| Grid `gdCadRacaDBTableView1`, coluna `DescricaoVar` | `TcxGridDBColumn` | "Raça SisBov" | `DescricaoVar` (`varchar(200)`) | **Sim** (BR-002) | — |
| Grid `gdCadRacaDBTableView1`, coluna `PeriodoGestacao` | `TcxGridDBColumn` | "Período de Gestação (M)" | `PeriodoGestacao` (`int`) | Não | Sem nenhuma validação (nem obrigatoriedade, nem faixa, nem sinal) em `BeforePost` — **aceita valor negativo ou zero sem aviso**. Sem `RoundTo`/`Round`/`Trunc`/`FormatFloat` (é inteiro puro, não há cálculo/arredondamento nesta tela). |
| `mmObsRaca` | `TcxDBMemo` | (grupo "Observação") | `ObsRaca` (`varchar(500)`) | Não | — |

---

## 5) Jornada do usuário + Especificação funcional

### SP-01 — Abrir a tela (`FormShow`)
Aplica permissão de somente-leitura conforme `TemPermissao(cdsCadRaca.Tag, __sUsuario)`; executa
consulta inicial sem filtros de texto (mas já filtrada por `iTipo`, que deve ter sido preenchido
pela tela chamadora antes do `ShowModal`).

### SP-02 — Filtrar (`btnConsultaClick`)
```
SELECT Tipo, Codigo, RTRIM(LTRIM(Descricao)) Descricao, RTRIM(LTRIM(Mascara)) Mascara,
       RTRIM(LTRIM(DescricaoVar)) DescricaoVar, PeriodoGestacao, ObsRaca
FROM Tabelas
WHERE Tipo = <iTipo>
[AND Descricao LIKE '%...%']
[AND DescricaoVar LIKE '%...%']
ORDER BY Descricao
```

### SP-03 — Incluir/Editar/Excluir na grade (navegador `dnNavega`, atalhos F3/F4/F5/F6/F7)

**Pseudocódigo fiel:**
```
ao inserir novo registro:
  bInsert := true
  Tipo := iTipo
  focar a grade, coluna "Descrição" com seleção

ao gravar (Post):
  se Descricao (trim) = '': avisar "Indique a Descrição." e abortar (foca coluna 1)
  senão se DescricaoVar (trim) = '': avisar "Indique a Raça SisBov." e abortar (foca coluna 3)
  senão se é Inclusão:
    Tipo := iTipo
    Codigo := LoadSequencia('Tabelas', 'Codigo', escopado por Tipo=iTipo)
  // ApplyUpdates via provider grava o INSERT/UPDATE real (dispara TU_TABELAS se Edição)
  CommitTransacaoTabelas(...)

ao excluir:
  confirmar "Deseja Realmente Excluir o Registro Selecionado?"
  se confirmado: prosseguir (dispara TD_TABELAS)
  senão: abortar
```

### SP-04 — Selecionar item via duplo-clique (`gdCadRacaDBTableView1DblClick`) — modo seletor

**Pseudocódigo fiel:**
```
ao dar duplo-clique numa linha da grade:
  se NOT btnAplicar.Enabled: nada acontece (modo cadastro puro)
  senão:
    se Codigo > 0:
      iCodigo := Codigo
      ModalResult := mrOK  // fecha a tela, devolvendo iCodigo à chamadora
    senão:
      avisar "Nenhum Item Selecionado."
      iCodigo := 0
```

### SP-05 — Exportar para Excel (`btnExcelClick`)

### 5.3 Regras de negócio e validações

#### BR-001 — Descrição obrigatória
- **Mensagem:** "Indique a Descrição."

#### BR-002 — Raça SisBov (DescricaoVar) obrigatória
- **Mensagem:** "Indique a Raça SisBov."

#### BR-003 — Nenhuma validação de duplicidade de Descrição/Raça SisBov
- **Achado:** possível cadastrar 2 raças com a mesma Descrição ou o mesmo código SisBov.

#### BR-004 — Exclusão de Raça em uso não é bloqueada no banco
- **Achado:** ver `[[TD_TABELAS]]` — não há bloco de validação genérico para `Tipo` variável
  (a checagem de integridade referencial em `TD_TABELAS` é feita por `Tipo` fixo em cada bloco;
  como esta tela pode gravar sob qualquer `Tipo` fornecido pela chamadora, a proteção depende de
  qual `Tipo` especificamente for usado — se for `166` (Raça), `TD_TABELAS` não tem bloco para
  esse `Tipo`, logo sem proteção).

---

## 6) Integrações e dados

### 6.1 Integrações (internas)

Tela **genérica reutilizável**: `iTipo` deve ser preenchido pela tela chamadora antes de exibir;
opcionalmente `btnAplicar.Enabled` pode ser setado para `True` pela chamadora para ativar o modo
seletor (duplo-clique retorna `iCodigo` via `ModalResult=mrOK`).

**Chamador confirmado (auditoria 2026-09-02):** `Pecuaria/iniModuloPecuaria.pas`, linhas 154-158
— item de menu `sReferencia='CadRaca'`:
```pascal
end else if sReferencia = 'CadRaca' then begin
  Application.CreateForm(TfmCadRaca, fmCadRaca);
  fmCadRaca.iTipo:= 166;
  fmCadRaca.ShowModal;
  FreeAndNil(fmCadRaca);
```
Confirma `Tipo=166`=Raça e que este chamador **não** habilita `btnAplicar` — abre sempre em modo
cadastro puro. Confirmado via `grep` "CadRaca" em toda a árvore `ITPApplication_Modulos\source`
(2026-09-02): os únicos arquivos que citam `CadRaca`/`TfmCadRaca` são a própria unit (`.pas`/`.dfm`)
e `Pecuaria/iniModuloPecuaria.pas` — não há nenhuma tela satélite, em nenhum módulo, que abra
`TfmCadRaca` como seletor (`btnAplicar.Enabled:=True`). O modo seletor existe no código mas está
**sem chamador confirmado em todo o ERP** — candidato a código morto/feature nunca conectada, ou
usado por alguma outra camada não coberta por esta pasta de fontes (ex.: relatórios, scripts).

### 6.2 Modelo de dados

**Tabela `Tabelas`** (genérica, `Tipo` = valor injetado por `iTipo`; **`Tipo=166`=Raça confirmado**
em `iniModuloPecuaria.pas` e no `CommandText` de design-time do `.dfm`):

| Coluna | Tipo (Delphi/inferido) | Tamanho | Papel nesta tela |
|---|---|---|---|
| `Codigo` | `TIntegerField` (persistente) — `int` (alta confiança) | — | Chave — gerada por `LoadSequencia` escopada por `Tipo`. `ProviderFlags=[pfInUpdate,pfInWhere,pfInKey]`, `Required=True`. |
| `Tipo` | `TIntegerField` (persistente) — `int` (alta confiança) | — | Injetado por `iTipo=166` (não fixo nesta unit, mas fixo no único chamador conhecido). `ProviderFlags=[pfInUpdate,pfInWhere,pfInKey]`, `Required=True`. |
| `Descricao` | `TStringField` (persistente) — `varchar`, `FixedChar=True` (alta confiança) | 200 | Nome da Raça — obrigatório (BR-001, validado só em código, não em `Required` do field). |
| `Mascara` | `TStringField` (persistente) — `varchar`, `FixedChar=True` (alta confiança) | 10 | Texto livre, uso não confirmável sem consumidor; tamanho curto sugere código/sigla. |
| `DescricaoVar` | `TStringField` (persistente) — `varchar` (alta confiança) | 200 | "Raça SisBov" — obrigatório (BR-002, validado só em código). |
| `PeriodoGestacao` | `TIntegerField` (persistente) — `int` (alta confiança) | — | Período de gestação em meses, sem validação (aceita negativo/zero). |
| `ObsRaca` | `TStringField` (persistente, memo) — `varchar`/`text` (alta confiança) | 500 | Observações livres. |

### 6.3 Triggers e Procedures do banco

- **`[[TU_TABELAS]]`**/**`[[TD_TABELAS]]`** (genéricas, já documentadas) — sem bloco específico
  para `Tipo=166` (candidato mais provável de uso desta tela).
- `TI_TABELAS` (trigger de `INSERT`) **não existe** (confirmado em `[[ExportaDietas]]`).

---

## 7) Suporte: FAQ, mensagens, erros e troubleshooting

### 7.2 Catálogo de mensagens e erros

| Mensagem exata | Causa |
|---|---|
| "Indique a Descrição." | BR-001 |
| "Indique a Raça SisBov." | BR-002 |
| "Deseja Realmente Excluir o Registro Selecionado?" | Confirmação de exclusão |
| "Nenhum Item Selecionado." | SP-04, duplo-clique sem registro válido em modo seletor |

---

## 9) Notas de revisão

- **2026-09-02** (auditoria de profundidade — módulo Pecuária)
  - **O que mudou:** releitura completa de `CadRaca.pas` (235 linhas) e `CadRaca.dfm` (811 linhas,
    lido por inteiro — a leitura anterior aparentemente não havia processado o `.dfm` até o final,
    já que o `CommandText` de design-time do `sqlCadRaca` com `WHERE Tipo=166` não estava citado).
    **Gaps reais corrigidos:**
    1. **`Tipo=166`=Raça, antes marcado como "candidato provável, não confirmado", agora está
       CONFIRMADO** por duas fontes: `Pecuaria/iniModuloPecuaria.pas` (linha 156,
       `fmCadRaca.iTipo:= 166`) e o `CommandText` de design-time do `.dfm`.
    2. **Chamador da tela, antes marcado como "não identificado" (achado errôneo/desatualizado)**
       — na verdade `iniModuloPecuaria.pas` (item de menu `'CadRaca'`) sempre foi o único
       chamador; confirmado agora com o trecho de código exato e a citação de linha. Esse mesmo
       chamador **não** habilita `btnAplicar`, o que reforça (não inverte) a conclusão anterior de
       que o modo seletor (duplo-clique) está sem uso confirmado dentro do módulo — mas agora essa
       conclusão é rastreada a uma varredura de todo `ITPApplication_Modulos\source` (não só
       `Pecuaria/`), reduzindo o risco de falso-negativo por escopo de busca estreito demais.
    3. **Dicionário de campos (seção 2) estava incompleto:** faltava a linha do `dnNavega`
       (`TcxDBNavigator`, com detalhamento de quais botões estão visíveis/ocultos e o
       `ConfirmDelete=False`), e as colunas de grid não traziam tamanho de campo do banco
       (`Descricao`/`DescricaoVar`=200, `Mascara`=10, `ObsRaca`=500) nem a observação explícita de
       que `PeriodoGestacao` aceita valores negativos/zero sem qualquer validação. Adicionados.
    4. **Confirmação explícita (item "c" do escopo de auditoria):** esta tela não tem nenhum campo
       calculado/derivado — não há `RoundTo`/`SimpleRoundTo`/`Round`/`Trunc`/`FormatFloat` em
       nenhum ponto de `CadRaca.pas`; todos os campos numéricos (`PeriodoGestacao`) são inteiros
       puros sem fórmula. Documentado explicitamente na tabela do dicionário em vez de omitido.
    - Demais seções (BRs, mensagens, triggers genéricas `TU_TABELAS`/`TD_TABELAS`) já estavam
      corretas e foram apenas conferidas, sem alteração de conteúdo.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** releitura de `Pecuaria/CadRaca.pas` + `.dfm` (completo); `grep` "CadRaca" em
    `ITPApplication_Modulos\source` (2026-09-02); `Pecuaria/iniModuloPecuaria.pas` linhas 154-158;
    `[[iniModuloPecuaria]]`.

- **2026-08-28** (criação da nota — módulo Pecuária)
  - **O que mudou:** nota criada do zero, a partir de leitura 100% literal de
    `Pecuaria/CadRaca.pas` (235 linhas) + `.dfm` (título confirmado "Cadastro de Raças").
    Documentado o padrão único desta tela no módulo: `Tipo` genérico injetado via propriedade
    pública `iTipo` (não fixo em código), e duplo papel cadastro/seletor modal controlado por
    `btnAplicar.Enabled`. Achado: botão "Imprimir" desabilitado e sem handler.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** código-fonte `Pecuaria/CadRaca.pas` + `.dfm`; ver `[[CausaMortis]]`,
    `[[AvalCorporal]]`, `[[FaixaEtaria]]`, `[[TU_TABELAS]]`, `[[TD_TABELAS]]`.
