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

  serializer: DS.CouchDBSerializer,

  _ajax: function(url, type, hash) {
    hash.url = url;
    hash.type = type;
    hash.dataType = 'json';
    hash.contentType = 'application/json; charset=utf-8';
    hash.context = hash.context || this;

    if (hash.data && type !== 'GET') {
      hash.data = JSON.stringify(hash.data);
    }

    Ember.$.ajax(hash);
  },

  ajax: function(url, type, hash) {
    var dbName = this.get('dbName');
    var fullUrl = '/%@/%@'.fmt(dbName, url || '');

    this._ajax(fullUrl, type, hash);
  },

  view: function(viewOptions) {
    Ember.assert("viewOptions must have a 'viewName' property", viewOptions.viewName);

    var defaultOptions = {
      designDoc: this.get('designDoc'),
      data: {},
      success: function(data) {
        if (Ember.isEmpty(data, 'rows')) return;
        if (viewOptions.type) store.loadMany(viewOptions.type, data.rows.getEach('doc'));
      }
    };
    var merged = Ember.$.extend(defaultOptions, viewOptions);
    this.ajax('_design/%@/_view/%@'.fmt(merged.designDoc, merged.viewName), 'GET', merged);
  },

  stringForType: function(type) {
    return this.get('serializer').stringForType(type);
  },

  find: function(store, type, id) {
    this.ajax(id, 'GET', {
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
      success: function(data) {
        store.loadMany(type, data.rows.getEach('doc'));
      }
    });
  },

  findQuery: function(store, type, query, modelArray) {
    this.view(Ember.$.extend({
      success: function(data) {
        modelArray.load(data.rows.getEach('doc'));
      }
    }, query));
  },

  findAll: function(store, type) {
    this.view({
      viewName: this.get('typeViewName'),
      data: {
        include_docs: true,
        key: encodeURI('"' + this.stringForType(type) + '"')
      },
      success: function(data) {
        store.loadMany(type, data.rows.getEach('doc'));
      }
    });
  },

  createRecord: function(store, type, record) {
    var json = this.serialize(record);
    this.ajax('', 'POST', {
      data: json,
      success: function(data) {
        store.didSaveRecord(record, $.extend(json, data));
      }
    });
  },

  updateRecord: function(store, type, record) {
    var json = this.serialize(record, { includeId: true });
    this.ajax(record.get('id'), 'PUT', {
      data: json,
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
      success: function(data) {
        store.didSaveRecord(record);
      }
    });
  }
});
