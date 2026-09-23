> **Nota de método**: este documento descreve uma tela de um sistema LEGADO já em produção,
> reconstruída por engenharia reversa do código-fonte — não é uma especificação de feature nova
> obtida por entrevista com um PO. Por isso, toda seção que normalmente viria de uma conversa de
> negócio (motivação, métricas, objetivos) foi preenchida por **inferência a partir do
> comportamento do código**, e está marcada explicitamente como `(inferência)`. Onde nem o código
> nem o contexto do módulo permitem inferir nada com segurança, o campo está como `N/A`.
> Fonte: leitura 100% literal de `Pecuaria/EvolCategorias.pas` (405 linhas, unit
> `EvolCategorias`, classe `TfmEvolCategorias`) e do `.dfm` correspondente (título confirmado
> "Evolução de Categorias de Animais"), nesta sessão — 32º arquivo `.pas` lido do módulo
> Pecuária. Tela **wizard de 2 etapas** (Seleção → Confirmação/Execução) sobre
> `[[spConsEvolCategorias]]`/`[[spGravaEvolCategoria]]` (ambas lidas e documentadas integralmente
> nesta sessão). Ver nota de método completa (limitação de DDL/tipos de coluna) em
> `[[ExportaDietas]]`, válida para todo o módulo.

---

**Status da implementação:** Legado — em produção (documentado via engenharia reversa, sem item de trabalho associado)

**Owner (curadoria):** @jefferson.arantes
**Tags:** #Pecuaria #Categoria #Evolucao #SubGrupo #Wizard

---

## 0) Resumo executivo

- **O que é:** ferramenta de "Evolução de Categorias de Animais" — identifica SubGrupos cuja
  Categoria zootécnica (idade) mudou desde o último registro (ex.: bezerro → garrote), permite ao
  usuário revisar/ajustar a nova Categoria sugerida por SubGrupo, e grava a evolução em lote.
- **Fluxo em 2 etapas** (controlado por `DesabilitaCriteriosSelecao`/estado dos botões):
  1. **Seleção** (`btnConfirmarSel`): consulta candidatos, usuário marca quais SubGrupos evoluir.
  2. **Confirmação/Execução** (`btnAlterarSel`/`btnExecutar`): filtra só os marcados, permite
     editar a Categoria de destino célula a célula, e executa a gravação em lote.
- **Impacto principal:** `EXEC spGravaEvolCategoria` — cria movimentos de Evolução (`MovAnimais`
  `TipoMov='M'`/`Operacao='E'`), corrige retroativamente movimentos posteriores em cascata, e
  recalcula saldo (`[[spAtualizaSaldoSG]]`).

---

## 1) Conceito

| Termo | Definição |
|-------|-----------|
| A tela pode ser reaberta em modo "restrito" via `bInicializa=False` | `FormShow`: se `bInicializa` (propriedade pública, default implícito `True` na declaração `var`, mas setada explicitamente `True` em `FormCreate`) for `False`, os filtros de Fazenda/Retiro/Data/UnidOcup/Lote ficam **desabilitados**. **Confirmado em auditoria de 2026-09-02** (não identificado na versão anterior desta nota): a única chamadora que seta `bInicializa:=False` é `[[MonitoramentoBaiasLotes]].miEvolCategoriasClick` — abre `TfmEvolCategorias` já pré-preenchida com Fazenda/Retiro/Lote/Data do contexto corrente da tela de Monitoramento, e, se houver um SubGrupo específico selecionado na visualização (`cbVisualizacao.ItemIndex=1`), também pré-preenche e **desabilita** `ceSubGrupo` (trava a evolução a um único SubGrupo). |
| "DifBrincos" alerta sobre heterogeneidade dentro do SubGrupo | Coluna calculada por `[[spConsEvolCategorias]]` — quantos brincos individuais teriam uma Categoria diferente da sugerida para o SubGrupo inteiro (baseada no nascimento "representativo" do SubGrupo, não do indivíduo) — um SubGrupo com `DifBrincos > 0` indica que a evolução em lote pode categorizar incorretamente alguns animais específicos. |
| A grade de Categoria filtra para mostrar só categorias "Evoluir=S" ao editar | `btnConfirmarSelClick`: aplica filtro `Codigo <> 0 and TipoVal = 'S'` no lookup `dmPecuaria.cdsCategorias` — só Categorias marcadas como "Evoluir" (`Tabelas.Tipo=172`, `TipoVal`, ver `[[Categorias]]`) aparecem como opção de Categoria Nova ao editar manualmente uma linha — usa exatamente o flag `TipoVal` já documentado na tela `[[Categorias]]`, confirmando seu propósito real: controlar quais categorias podem ser destino de evolução automática. |
| Duplo-clique marca/desmarca uma linha, mas só na etapa de Seleção | `gdEvolCategoriasTabelaDblClick`: só age se `btnConfirmarSel.Enabled` (ou seja, ainda na etapa 1) — inverte o campo `Marcar` da linha. |
| Desmarcar uma linha reverte a Categoria Nova ao valor original sugerido | `cdsEvolCategoriasBeforePost`: se `Marcar=0`, força `CatNova := CatEvol` (a sugestão original calculada pela procedure) — evita que uma linha desmarcada mantenha uma edição manual de Categoria Nova feita anteriormente. |
| Atalho F9 alterna painel de depuração SQL, sem `Ctrl` | Mesma variação "F9 simples" já vista em `[[AjusteVirtual]]`. |

