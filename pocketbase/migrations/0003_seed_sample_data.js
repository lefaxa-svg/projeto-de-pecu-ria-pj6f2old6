migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    let user
    try {
      user = app.findAuthRecordByEmail('_pb_users_auth_', 'lefaxa@icloud.com')
    } catch (_) {
      user = new Record(users)
      user.setEmail('lefaxa@icloud.com')
      user.setPassword('Skip@Pass')
      user.setVerified(true)
      user.set('name', 'Produtor Rural')
      user.set('fazenda_nome', 'Fazenda Esperança')
      app.save(user)
    }

    const userId = user.id
    const animaisCol = app.findCollectionByNameOrId('animais')
    const pesagensCol = app.findCollectionByNameOrId('pesagens')
    const reproducaoCol = app.findCollectionByNameOrId('reproducao')
    const sanidadeCol = app.findCollectionByNameOrId('sanidade')
    const alimentacaoCol = app.findCollectionByNameOrId('alimentacao')
    const producaoCol = app.findCollectionByNameOrId('producao_leite')

    // Helper to find or create animal
    const sampleAnimals = [
      {
        brinco: 'BR-042',
        nome: 'Mimosa',
        categoria: 'vaca',
        sexo: 'femea',
        raca: 'Nelore',
        data_nascimento: '2020-04-12',
        peso_inicial: 480,
        status: 'ativo',
        observacoes: 'Matriz de alta produção leiteira e excelente docilidade.',
      },
      {
        brinco: 'BR-105',
        nome: 'Trovão',
        categoria: 'touro',
        sexo: 'macho',
        raca: 'Angus',
        data_nascimento: '2019-08-20',
        peso_inicial: 840,
        status: 'ativo',
        observacoes: 'Reprodutor P.O., linhagem nobre americana.',
      },
      {
        brinco: 'BR-214',
        nome: 'Estrela',
        categoria: 'novilha',
        sexo: 'femea',
        raca: 'Guzerá',
        data_nascimento: '2022-11-05',
        peso_inicial: 340,
        status: 'ativo',
        observacoes: 'Previsão de primeira inseminação neste semestre.',
      },
      {
        brinco: 'BR-330',
        nome: 'Faísca',
        categoria: 'bezerro',
        sexo: 'macho',
        raca: 'Cruzado',
        data_nascimento: '2024-06-15',
        peso_inicial: 110,
        status: 'ativo',
        observacoes: 'Desmame recente, excelente conversão alimentar.',
      },
      {
        brinco: 'BR-408',
        nome: 'Sertaneja',
        categoria: 'vaca',
        sexo: 'femea',
        raca: 'Simental',
        data_nascimento: '2021-02-18',
        peso_inicial: 520,
        status: 'ativo',
        observacoes: 'Lactação de pico, controle diário de pesagem de leite.',
      },
      {
        brinco: 'BR-512',
        nome: 'Barão',
        categoria: 'novilho',
        sexo: 'macho',
        raca: 'Nelore',
        data_nascimento: '2023-03-10',
        peso_inicial: 390,
        status: 'ativo',
        observacoes: 'Lote de engorda a pasto com suplementação mineral.',
      },
    ]

    const createdAnimalMap = {}

    for (const item of sampleAnimals) {
      try {
        const existing = app.findFirstRecordByData('animais', 'brinco', item.brinco)
        createdAnimalMap[item.brinco] = existing.id
      } catch (_) {
        const rec = new Record(animaisCol)
        rec.set('brinco', item.brinco)
        rec.set('nome', item.nome)
        rec.set('categoria', item.categoria)
        rec.set('sexo', item.sexo)
        rec.set('raca', item.raca)
        rec.set('data_nascimento', item.data_nascimento)
        rec.set('peso_inicial', item.peso_inicial)
        rec.set('status', item.status)
        rec.set('observacoes', item.observacoes)
        rec.set('dono_id', userId)
        app.save(rec)
        createdAnimalMap[item.brinco] = rec.id
      }
    }

    // Sample Pesagens
    const mimosaId = createdAnimalMap['BR-042']
    const baraoId = createdAnimalMap['BR-512']

    if (mimosaId) {
      try {
        app.findFirstRecordByData('pesagens', 'animal_id', mimosaId)
      } catch (_) {
        const p1 = new Record(pesagensCol)
        p1.set('animal_id', mimosaId)
        p1.set('data', '2024-11-01')
        p1.set('peso', 485)
        p1.set('observacoes', 'Pesagem pós-parto')
        p1.set('dono_id', userId)
        app.save(p1)

        const p2 = new Record(pesagensCol)
        p2.set('animal_id', mimosaId)
        p2.set('data', '2025-01-15')
        p2.set('peso', 510)
        p2.set('observacoes', 'Ganho regular em pastagem adubada')
        p2.set('dono_id', userId)
        app.save(p2)
      }
    }

    if (baraoId) {
      try {
        app.findFirstRecordByData('pesagens', 'animal_id', baraoId)
      } catch (_) {
        const p3 = new Record(pesagensCol)
        p3.set('animal_id', baraoId)
        p3.set('data', '2024-12-10')
        p3.set('peso', 390)
        p3.set('observacoes', 'Entrada na fase de recria')
        p3.set('dono_id', userId)
        app.save(p3)

        const p4 = new Record(pesagensCol)
        p4.set('animal_id', baraoId)
        p4.set('data', '2025-02-18')
        p4.set('peso', 430)
        p4.set('observacoes', 'GMD satisfatório de 580g/dia')
        p4.set('dono_id', userId)
        app.save(p4)
      }
    }

    // Sample Reprodução
    if (mimosaId) {
      try {
        app.findFirstRecordByData('reproducao', 'animal_id', mimosaId)
      } catch (_) {
        const rep = new Record(reproducaoCol)
        rep.set('animal_id', mimosaId)
        rep.set('tipo', 'inseminacao')
        rep.set('data', '2024-05-20')
        rep.set('touro_semen', 'Touro Angus Absoluto 99')
        rep.set('status', 'prenha')
        rep.set('observacoes', 'Diagnóstico de gestação confirmado por ultrassom aos 35 dias.')
        rep.set('dono_id', userId)
        app.save(rep)
      }
    }

    // Sample Sanidade
    if (mimosaId) {
      try {
        app.findFirstRecordByData('sanidade', 'animal_id', mimosaId)
      } catch (_) {
        const san = new Record(sanidadeCol)
        san.set('animal_id', mimosaId)
        san.set('data', '2025-01-10')
        san.set('tipo', 'vacina')
        san.set('descricao', 'Vacinação contra Febre Aftosa')
        san.set('produto', 'Aftosa Bivalente')
        san.set('dose', '2 ml subcutânea')
        san.set('proxima_dose', '2025-07-10')
        san.set('veterinario', 'Dr. Carlos Mendes - CRMV 4412')
        san.set('observacoes', 'Sem reações adversas pós-vacinais.')
        san.set('dono_id', userId)
        app.save(san)
      }
    }

    // Sample Alimentação
    try {
      app.findFirstRecordByData('alimentacao', 'dono_id', userId)
    } catch (_) {
      const alim = new Record(alimentacaoCol)
      if (mimosaId) alim.set('animal_id', mimosaId)
      alim.set('data', '2025-02-20')
      alim.set('alimento', 'silagem')
      alim.set('quantidade_kg', 25)
      alim.set('suplemento', 'Sal mineralizado proteinado 40%')
      alim.set('observacoes', 'Trato matinal fornecido no cocho coberto.')
      alim.set('dono_id', userId)
      app.save(alim)
    }

    // Sample Produção Leite
    if (mimosaId) {
      try {
        app.findFirstRecordByData('producao_leite', 'animal_id', mimosaId)
      } catch (_) {
        const prod1 = new Record(producaoCol)
        prod1.set('animal_id', mimosaId)
        prod1.set('data', '2025-02-22')
        prod1.set('quantidade_litros', 18.5)
        prod1.set('turno', 'manha')
        prod1.set('observacoes', 'Ordenha mecânica com pré e pós-dipping.')
        prod1.set('dono_id', userId)
        app.save(prod1)

        const prod2 = new Record(producaoCol)
        prod2.set('animal_id', mimosaId)
        prod2.set('data', '2025-02-22')
        prod2.set('quantidade_litros', 12.0)
        prod2.set('turno', 'tarde')
        prod2.set('observacoes', 'Ordenha vespertina normal.')
        prod2.set('dono_id', userId)
        app.save(prod2)
      }
    }
  },
  (app) => {
    // down rollback
  },
)
