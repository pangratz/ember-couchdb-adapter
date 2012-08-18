CouchDBModel = Ember.Mixin.create({
  rev: DS.attr('string')
});

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
    var designDoc = this.get('designDoc');
    if (query.type === 'view') {
      this.ajax('_design/%@/_view/%@'.fmt(query.designDoc || designDoc, query.viewName), 'GET', {});
    }
  },

  findAll: Ember.K,

  commit: function(store, commitDetails) {
    if (!this.get('bulkCommit')) {
      return this._super(store, commitDetails);
    }

    var responseCallbacks = [];
    var data = [];
    commitDetails.created.eachType(function(type, array) {
      data.pushObjects(array.map(function(record) {
        responseCallbacks.pushObject(function(response) {
          store.didCreateRecord(record, $.extend(json, response));
        });
        var json = record.toJSON();
        delete json.rev;
        return json;
      }));
    });
    commitDetails.updated.eachType(function(type, array) {
      data.pushObjects(array.map(function(record) {
        responseCallbacks.pushObject(function(response) {
          store.didUpdateRecord(record, $.extend(json, response));
        });
        var json = record.toJSON();
        json._id = json.id;
        json._rev = json.rev;
        delete json.id;
        delete json.rev;
        return json;
      }));
    });
    commitDetails.deleted.eachType(function(type, array) {
      data.pushObjects(array.map(function(record) {
        responseCallbacks.pushObject(function(response) {
          store.didDeleteRecord(record);
        });
        return {
          _id: record.get('id'),
          _rev: record.get('rev'),
          _deleted: true
        };
      }));
    });
    this.ajax('_bulk_docs', 'POST', {
      data: { docs: data },
      context: this,
      success: function(response) {
        responseCallbacks.forEach(function(callback, index) {
          callback(response[index]);
        });
      }
    });
  },

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
      context: this,
      success: function(data) {
        store.didDeleteRecord(record);
      }
    });
  }
});