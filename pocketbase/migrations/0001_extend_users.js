migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    if (!users.fields.getByName('fazenda_nome')) {
      users.fields.add(new TextField({ name: 'fazenda_nome' }))
      app.save(users)
    }
  },
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const field = users.fields.getByName('fazenda_nome')
    if (field) {
      users.fields.removeById(field.id)
      app.save(users)
    }
  },
)
