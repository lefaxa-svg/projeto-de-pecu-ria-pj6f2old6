migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    // 1. Animais
    const animais = new Collection({
      name: 'animais',
      type: 'base',
      listRule: "@request.auth.id != '' && dono_id = @request.auth.id",
      viewRule: "@request.auth.id != '' && dono_id = @request.auth.id",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && dono_id = @request.auth.id",
      deleteRule: "@request.auth.id != '' && dono_id = @request.auth.id",
      fields: [
        { name: 'brinco', type: 'text', required: true },
        { name: 'nome', type: 'text' },
        {
          name: 'categoria',
          type: 'select',
          values: ['bezerro', 'novilha', 'novilho', 'vaca', 'touro'],
          maxSelect: 1,
          required: true,
        },
        { name: 'sexo', type: 'select', values: ['macho', 'femea'], maxSelect: 1, required: true },
        {
          name: 'raca',
          type: 'select',
          values: ['Nelore', 'Angus', 'Brahman', 'Guzerá', 'Simental', 'Cruzado', 'Outra'],
          maxSelect: 1,
          required: true,
        },
        { name: 'data_nascimento', type: 'date' },
        { name: 'peso_inicial', type: 'number' },
        {
          name: 'status',
          type: 'select',
          values: ['ativo', 'vendido', 'obito', 'descarte'],
          maxSelect: 1,
          required: true,
        },
        { name: 'observacoes', type: 'text' },
        {
          name: 'foto',
          type: 'file',
          maxSelect: 1,
          maxSize: 5242880,
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        },
        {
          name: 'dono_id',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          required: true,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_animais_dono_brinco ON animais (dono_id, brinco)',
        'CREATE INDEX idx_animais_categoria ON animais (categoria)',
        'CREATE INDEX idx_animais_status ON animais (status)',
      ],
    })
    app.save(animais)

    const animaisId = app.findCollectionByNameOrId('animais').id

    // 2. Pesagens
    const pesagens = new Collection({
      name: 'pesagens',
      type: 'base',
      listRule: "@request.auth.id != '' && dono_id = @request.auth.id",
      viewRule: "@request.auth.id != '' && dono_id = @request.auth.id",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && dono_id = @request.auth.id",
      deleteRule: "@request.auth.id != '' && dono_id = @request.auth.id",
      fields: [
        {
          name: 'animal_id',
          type: 'relation',
          collectionId: animaisId,
          required: true,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'data', type: 'date', required: true },
        { name: 'peso', type: 'number', required: true },
        { name: 'observacoes', type: 'text' },
        {
          name: 'dono_id',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          required: true,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_pesagens_animal_data ON pesagens (animal_id, data DESC)',
        'CREATE INDEX idx_pesagens_dono ON pesagens (dono_id)',
      ],
    })
    app.save(pesagens)

    // 3. Reprodução
    const reproducao = new Collection({
      name: 'reproducao',
      type: 'base',
      listRule: "@request.auth.id != '' && dono_id = @request.auth.id",
      viewRule: "@request.auth.id != '' && dono_id = @request.auth.id",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && dono_id = @request.auth.id",
      deleteRule: "@request.auth.id != '' && dono_id = @request.auth.id",
      fields: [
        {
          name: 'animal_id',
          type: 'relation',
          collectionId: animaisId,
          required: true,
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          name: 'tipo',
          type: 'select',
          values: ['inseminacao', 'cobertura', 'parto', 'aborto'],
          maxSelect: 1,
          required: true,
        },
        { name: 'data', type: 'date', required: true },
        { name: 'touro_semen', type: 'text' },
        {
          name: 'status',
          type: 'select',
          values: ['aguardando', 'prenha', 'nao_prenha', 'nascido'],
          maxSelect: 1,
          required: true,
        },
        { name: 'observacoes', type: 'text' },
        {
          name: 'dono_id',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          required: true,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_reproducao_animal ON reproducao (animal_id)',
        'CREATE INDEX idx_reproducao_status ON reproducao (status)',
        'CREATE INDEX idx_reproducao_dono ON reproducao (dono_id)',
      ],
    })
    app.save(reproducao)

    // 4. Sanidade
    const sanidade = new Collection({
      name: 'sanidade',
      type: 'base',
      listRule: "@request.auth.id != '' && dono_id = @request.auth.id",
      viewRule: "@request.auth.id != '' && dono_id = @request.auth.id",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && dono_id = @request.auth.id",
      deleteRule: "@request.auth.id != '' && dono_id = @request.auth.id",
      fields: [
        {
          name: 'animal_id',
          type: 'relation',
          collectionId: animaisId,
          required: true,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'data', type: 'date', required: true },
        {
          name: 'tipo',
          type: 'select',
          values: ['vacina', 'medicamento', 'diagnostico', 'cirurgia'],
          maxSelect: 1,
          required: true,
        },
        { name: 'descricao', type: 'text', required: true },
        { name: 'produto', type: 'text' },
        { name: 'dose', type: 'text' },
        { name: 'proxima_dose', type: 'date' },
        { name: 'veterinario', type: 'text' },
        { name: 'observacoes', type: 'text' },
        {
          name: 'dono_id',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          required: true,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_sanidade_animal ON sanidade (animal_id)',
        'CREATE INDEX idx_sanidade_dono ON sanidade (dono_id)',
        'CREATE INDEX idx_sanidade_proxima_dose ON sanidade (proxima_dose)',
      ],
    })
    app.save(sanidade)

    // 5. Alimentação
    const alimentacao = new Collection({
      name: 'alimentacao',
      type: 'base',
      listRule: "@request.auth.id != '' && dono_id = @request.auth.id",
      viewRule: "@request.auth.id != '' && dono_id = @request.auth.id",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && dono_id = @request.auth.id",
      deleteRule: "@request.auth.id != '' && dono_id = @request.auth.id",
      fields: [
        {
          name: 'animal_id',
          type: 'relation',
          collectionId: animaisId,
          required: false,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'data', type: 'date', required: true },
        {
          name: 'alimento',
          type: 'select',
          values: ['silagem', 'racao', 'sal_mineral', 'pasto'],
          maxSelect: 1,
          required: true,
        },
        { name: 'quantidade_kg', type: 'number', required: true },
        { name: 'suplemento', type: 'text' },
        { name: 'observacoes', type: 'text' },
        {
          name: 'dono_id',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          required: true,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_alimentacao_dono ON alimentacao (dono_id)',
        'CREATE INDEX idx_alimentacao_data ON alimentacao (data DESC)',
      ],
    })
    app.save(alimentacao)

    // 6. Produção de Leite
    const producaoLeite = new Collection({
      name: 'producao_leite',
      type: 'base',
      listRule: "@request.auth.id != '' && dono_id = @request.auth.id",
      viewRule: "@request.auth.id != '' && dono_id = @request.auth.id",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && dono_id = @request.auth.id",
      deleteRule: "@request.auth.id != '' && dono_id = @request.auth.id",
      fields: [
        {
          name: 'animal_id',
          type: 'relation',
          collectionId: animaisId,
          required: true,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'data', type: 'date', required: true },
        { name: 'quantidade_litros', type: 'number', required: true },
        { name: 'turno', type: 'select', values: ['manha', 'tarde'], maxSelect: 1, required: true },
        { name: 'observacoes', type: 'text' },
        {
          name: 'dono_id',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          required: true,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_producao_animal_data ON producao_leite (animal_id, data DESC)',
        'CREATE INDEX idx_producao_dono ON producao_leite (dono_id)',
      ],
    })
    app.save(producaoLeite)
  },
  (app) => {
    const collections = [
      'producao_leite',
      'alimentacao',
      'sanidade',
      'reproducao',
      'pesagens',
      'animais',
    ]
    for (const name of collections) {
      try {
        const col = app.findCollectionByNameOrId(name)
        app.delete(col)
      } catch (_) {}
    }
  },
)
