DS.CouchDBSerializer = DS.Serializer.extend({
  primaryKey: function(type) {
    return "_id";
  },
  extractId: function(type, hash) {
    return hash._id || hash.id;
  },
  materializeFromJSON: function(record, hash) {
    this._super.apply(this, arguments);
    record.materializeAttribute("_rev", hash.rev || hash._rev);
    record.materializeAttribute("_id", hash.id || hash._id);
  },
  toJSON: function(record, options) {
    var json = this._super.apply(this, arguments);
    var rev = record.get('_data.attributes._rev');
    if (rev) json._rev = rev;
    json.ember_type = record.constructor.toString();
    return json;
  }
});

DS.CouchDBAdapter = DS.Adapter.extend({
  typeAttribute: 'ember_type',
  typeViewName: 'by-ember-type',
  customTypeLookup: false,

  serializer: DS.CouchDBSerializer,

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

  shouldCommit: function(record, relationships) {
    return this._super.apply(arguments);
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

  find: function(store, type, id) {
    this.ajax(id, 'GET', {
      context: this,
      success: function(data) {
        store.loadMany(type, [data]);
      }
    });
  },

  findMany: function(store, type, ids) {
    this.ajax('_all_docs', 'POST', {
      data: {
        include_docs: true,
        keys: ids
      },
      context: this,
      success: function(data) {
        store.loadMany(type, data.rows.getEach('doc'));
      }
    });
  },

  findQuery: function(store, type, query, modelArray) {
    var designDoc = this.get('designDoc');
    if (query.type === 'view') {
      this.ajax('_design/%@/_view/%@'.fmt(query.designDoc || designDoc, query.viewName), 'GET', {
        data: query.options,
        success: function(data) {
          modelArray.load(data.rows.getEach('doc'));
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
          store.loadMany(type, data.rows.getEach('doc'));
        }
      });
    } else {
      var typeViewName = this.get('typeViewName');
      var typeString = this.stringForType(type);
      this.ajax('_design/%@/_view/%@'.fmt(designDoc, typeViewName), 'GET', {
        context: this,
        data: {
          include_docs: true,
          key: encodeURI('"' + typeString + '"')
        },
        success: function(data) {
          store.loadMany(type, data.rows.getEach('doc'));
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
        store.didSaveRecord(record, $.extend(json, data));
      }
    });
  },

  updateRecord: function(store, type, record) {
    var json = record.toJSON({associations: true, includeId: true });
    this.ajax(record.get('id'), 'PUT', {
      data: json,
      context: this,
      success: function(data) {
        store.didSaveRecord(record, $.extend(json, data));
      },
      error: function(xhr, textStatus, errorThrown) {
        if (xhr.status === 409) {
          store.recordWasInvalid(record, {});
        }
      }
    });
  },

  deleteRecord: function(store, type, record) {
    this.ajax(record.get('id') + '?rev=' + record.get('_data.attributes._rev'), 'DELETE', {
      context: this,
      success: function(data) {
        store.didDeleteRecord(record);
      }
    });
  }
});