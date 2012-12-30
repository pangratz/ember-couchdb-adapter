DS.CouchDBSerializer = DS.JSONSerializer.extend({
  typeAttribute: 'ember_type',
  addEmptyHasMany: false,
  addEmptyBelongsTo: false,

  materialize: function(record, hash) {
    this._super.apply(this, arguments);
    record.materializeAttribute("_rev", hash.rev || hash._rev);
  },
  serialize: function(record, options) {
    var json = this._super.apply(this, arguments);
    this.addRevision(json, record, options);
    this.addTypeAttribute(json, record);
    return json;
  },

  extract: function(loader, json, type) {
    this.extractRecordRepresentation(loader, type, json);
  },

  extractId: function(type, hash) {
    return hash._id || hash.id;
  },
  stringForType: function(type) {
    return type.toString();
  },
  getRecordRevision: function(record) {
    return record.get('_data.attributes._rev');
  },

  addId: function(json, key, id) {
    json._id = id;
  },
  addRevision: function(json, record, options) {
    if (options && options.includeId) {
      var rev = this.getRecordRevision(record);
      if (rev) json._rev = rev;
    }
  },
  addTypeAttribute: function(json, record) {
    var typeAttribute = this.get('typeAttribute');
    json[typeAttribute] = this.stringForType(record.constructor);
  },
  addHasMany: function(data, record, key, relationship) {
    var value = record.get(key);
    if (this.get('addEmptyHasMany') || !Ember.empty(value)) {
      data[key] = value.getEach('id');
    }
  },
  addBelongsTo: function(hash, record, key, relationship) {
    var id = get(record, relationship.key + '.id');
    if (this.get('addEmptyBelongsTo') || !Ember.empty(id)) {
      hash[key] = id;
    }
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
    return this.get('serializer').stringForType(type);
  },

  find: function(store, type, id) {
    this.ajax(id, 'GET', {
      context: this,
      success: function(data) {
        this.didFindRecord(store, type, data, id);
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
    var json = this.serialize(record);
    this.ajax('', 'POST', {
      data: json,
      context: this,
      success: function(data) {
        store.didSaveRecord(record, $.extend(json, data));
      }
    });
  },

  updateRecord: function(store, type, record) {
    var json = this.serialize(record, {associations: true, includeId: true });
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
        store.didSaveRecord(record);
      }
    });
  }
});