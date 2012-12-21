DS.CouchDBSerializer = DS.JSONSerializer.extend({
  typeAttribute: 'ember_type',

  materialize: function(record, data) {
    this._super.apply(this, arguments);
    if (data.rev || data._rev) record.materializeAttribute('_rev', data.rev || data._rev);
  },
  serialize: function(record, options) {
    var json = this._super.apply(this, arguments);

    // add revision
    this.addRevision(json, record, options);

    // add type
    this.addTypeAttribute(json, record);

    return json;
  },
  stringForType: function(type) {
    return type.toString();
  },
  addId: function(json, key, id) {
    json._id = id;
  },
  addRevision: function(json, record, options) {
    if (options && options.includeId) {
      var rev = record.get('_data.attributes._rev');
      if (rev) json._rev = rev;
    }
  },
  addTypeAttribute: function(json, record) {
    var typeAttribute = this.get('typeAttribute');
    json[typeAttribute] = this.stringForType(record.constructor);
  },
  addAttribute: function(data, key, value) {
    if (Ember.isNone(value)) return;
    this._super.apply(this, arguments);
  },
  addHasMany: function(data, record, key, relationship) {
    if (Ember.get(relationship, 'options.ignore') === true) return;

    var value = record.get(key);
    if (!Ember.isEmpty(value)) {
      data[key] = value.getEach('id');
    }
  },
  addBelongsTo: function(hash, record, key, relationship) {
    if (Ember.get(relationship, 'options.ignore') === true) return;

    var id = get(record, relationship.key + '.id');
    if (!Ember.isNone(id)) { hash[key] = id; }
  }
});

DS.CouchDBAdapter = DS.Adapter.extend({
  serializer: DS.CouchDBSerializer,

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

  stringForType: function(type) {
    return this.get('serializer').stringForType(type);
  },

  ajax: function(url, type, hash) {
    var db = this.get('db');
    return this._ajax('/%@/%@'.fmt(db, url || ''), type, hash);
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
    this.ajax('_all_docs', 'POST', {
      data: {
        include_docs: true,
        keys: ids
      },
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
      this.ajax('_design/%@/_view/%@'.fmt(designDoc, typeViewName), 'GET', {
        context: this,
        data: {
          include_docs: true,
          key: typeString
        },
        success: function(data) {
          this._loadMany(store, type, data.rows.getEach('doc'));
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
        store.didSaveRecord(record, data);
      }
    });
  },

  updateRecord: function(store, type, record) {
    var json = this.serialize(record, { includeId: true });
    this.ajax(record.get('id'), 'PUT', {
      data: json,
      context: this,
      success: function(data) {
        // tell store that the record has been updated; also update to the new revision
        store.didSaveRecord(record, Ember.$.extend({}, json, {
          id: data.id,
          rev: data.rev
        }));
      },
      error: function(xhr, textStatus, errorThrown) {
        if (xhr.status === 409) {
          store.recordWasError(record);
        }
      }
    });
  },

  deleteRecord: function(store, type, record) {
    this.ajax(record.get('id'), 'DELETE', {
      context: this,
      data: {
        rev: record.get('_data.attributes._rev')
      },
      success: function(data) {
        store.didSaveRecord(record);
      }
    });
  },

  dirtyRecordsForBelongsToChange: Ember.K,

  dirtyRecordsForHasManyChange: function(dirtySet, parent) {
    dirtySet.add(parent);
  }
});