---

## 2) Dicionário de campos da tela (`.dfm`)

| Controle | Classe | Rótulo/Caption | Vinculado a (campo BD) | Obrigatório | Observações |
|---|---|---|---|---|---|
| `cbFazendas`/`cbRetiros` | `TcxLookupComboBox` | (grupos) | escopo | — | Padrão de seleção Fazenda→Retiro do módulo. |
| `deData` | `TcxDateEdit` | (grupo "Data") | `@Data` | Sim (implícito) | Data de referência para o cálculo de Categoria. |
| `cbUnidOcupIni`/`cbUnidOcupFim` | `TcxLookupComboBox` | — | `@UnidOcupIni`/`@UnidOcupFim` | Não | Faixa de Unidade de Ocupação. |
| `cbLoteIni`/`cbLoteFim` | `TcxLookupComboBox` | — | `@LoteIni`/`@LoteFim` | Não | Faixa de Lote (por descrição). |
| `ceSubGrupo` | `TcxCurrencyEdit` | — | `@SubGrupo` | Não | SubGrupo específico. |
| `cbCategoria` | `TcxLookupComboBox` | — | `@CatAtual` | Não | Categoria atual específica, com opção "..: TODAS :..". |
| `btnConsultar` | `TcxButton` | — | — | — | Etapa 1: consulta candidatos. |
| `btnConfirmarSel` | `TcxButton` | — | — | — | Avança para Etapa 2 (filtra marcados, habilita edição de Categoria Nova). |
| `btnAlterarSel` | `TcxButton` | — | — | — | Volta para Etapa 1 (remove filtros, reabilita critérios). |
| `btnExecutar` | `TcxButton` | — | — | — | Grava a evolução (`spGravaEvolCategoria`) — habilitado só se `TemPermissao(btnExecutar.Tag, ...)`. |
| `btnCancelar` | `TcxButton` | — | — | — | — |
**Grid `gdEvolCategoriasTabela` (`TcxGridDBBandedTableView`, banda única) — dicionário coluna a coluna** (10 colunas declaradas no `.dfm`, 2 delas ocultas por padrão — achado da auditoria de 2026-09-02, não estavam na versão anterior desta tabela):

