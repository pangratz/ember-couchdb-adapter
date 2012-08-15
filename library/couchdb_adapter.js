DS.CouchDBAdapter = DS.Adapter.extend({
  ajax: function(url, type, hash) {
  },

  find: function(store, type, id) {
    this.ajax('/db/' + id, 'GET', {});
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

  createRecord: Ember.K,
  updateRecord: Ember.K,
  deleteRecord: Ember.K
});