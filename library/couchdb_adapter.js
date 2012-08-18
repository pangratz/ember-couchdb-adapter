DS.CouchDBAdapter = DS.Adapter.extend({
  _ajax: Ember.K,
  ajax: function(url, type, hash) {
    var db = this.get('db');
    return this._ajax('/%@/%@'.fmt(db, url), type, hash);
  },

  find: function(store, type, id) {
    this.ajax(id, 'GET', {
      data: {},
      context: this,
      success: function(data) {
        store.load(type, data);
      }
    });
  },

  findMany: Ember.K,

  findQuery: function(store, type, query, modelArray) {
    var db = this.get('db');
    var designDoc = this.get('designDoc');
    if (query.type === 'view') {
      this.ajax('/%@/_design/%@/_view/%@'.fmt(db, query.designDoc || designDoc, query.viewName), 'GET', {});
    }
  },

  findAll: Ember.K,

  createRecord: function(store, type, record) {
    var json = record.toJSON();
    delete json.rev;
    this.ajax('', 'POST', {
      data: json,
      context: this,
      success: function(data) {
        store.didCreateRecord(record, $.extend(json, data));
      }
    });
  },

  updateRecord: function(store, type, record) {
    var json = record.toJSON();
    json._id = json.id;
    json._rev = json.rev;
    delete json.id;
    delete json.rev;
    this.ajax(json._id, 'PUT', {
      data: json,
      context: this,
      success: function(data) {
        store.didUpdateRecord(record, $.extend(json, data));
      }
    });
  },

  deleteRecord: function(store, type, record) {
    this.ajax(record.get('id') + '?rev=' + record.get('rev'), 'DELETE', {
      data: {},
      context: this,
      success: function(data) {
        store.didDeleteRecord(record);
      }
    });
  }
});