| Coluna (`.dfm`) | Caption exibido | Campo (`cds`) | Visível | Editável (`Options.Editing`) | Observações |
|---|---|---|---|---|---|
| `gdEvolCategoriasTabelaMarcar` | (sem caption — só checkbox) | `Marcar` (`TcxCheckBoxProperties`, `ValueChecked=1`/`ValueUnchecked=0`, `ImmediatePost=True`) | Sim | Editável (padrão, não desabilitado na definição da coluna — controlado em runtime por `gdEvolCategoriasTabelaMarcar.Options.Editing`, ligado/desligado entre Etapas 1/2) | 1ª coluna (índice 0); marca/desmarca a linha para evolução. |
| `gdEvolCategoriasTabelaUO` | "U.O." | `UO` | Sim | `Options.Editing=False` (fixo, nunca editável) | Unidade de Ocupação do SubGrupo. |
| `gdEvolCategoriasTabelaLote` | (sem caption) | `Lote` (código numérico do lote) | **Não — `Visible=False`** | — | **Achado:** coluna com o código bruto do Lote existe no `.dfm` mas é sempre oculta; só a descrição (`DescLote`, coluna seguinte) é exibida ao usuário. Campo permanece no dataset e pode ser usado por código/relatório, mas não aparece na grade. |
| `gdEvolCategoriasTabelaDescLote` | "Lote" | `DescLote` | Sim | `Options.Editing=False` | Descrição do Lote — é o que o usuário vê como "Lote" (o código em si fica oculto, ver linha acima). |
| `gdEvolCategoriasTabelaSubGrupo` | (sem caption — nome do campo) | `SubGrupo` (`TcxCurrencyEditProperties`, `DecimalPlaces=0`) | Sim | `Options.Editing=False` | Alinhado à direita; formato `,0;(,0)`. |
| `gdEvolCategoriasTabelaCategoria` | (sem caption) | `Categoria` (código numérico da Categoria atual) | **Não — `Visible=False`** | — | **Achado:** mesmo padrão da coluna `Lote` — código bruto da Categoria atual existe no dataset mas fica sempre oculto; só a descrição (`DescCat`, coluna seguinte) é exibida. |
| `gdEvolCategoriasTabelaDescCat` | "Categoria Atual" | `DescCat` | Sim | `Options.Editing=False` | Descrição da Categoria atual do SubGrupo (antes da evolução). |
| `gdEvolCategoriasTabelaSaldo` | (sem caption — nome do campo) | `Saldo` (`TcxCurrencyEditProperties`, `DecimalPlaces=0`) | Sim | `Options.Editing=False` | Quantidade de animais no SubGrupo; alinhado à direita. |
| `gdEvolCategoriasTabelaCatNova` | **"Categoria Evoluída"** (não "Cat. Nova" — caption real do `.dfm`) | `CatNova` (`TcxLookupComboBoxProperties` sobre `dmPecuaria.dsCategorias`, `KeyFieldNames='Codigo'`) | Sim | `Options.Editing=False` na definição — **ligado em runtime** (`gdEvolCategoriasTabelaCatNova.Options.Editing:=True`) só na Etapa 2 (`btnConfirmarSelClick`) | Estilo `dmITP.cxStyleEvidence` (destaque visual quando editável); lookup filtrado em runtime para `Codigo<>0 and TipoVal='S'` (só categorias "evoluíveis", ver Seção 1). |
| `gdEvolCategoriasTabelaDifBrincos` | "Dif. Brincos" | `DifBrincos` (`TcxCurrencyEditProperties`, `DecimalPlaces=0`) | Sim | `Options.Editing=False` (fixo) | Alinhado à direita; ver definição em Seção 1 ("DifBrincos"). |

| Controle | Classe | Rótulo/Caption | Vinculado a (campo BD) | Obrigatório | Observações |
|---|---|---|---|---|---|
| `pmSelecionar` (menu: `miMarcar`/`miDesmarcar`) | `TPopupMenu` | — | — | — | Marca/desmarca todas as linhas visíveis. |
| `mmQuery` | `TcxMemo` | — | — | Oculto por padrão (`Visible=False` no `.dfm`, alternado por F9) | Painel de debug — F9. |

---

## 5) Jornada do usuário + Especificação funcional

### SP-01 — Abrir a tela (`FormShow`)
Carrega Fazendas permitidas e Categorias (`Tabelas.Tipo=172` + "..: TODAS :.."); se
`bInicializa`, pré-seleciona Fazenda/Data padrão; senão, trava os filtros de escopo.

