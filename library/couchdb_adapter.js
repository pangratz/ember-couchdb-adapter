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

    var adapter = this;
    var responseCallbacks = [];
    var data = [];
    commitDetails.created.eachType(function(type, array) {
      data.pushObjects(array.map(function(record) {
        var json = {};
        responseCallbacks.pushObject(adapter._createRecord(store, type, record, json));
        return json;
      }));
    });
    commitDetails.updated.eachType(function(type, array) {
      data.pushObjects(array.map(function(record) {
        var json = {};
        responseCallbacks.pushObject(adapter._updateRecord(store, type, record, json));
        return json;
      }));
    });
    commitDetails.deleted.eachType(function(type, array) {
      data.pushObjects(array.map(function(record) {
        var json = {};
        responseCallbacks.pushObject(adapter._deleteRecord(store, type, record, json));
        return json;
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

  _createRecord: function(store, type, record, hash) {
    var json = record.toJSON();
    delete json.rev;
    $.extend(hash, json);

    return function(data) {
      store.didCreateRecord(record, $.extend(json, data));
    };
  },

  _updateRecord: function(store, type, record, hash) {
    var json = record.toJSON();
    json._id = json.id;
    json._rev = json.rev;
    delete json.id;
    delete json.rev;
    $.extend(hash, json);

    return function(data) {
      store.didUpdateRecord(record, $.extend(json, data));
    };
  },

  _deleteRecord: function(store, type, record, hash) {
    var json = {
      _id: record.get('id'),
      _rev: record.get('rev'),
      _deleted: true
    };    
    $.extend(hash, json);

    return function(data) {
      store.didDeleteRecord(record);
    };
  },

  createRecord: function(store, type, record) {
    var json = {};
    this.ajax('', 'POST', {
      data: json,
      context: this,
      success: this._createRecord(store, type, record, json)
    });
  },

  updateRecord: function(store, type, record) {
    var json = {};
    this.ajax(record.get('id'), 'PUT', {
      data: json,
      context: this,
      success: this._updateRecord(store, type, record, json)
    });
  },

  deleteRecord: function(store, type, record) {
    var json = {};
    this.ajax(record.get('id') + '?rev=' + record.get('rev'), 'DELETE', {
      context: this,
      success: this._deleteRecord(store, type, record, json)
    });
  }
});