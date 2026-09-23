> **Nota de método**: este documento descreve uma **unit de biblioteca compartilhada** (não uma
> tela) do sistema legado AgriManager, documentada por engenharia reversa — leitura literal 100%
> de `Pecuaria/BibPec.pas` (383 linhas), nesta sessão, 30º arquivo `.pas` lido do módulo
> Pecuária. `BibPec` expõe funções/procedures Delphi reutilizadas por várias telas do módulo
> (helpers de busca de Brinco, validação de SisBov, leitura de balança serial, conversão de
> unidade, e o gatilho de recálculo de saldo `AtualizaSaldosSG`, já referenciado por
> `[[PrevisoesGPD]]`). Ver nota de método completa (limitação de DDL/tipos de coluna) em
> `[[ExportaDietas]]`, válida para todo o módulo.

---

**Status da implementação:** Legado — em produção (documentado via engenharia reversa, sem item de trabalho associado)

**Owner (curadoria):** @jefferson.arantes
**Tags:** #Pecuaria #Biblioteca #Brinco #SisBov #Balanca #AtualizaSaldos

---

## 0) Resumo executivo

`BibPec.pas` é uma unit de funções auxiliares (sem formulário próprio), usada como biblioteca
compartilhada por diversas telas do módulo Pecuária. Expõe 7 funções/procedures públicas:

| Função | Propósito |
|---|---|
| `fnDispAjudaBrinco` (2 sobrecargas) | Abre a tela `[[VisualizarBrincos]]` (lida e documentada integralmente) em modo de seleção, pré-configurada com Retiro/Data/Lote fixos, e devolve o brinco selecionado no `TcxCurrencyEdit`/`TField` chamador. |
| `BuscaBrinco` | Consulta os dados completos de um brinco (posição atual: SubGrupo/Lote/UnidOcup/Proprietário) a partir de sua última Entrada, filtrado por Retiro/Lote/Safra. |
| `ValidaSisBov` | Valida o dígito verificador de um código SisBov de 15 dígitos (algoritmo de módulo 11 com pesos fixos). |
| `ConfiguraLerPeso` | Carrega configuração de porta serial (`TComPort`) de um arquivo `.cfg` para leitura de balança eletrônica. |
| `CapturarPeso` | Lê e interpreta (parse) o valor de peso vindo da porta serial da balança, conforme o formato configurado. |
| `AtualizaSaldosSG` | Executa `[[spAtualizaSaldoSG]]` (recalcula `SaldosPec` em cascata para um SubGrupo/Data). |
| `ConverteUnid` | Converte uma quantidade entre 2 unidades de medida via a function de banco `dbo.ConverteUnid` (genérica do ERP, fora do módulo Pecuária). |
| `fnControleIndividual` | Verifica se um Lote/SubGrupo tem "Controle Individual" (rastreamento por brinco) ativo, contando movimentos de Entrada com brinco vinculado (`vwBrincosMov`). |

---

## 1) Conceito