### SP-02 — Consultar candidatos (`btnConsultarClick`)
```
EXEC dbo.spConsEvolCategorias @Safra=_iSafra, @Retiro=cbRetiros, @Data=deData,
  @UnidOcupIni, @UnidOcupFim, @LoteIni, @LoteFim, @SubGrupo=ceSubGrupo, @CatAtual=cbCategoria
```

### SP-03 — Marcar candidatos para evolução (grade, Etapa 1)
Marca/desmarca via duplo-clique, checkbox de linha, ou menu de contexto (Marcar/Desmarcar Todos).

### SP-04 — Confirmar Seleção (`btnConfirmarSelClick`) — avança para Etapa 2
Filtra a grade só para `Marcar=1`; filtra o lookup de Categoria para `TipoVal='S'` (evoluíveis);
desabilita a coluna "Marcar" e habilita "Cat. Nova" para edição; desabilita os critérios de
filtro; habilita "Executar" conforme permissão do usuário.

### SP-05 — Alterar Seleção (`btnAlterarSelClick`) — volta para Etapa 1
Remove os filtros, reabilita critérios e a coluna "Marcar", desabilita "Cat. Nova" e "Executar".

### SP-06 — Executar (`btnExecutarClick`)

**Pseudocódigo fiel:**
```
se nenhum registro na grade: avisar "Selecione os SubGrupos que serão evoluídos." e voltar à
  Etapa 1
senão:
  montar lista "SubGrupo/CategoriaNova;..." de todas as linhas (não só marcadas — a grade já está
    filtrada só para as marcadas desde a Etapa 2)
  EXEC spGravaEvolCategoria @Data=deData, @SGCat=<lista>, @Usuario=_iUsuario, @Sessao=_iSession
  se sucesso: avisar "Evolução das Categorias dos SubGrupos gravada com sucesso!"
  se erro: avisar "Erro na execução da Evolução das Categorias." + detalhe
  (finally) voltar à Etapa 1; se o painel de debug não estiver visível, reconsultar automaticamente
```

### 5.3 Regras de negócio e validações

#### BR-001 — Pelo menos um SubGrupo deve estar selecionado para executar
- **Mensagem:** "Selecione os SubGrupos que serão evoluídos."

#### BR-002 — Botão Executar exige permissão específica
- **Achado:** `TemPermissao(btnExecutar.Tag, __sUsuario)` — permissão granular por botão, não
  apenas por tela (padrão distinto da maioria das telas simples do módulo).

---

## 6) Integrações e dados

### 6.1 Integrações (internas)

- **`[[spConsEvolCategorias]]`**/**`[[spGravaEvolCategoria]]`** — consulta e gravação.
- **`[[Categorias]]`** (`Tabelas.Tipo=172`, campo `TipoVal`) — controla quais categorias são
  elegíveis como destino de evolução.
- **`[[spAtualizaSaldoSG]]`**/**`[[spAtualizaSaldosPec]]`** — recálculo de saldo pós-evolução.
- **Caminho de menu:** `iniModuloPecuaria.pas`, `sReferencia = 'EvolCategorias'` — abre a tela em
  modo padrão (`bInicializa=True`, sem contexto pré-fixado). Confirmado via `[[iniModuloPecuaria]]`.
- **Chamadora satélite (modo restrito):** `[[MonitoramentoBaiasLotes]].miEvolCategoriasClick` —
  abre com `bInicializa:=False`, pré-preenchendo Fazenda/Retiro/Lote/Data a partir do contexto da
  tela de Monitoramento de Baias/Lotes, e travando `ceSubGrupo` quando um SubGrupo específico já
  está selecionado lá (ver Seção 1).

### 6.2 Modelo de dados

Nenhuma tabela própria — grava em `MovAnimais`/`BrincosMov` via `[[spGravaEvolCategoria]]` (ver
nota da procedure para detalhamento completo).

### 6.3 Triggers e Procedures do banco

- **`[[spConsEvolCategorias]]`** (75 linhas, lida integralmente).
- **`[[spGravaEvolCategoria]]`** (119 linhas, lida integralmente) — grava e corrige
  retroativamente movimentos em cascata.

---

