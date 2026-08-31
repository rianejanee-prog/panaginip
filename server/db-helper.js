function wrapDb(database) {
  return {
    prepare(sql) {
      return {
        get(...params) {
          const stmt = database.prepare(sql);
          if (params.length > 0) stmt.bind(params);
          if (stmt.step()) {
            const row = stmt.getAsObject();
            stmt.free();
            return row;
          }
          stmt.free();
          return undefined;
        },
        all(...params) {
          const stmt = database.prepare(sql);
          if (params.length > 0) stmt.bind(params);
          const rows = [];
          while (stmt.step()) {
            rows.push(stmt.getAsObject());
          }
          stmt.free();
          return rows;
        },
        run(...params) {
          database.run(sql, params);
          const changes = database.getRowsModified();
          const lastRow = database.exec('SELECT last_insert_rowid() as id');
          const lastInsertRowid = lastRow.length > 0 ? lastRow[0].values[0][0] : 0;
          return { changes, lastInsertRowid };
        }
      };
    },
    exec(sql) {
      database.run(sql);
    },
    pragma(stmt) {
      database.run(stmt);
    }
  };
}

module.exports = { wrapDb };
