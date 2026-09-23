> **Nota de método**: este documento descreve uma tela de um sistema LEGADO já em produção,
> reconstruída por engenharia reversa do código-fonte — não é uma especificação de feature nova
> obtida por entrevista com um PO. Por isso, toda seção que normalmente viria de uma conversa de
> negócio (motivação, métricas, objetivos) foi preenchida por **inferência a partir do
> comportamento do código**, e está marcada explicitamente como `(inferência)`. Onde nem o código
> nem o contexto do módulo permitem inferir nada com segurança, o campo está como `N/A`.
> Fonte: leitura 100% literal de `Pecuaria/ExportaUnidOcup.pas` (109 linhas — arquivo pequeno,
> lido integralmente por ser referenciado diretamente por `[[UnidOcupacao]]`), unit
> `ExportaUnidOcup`, classe `TfmExportaUnidOcup`, nesta sessão — 62º arquivo `.pas` lido do
> módulo Pecuária. Aberta por `[[UnidOcupacao]]` (botão de exportação).

---

**Status da implementação:** Legado — em produção (documentado via engenharia reversa, sem item de trabalho associado)

**Owner (curadoria):** @jefferson.arantes
**Tags:** #Pecuaria #UnidOcupacao #Safra #Copia

---

## 0) Resumo executivo

- **O que é:** modal simples de **cópia de todas as Unidades de Ocupação de uma Safra para
  outra** — útil no início de uma nova Safra, para não recriar manualmente todas as Baias/Pastos
  do zero (reaproveita a estrutura física já cadastrada).
- **Achado de risco importante — geração de PK sem `LoadSequencia`.** Diferente de praticamente
  todo o restante do módulo (que usa `LoadSequencia('UnidOcupacao', 'Sequencial')`), esta rotina
  gera o novo `Sequencial` inline via `(SELECT MAX(Sequencial)+1 FROM UnidOcupacao)` dentro de
  cada iteração do laço — sujeito a condição de corrida se 2 usuários executarem a exportação
  simultaneamente (ou se qualquer outra tela do sistema inserir uma `UnidOcupacao` concorrentemente
  usando `LoadSequencia`, que pode não estar sincronizado com o `MAX()` calculado aqui).
- **Impacto principal:** `INSERT UnidOcupacao` (N vezes, 1 por U.O. da Safra Origem) com todos os
  campos copiados exceto `Safra` (novo) e `Sequencial` (recalculado via `MAX+1`).

---

## 1) Conceito

| Termo | Definição |
|-------|-----------|
| Cópia é "rasa" — não copia vínculos, apenas a estrutura física | Copia todos os campos de `UnidOcupacao` (Fazenda/Retiro/Tipo/Código/Ordem/Lado/Rua/Área/
Capacidade/Estado/Forma de Uso/etc.) para a nova Safra, mas **não** cria nenhum `LotesBaias` ou vínculo de ocupação — a nova Safra recebe as U.O. "vazias" (sem Lote associado), como esperado para início de Safra. |
| Combo "Safra Origem" não tem opção "TODAS" (comentário morto no código) | Uma linha comentada (`//CommandText:='Select 0 Codigo...Union All...'`) sugere que uma versão anterior do código considerou uma opção "TODAS" para a Safra Origem, mas foi removida/desativada — a consulta atual sempre lista todas as Safras (`Tabelas.Tipo=1`) sem opção agregadora. |

---

## 2) Dicionário de campos da tela (`.dfm`)

| Controle | Classe | Rótulo/Caption | Vinculado a (campo BD) | Obrigatório | Observações |
|---|---|---|---|---|---|
| `cbSafraOrig` | `TcxLookupComboBox` | — | `UnidOcupacao.Safra` (origem) | Sim (implícito) | Default: Safra corrente. |
| `cbSafraDest` | `TcxLookupComboBox` | — | `UnidOcupacao.Safra` (destino, novo valor) | Sim | — |
| `cxButton1` | `TcxButton` | "Copiar" (Hint: "Salvar como planilha" — **hint desatualizado/copiado de outra tela**, não reflete a ação real) | — | — | Executa a cópia. Mesmo resíduo de copiar/colar já achado em `[[ExportaDietas]]` (hint idêntico, ação diferente). |