## 7) Suporte: FAQ, mensagens, erros e troubleshooting

### 7.2 Catálogo de mensagens e erros

| Mensagem exata | Causa |
|---|---|
| "Selecione os SubGrupos que serão evoluídos." | BR-001 |
| "Evolução das Categorias dos SubGrupos gravada com sucesso!" | Sucesso |
| "Erro na execução da Evolução das Categorias." + detalhe | Falha em `spGravaEvolCategoria` |

---

## 9) Notas de revisão

- **2026-09-02** (auditoria de profundidade — lote de 6 telas)
  - **O que mudou:** releitura completa e literal de `EvolCategorias.pas` (405 linhas) e `.dfm`
    (1335 linhas) linha a linha, incluindo o grep de todos os `object `/`Visible = False`/
    `Enabled = False` do `.dfm` para não deixar passar coluna de grid oculta. Gaps reais
    encontrados e corrigidos:
    1. **Dicionário de campos incompleto na versão anterior:** a Seção 2 resumia a grade em uma
       única linha ("UO / Lote / SubGrupo / Categoria / Saldo..."), sem citar que as colunas
       `gdEvolCategoriasTabelaLote` (campo `Lote`, código bruto) e `gdEvolCategoriasTabelaCategoria`
       (campo `Categoria`, código bruto) são **`Visible=False`** no `.dfm` — só as descrições
       (`DescLote`/`DescCat`) aparecem ao usuário. Reescrita como tabela coluna-a-coluna com
       visibilidade e editabilidade (`Options.Editing`) explícitas para as 10 colunas do grid.
       Também corrigido o caption real da coluna `CatNova`: "Categoria Evoluída" (a nota antiga
       dizia "Cat. Nova", que era só uma paráfrase do nome do campo).
    2. **Caminho de menu não documentado:** a nota não tinha Seção com o caminho de menu. Agora
       confirmado via `iniModuloPecuaria.pas` (`sReferencia='EvolCategorias'`).
    3. **Chamadora satélite não identificada na nota anterior** (Seção 1 dizia "nenhuma unit
       chamadora... foi encontrada"): localizada em `MonitoramentoBaiasLotes.pas`
       (`miEvolCategoriasClick`) — abre a tela em modo restrito (`bInicializa:=False`) com
       Fazenda/Retiro/Lote/Data pré-preenchidos do contexto do Monitoramento, e trava
       `ceSubGrupo` quando um SubGrupo específico já está selecionado. Seção 1 e 6.1 atualizadas.
    - **Confirmado sem gap:** esta tela não tem nenhuma fórmula de cálculo local (todos os campos
      numéricos da grade — `SubGrupo`, `Saldo`, `DifBrincos` — vêm prontos de
      `[[spConsEvolCategorias]]`, sem `Round`/`Trunc` no cliente) — logo não se aplica a checagem
      de arredondamento/sinal negativo pedida no roteiro de auditoria.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** código-fonte `Pecuaria/EvolCategorias.pas` + `.dfm` (releitura integral);
    `Pecuaria/iniModuloPecuaria.pas` (caminho de menu); `Pecuaria/MonitoramentoBaiasLotes.pas`
    (chamadora satélite, `miEvolCategoriasClick`).

- **2026-08-28** (criação da nota — módulo Pecuária)
  - **O que mudou:** nota criada do zero, a partir de leitura 100% literal de
    `Pecuaria/EvolCategorias.pas` (405 linhas) + `.dfm` (título confirmado "Evolução de
    Categorias de Animais"). Documentado o wizard de 2 etapas e as procedures associadas
    `[[spConsEvolCategorias]]`/`[[spGravaEvolCategoria]]` (ambas lidas e documentadas
    integralmente). Confirmado o propósito de `Tabelas.Tipo=172.TipoVal` (elegibilidade para
    evolução), já suspeitado em `[[Categorias]]`.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** código-fonte `Pecuaria/EvolCategorias.pas` + `.dfm`;
    `[[spConsEvolCategorias]]`, `[[spGravaEvolCategoria]]`; ver `[[Categorias]]`,
    `[[spAtualizaSaldoSG]]`.