| Termo | Definição |
|-------|-----------|
| `fnDispAjudaBrinco` é a "tela de ajuda F2" de busca de Brinco usada em várias telas do módulo | Abre `TfmVisualizarBrincos` como modal, travando (`Enabled:=False`) os filtros de Fazenda/Retiro/Data/Lote conforme o contexto do chamador — o usuário só pode escolher entre os brincos já filtrados pelo contexto, não pode alterar os filtros. Existem 2 sobrecargas (para `TcxCurrencyEdit` e para `TField`), com corpo quase idêntico — código duplicado, não compartilhado via uma função interna comum. |
| `ValidaSisBov` aceita string vazia como válida | `if StringEmpty(sBrinco) then Result:= true` — um SisBov vazio/nulo não é tratado como erro por esta função; a obrigatoriedade (se houver) deve ser validada separadamente pelo chamador. |
| `ConfiguraLerPeso`/`CapturarPeso` implementam um protocolo genérico e configurável de leitura de balanças seriais | O arquivo `.cfg` (`<caminho><usuário>.cfg` ou, se não existir, `<caminho>balanca.cfg`) define porta, baud rate, paridade, bits de parada/dados, caractere de busca (`sStrSearch`), tamanho da string do valor (`iStrTam`), casas decimais implícitas (`iStrDividir`, via `Power(10, iStrDividir)`) e se o valor está antes (`sPos='I'`, invertido) ou depois do caractere de busca no fluxo recebido — arquitetura pensada para suportar múltiplos modelos/protocolos de balança sem recompilar. |
| `AtualizaSaldosSG` engole exceções e mostra um `MessageDlg`, sem propagar o erro | `try...except on E: Exception do MessageDlg(...)` — se o recálculo de saldo falhar, o usuário vê um aviso mas o fluxo chamador **continua normalmente** (a exceção não é relançada) — achado de risco: uma tela que dependa do resultado do recálculo para prosseguir não teria como saber que ele falhou, apenas o usuário veria a mensagem. |
| `fnControleIndividual` tem uma implementação alternativa comentada usando uma function de banco | O código ativo monta e executa uma consulta SQL inline contra `vwBrincosMov`; uma linha comentada (`--'SELECT dbo.fnControleIndividualPec(...)'`) mostra que existia (ou existe) uma function de banco equivalente, não usada nesta versão da unit. |

---

## 2) Funções — detalhamento

### `fnDispAjudaBrinco` (2 sobrecargas)
Abre `TfmVisualizarBrincos` (`[[VisualizarBrincos]]`, lida e documentada integralmente) com `Caption:='Buscar
Brincos'`, `btnSelecionar.Enabled:=true`; trava Fazenda (sempre desabilitada), Retiro (fixado no
parâmetro `iRetiro`), Data Base e Final (fixadas em `dData`), Lote (se `iLote>0`); força filtro
"Ativos=Sim, Mortos=Não". Após `ShowModal`, se `btnSelecionar.Tag <> 0`, atribui esse valor ao
`Sender` (o campo/edit chamador) e retorna `True`.

### `BuscaBrinco(iSeq, var sRetorno, iRetiro, iLote=0)`
```sql
SELECT B.Sequencial, B.Brinco, ISNULL(B.SisBov, B.Brinco) SisBov, B.BrincoEletronico, B.Ativo,
       B.Morte, S.Sequencial SG, S.Lote, L.UnidOcup, B.BrincoAux, S.Proprietario, D.Codigo PessoaMov,
       M.UnidNegMov
FROM BrincosIndividuais B
  JOIN BrincosMov BM ON B.Sequencial = BM.Brinco
    AND BM.MovAnimais = (
      -- Última Entrada ('E') do brinco, com critério de desempate por Operacao/SeqTransf/TipoMov
      SELECT TOP 1 MM.Sequencial FROM MovAnimais MM JOIN BrincosMov MB ON MM.Sequencial = MB.MovAnimais
      WHERE MB.Brinco = B.Sequencial AND MM.TipoMov = 'E'
      ORDER BY MM.DataMov DESC,
        CASE WHEN MM.Operacao = 'R' THEN 'B' ELSE MM.Operacao END DESC,
        ISNULL(MM.SeqTransf, MM.Sequencial) DESC, MM.TipoMov ASC)
  JOIN MovAnimais M ON BM.MovAnimais = M.Sequencial
  JOIN DetPessoas D ON M.UnidNegMov = D.Sequencial
  JOIN SubGruposLotes S ON M.SubGrupo = S.Sequencial
  JOIN LotesBaias L ON S.Lote = L.Lote
WHERE L.Safra = <_iSafra> AND L.Retiro = <iRetiro> [AND L.Lote = <iLote>] AND B.Sequencial = <iSeq>
```
Preenche `sRetorno` (12 posições fixas, indexadas 0-11) com Brinco/SisBov/BrincoEletronico/Ativo/
Morte/SubGrupo/Lote/UnidOcup/Proprietario/PessoaMov/UnidNegMov/BrincoAux.