**Achado:** o `Hint` do botão ("Salvar como planilha") não corresponde à ação real (copiar
Unidades de Ocupação entre Safras) — mesmo texto de hint desatualizado encontrado em
`[[ExportaDietas]]`, reforçando que as duas telas foram copiadas de um mesmo template.

---

## 5) Jornada do usuário + Especificação funcional

### SP-01 — Abrir a tela (`FormShow`)
Carrega Safras (`Tabelas.Tipo=1`); Safra Origem padrão = Safra corrente.

### SP-02 — Executar a cópia (`cxButton1Click`)

**Pseudocódigo fiel:**
```
validar Safra Destino selecionada
buscar todos os Sequencial de UnidOcupacao WHERE Safra = SafraOrigem
para cada Sequencial:
  INSERT INTO UnidOcupacao (Sequencial=(SELECT MAX(Sequencial)+1 FROM UnidOcupacao), Fazenda,
    Retiro, Tipo, Codigo, Ordem, Lado, Rua, OrdemRua, AreaM2, AreaHa, CapacidadeUA, Estado,
    FormaUso, ComprimentoCocho, CochoCoberto, Sombra, Arracoar, Salgar, TipoCapim, Funcionario,
    Safra=SafraDestino, Caminhao)
  (SELECT ... FROM UnidOcupacao WHERE Sequencial = <Sequencial atual>)
exibir "Dados Copiados com Sucesso"
```

### 5.3 Regras de negócio e validações

- **BR-001 — Safra Destino obrigatória.** Mensagem: "Escolha uma Safra Destino Para Exportar os
  Dados".
- **Achado de risco (destacado acima):** geração de PK via `MAX(Sequencial)+1` em vez de
  `LoadSequencia`, com risco de condição de corrida em uso concorrente.
- **Sem validação de duplicidade:** não há verificação de que a Safra Destino já possua
  Unidades de Ocupação com o mesmo `Codigo` — executar a exportação 2 vezes para a mesma Safra
  Destino duplica todos os registros (achado de risco adicional).

---

## 6) Integrações e dados

### 6.1 Integrações (internas)

Nenhuma — unit autocontida.

### 6.2 Modelo de dados

Grava em **`UnidOcupacao`** (já documentada via `[[EdUnidOcupacao]]`/`[[IncAutUnidOcup]]`), sem
tabela própria.

### 6.3 Triggers e Procedures do banco

Nenhuma identificada nesta unit.

---

## 7) Suporte: FAQ, mensagens, erros e troubleshooting

### 7.2 Catálogo de mensagens e erros

| Mensagem exata | Causa |
|---|---|
| "Escolha uma Safra Destino Para Exportar os Dados" | Safra Destino não selecionada |
| "Dados Copiados com Sucesso" | Sucesso |

---

## 9) Notas de revisão

- **2026-09-02** (auditoria campo-a-campo — módulo Pecuária)
  - **O que mudou:** achado adicional — o `Hint` do botão de execução ("Salvar como planilha")
    não corresponde à ação real (copiar Unidades de Ocupação entre Safras); mesmo texto de hint
    desatualizado encontrado em `[[ExportaDietas]]`, reforçando que as duas telas foram copiadas
    de um mesmo template. Dicionário de campos confirmado exaustivo (tela pequena, 2 combos + 1
    botão).
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** código-fonte `Pecuaria/ExportaUnidOcup.pas` + `.dfm`; ver `[[ExportaDietas]]`.

- **2026-08-28** (criação da nota — módulo Pecuária)
  - **O que mudou:** nota criada do zero, a partir de leitura 100% literal de
    `Pecuaria/ExportaUnidOcup.pas` (109 linhas). Documentada a cópia de U.O. entre Safras.
    **Achados de risco:** geração de PK via `MAX(Sequencial)+1` (não usa `LoadSequencia`, padrão
    do resto do módulo — risco de condição de corrida) e ausência de validação de duplicidade
    (execução repetida duplica registros).
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** código-fonte `Pecuaria/ExportaUnidOcup.pas` + `.dfm`; ver `[[UnidOcupacao]]`.
