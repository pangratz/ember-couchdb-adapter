DS.CouchDBAdapter = DS.Adapter.extend({
  typeAttribute: 'ember_type',
  typeViewName: 'by-ember-type',
  customTypeLookup: false,

  _ajax: function(url, type, hash) {
    hash.url = url;
    hash.type = type;
    hash.dataType = 'json';
    hash.contentType = 'application/json; charset=utf-8';
    hash.context = this;

    if (hash.data && type !== 'GET') {
      hash.data = JSON.stringify(hash.data);
    }

    Ember.$.ajax(hash);
  },

  ajax: function(url, type, hash) {
    var db = this.get('db');
    return this._ajax('/%@/%@'.fmt(db, url || ''), type, hash);
  },

  stringForType: function(type) {
    return type.toString();
  },

  addTypeProperty: function(json, type) {
    var typeAttribute = this.get('typeAttribute');
    json[typeAttribute] = this.stringForType(type);
  },

  _loadMany: function(store, type, docs) {
    // CouchDB returns id and revision of a document via _id and _rev, so we need to map it to id and rev
    store.loadMany(type, docs.map(function(record) {
      record.id = record._id;
      record.rev = record._rev;
      delete record._id;
      delete record._rev;
      return record;
    }));
  },

  find: function(store, type, id) {
    this.ajax(id, 'GET', {
      context: this,
      success: function(data) {
        this._loadMany(store, type, [data]);
      }
    });
  },

  findMany: function(store, type, ids) {
    this.ajax('_all_docs?include_docs=true', 'POST', {
      data: { keys: ids },
      context: this,
      success: function(data) {
        this._loadMany(store, type, data.rows.getEach('doc'));
      }
    });
  },

  findQuery: function(store, type, query, modelArray) {
    var designDoc = this.get('designDoc');
    if (query.type === 'view') {
      this.ajax('_design/%@/_view/%@'.fmt(query.designDoc || designDoc, query.viewName), 'GET', {
        data: query.options,
        success: function(data) {
          this._loadMany(modelArray, type, data);
        },
        context: this
      });
    }
  },

  findAll: function(store, type) {
    var designDoc = this.get('designDoc');
    if (this.get('customTypeLookup') === true && this.viewForType) {
      var params = {};
      var viewName = this.viewForType(type, params);
      params.include_docs = true;
      this.ajax('_design/%@/_view/%@'.fmt(designDoc, viewName), 'GET', {
        data: params,
        context: this,
        success: function(data) {
          this._loadMany(store, type, data.rows.getEach('doc'));
        }
      });
    } else {
      var typeViewName = this.get('typeViewName');
      var typeString = this.stringForType(type);
      this.ajax('_design/%@/_view/%@?include_docs=true&key="%@"'.fmt(designDoc, typeViewName, typeString), 'GET', {
        context: this,
        success: function(data) {
          this._loadMany(store, type, data.rows.getEach('doc'));
        }
      });
    }
  },

  createRecord: function(store, type, record) {
    var json = record.toJSON();
    this.addTypeProperty(json, type);
    this.ajax('', 'POST', {
      data: json,
      context: this,
      success: function(data) {
        store.didCreateRecord(record, $.extend(json, data));
      }
    });
  },

  updateRecord: function(store, type, record) {
    var json = record.toJSON({associations: true});
    this.addTypeProperty(json, type);
    json._id = json.id;
    json._rev = record.get('data.rev');
    delete json.id;
    this.ajax(json._id, 'PUT', {
      data: json,
      context: this,
      success: function(data) {
        store.didUpdateRecord(record, $.extend(json, data));
      }
    });
  },

  deleteRecord: function(store, type, record) {
    this.ajax(record.get('id') + '?rev=' + record.get('data.rev'), 'DELETE', {
      context: this,
      success: function(data) {
        store.didDeleteRecord(record);
      }
    });
  }
});