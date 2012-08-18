CouchDBModel = Ember.Mixin.create({
  rev: DS.attr('string')
});

DS.CouchDBAdapter = DS.Adapter.extend({
  typeAttribute: 'ember_type',
  typeViewName: 'by-ember-type',

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

  find: function(store, type, id) {
    this.ajax(id, 'GET', {
      context: this,
      success: function(data) {
        store.load(type, data);
      }
    });
  },

  findMany: function(store, type, ids) {
    this.ajax('_all_docs?include_docs=true', 'POST', {
      data: { keys: ids },
      context: this,
      success: function(data) {
        store.loadMany(type, data.rows.getEach('doc'));
      }
    });
  },

  findQuery: function(store, type, query, modelArray) {
    var designDoc = this.get('designDoc');
    if (query.type === 'view') {
      this.ajax('_design/%@/_view/%@'.fmt(query.designDoc || designDoc, query.viewName), 'GET', {});
    }
  },

  findAll: function(store, type) {
    var designDoc = this.get('designDoc');
    var typeViewName = this.get('typeViewName');
    var typeString = this.stringForType(type);
    this.ajax('_design/%@/_view/%@?include_docs=true&key="%@"'.fmt(designDoc, typeViewName, typeString), 'GET', {
      context: this,
      success: function(data) {
        store.loadMany(type, data.rows.getEach('doc'));
      }
    });
  },

  createRecord: function(store, type, record) {
    var json = record.toJSON();
    this.addTypeProperty(json, type);
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
    this.addTypeProperty(json, type);
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