### `ValidaSisBov(sBrinco): Boolean`
Algoritmo de dígito verificador módulo 11: 14 dígitos multiplicados por pesos fixos
(`4,5,6,7,8,9,2,3,4,5,6,7,8,9`), soma mod 11; se resultado `>= 10`, dígito esperado é `0`.
String vazia é considerada válida (ver Conceito).

### `ConfiguraLerPeso`/`CapturarPeso`
Ver Conceito — configuração e leitura de balança serial via arquivo `.cfg` e protocolo
configurável.

### `AtualizaSaldosSG(iSubGrupo, dData)`
```
EXEC dbo.spAtualizaSaldoSG <iSubGrupo>, '<dData>'
```
Em caso de exceção, mostra "Erro na Atualização do Saldo do SubGrupo <n>" + mensagem, **sem
relançar a exceção** (ver Conceito, achado de risco).

### `ConverteUnid(dQtd, iUnid, iUnidAltern): Double`
Se `iUnid <> iUnidAltern`: `SELECT dbo.ConverteUnid(<dQtd>, <iUnid>, <iUnidAltern>) Qtd` (function
de banco genérica, fora do módulo Pecuária); senão retorna `dQtd` sem chamar o banco.

### `fnControleIndividual(iLote=0, iSubGrupo=0): Boolean`
```sql
SELECT COUNT(E.Sequencial) CI FROM vwBrincosMov E WHERE E.TipoMov = 'E' [AND E.Lote=<iLote>] [AND E.SubGrupo=<iSubGrupo>]
```
Retorna `True` se `CI > 0` — indica se o Lote/SubGrupo tem ao menos um Brinco individual
vinculado a uma Entrada (ou seja, é rastreado individualmente).

---

## 6) Integrações e dados

### 6.1 Integrações (internas)

- **`[[spAtualizaSaldoSG]]`** (via `AtualizaSaldosSG`) — recalcula `SaldosPec` em cascata.
- **[[VisualizarBrincos]]** (`TfmVisualizarBrincos`) — busca/seleção de brincos (lida e
  documentada integralmente).
- **`BrincosIndividuais`**/**`BrincosMov`**/**`vwBrincosMov`** — infraestrutura de rastreamento
  individual por brinco, ainda não documentada em detalhe (telas próprias não processadas).
- **`dbo.ConverteUnid`** — function de banco genérica do ERP (fora do módulo Pecuária).

### 6.2 Modelo de dados

Não aplicável — unit de biblioteca, sem tabela própria.

### 6.3 Triggers e Procedures do banco

- **`[[spAtualizaSaldoSG]]`** → **`[[spAtualizaSaldosPec]]`** (ambas lidas e documentadas
  integralmente nesta sessão) — a cadeia completa de recálculo de saldo do módulo.

---

## 9) Notas de revisão

- **2026-08-28** (criação da nota — módulo Pecuária)
  - **O que mudou:** nota criada do zero, a partir de leitura 100% literal de
    `Pecuaria/BibPec.pas` (383 linhas). Documentadas as 7 funções/procedures da biblioteca
    compartilhada, com destaque para `AtualizaSaldosSG` → `[[spAtualizaSaldoSG]]` →
    `[[spAtualizaSaldosPec]]`, a cadeia completa de recálculo de saldo do módulo (ambas as
    procedures lidas e documentadas integralmente nesta sessão, resolvendo a referência pendente
    desde `[[PrevisoesGPD]]`). Achado de risco: `AtualizaSaldosSG` engole exceções sem propagar.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** código-fonte `Pecuaria/BibPec.pas`; `[[spAtualizaSaldoSG]]`,
    `[[spAtualizaSaldosPec]]`; ver `[[PrevisoesGPD]]`.
