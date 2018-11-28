/* eslint-disable valid-jsdoc */
import { clone, Dict } from '@orbit/utils';
import {
  Record,
  RecordIdentity,
  QueryOrExpression,
  QueryExpression,
  QueryBuilder,
  buildQuery
} from '@orbit/data';
import { QueryOperators } from './cache/query-operators';
import { SyncRecordCache, SyncRecordCacheSettings } from './sync-record-cache/sync-record-cache';
import { ImmutableMap } from '@orbit/immutable';
import { RelatedRecordIdentity } from './sync-record-cache/sync-record-cache';

export interface CacheSettings extends SyncRecordCacheSettings {
  base?: Cache;
  queryBuilder?: QueryBuilder;
}

/**
 * A `Cache` is an in-memory data store that can be accessed synchronously.
 *
 * Caches use operation processors to maintain internal consistency.
 *
 * Because data is stored in immutable maps, caches can be forked efficiently.
 */
export default class Cache extends SyncRecordCache {
  protected _queryBuilder: QueryBuilder;
  protected _records: Dict<ImmutableMap<string, Record>>;
  protected _inverseRelationships: Dict<ImmutableMap<string, RelatedRecordIdentity[]>>;

  constructor(settings: CacheSettings = {}) {
    super(settings);

    this._queryBuilder = settings.queryBuilder || new QueryBuilder();

    this.reset(settings.base);
  }

  getRecord(identity: RecordIdentity): Record {
    return this._records[identity.type].get(identity.id);
  }

  getRecords(type: string): Record[] {
    return Array.from(this._records[type].values());
  }

  getInverselyRelatedRecords(recordIdentity: RecordIdentity): RelatedRecordIdentity[] {
    return this._inverseRelationships[recordIdentity.type].get(recordIdentity.id) || [];
  }

  setRecord(record: Record): void {
    this._records[record.type].set(record.id, record);
  }

  setRecords(type: string, records: Record[]): void {
    // TODO
    // let map: [string, Record][] = records.map(entry => {
    //   return [entry.id, entry];
    // })
    // this._records[type].setMany(map);

    records.forEach(record => this.setRecord(record));
  }

  removeRecord(recordIdentity: RecordIdentity): null | Record {
    const recordMap = this._records[recordIdentity.type];
    const record = recordMap.get(recordIdentity.id);
    if (record) {
      recordMap.remove(recordIdentity.id);
      return record;
    } else {
      return null;
    }
  }

  removeRecords(type: string, recordIdentities: RecordIdentity[]): Record[] {
    const recordMap = this._records[type];
    const records = [];
    const ids = [];
    recordIdentities.forEach(recordIdentity => {
      let record = recordMap.get(recordIdentity.id);
      if (record) {
        records.push(record);
        ids.push(recordIdentity.id);
      }
    });
    recordMap.removeMany(ids);
    return records;
  }

  addInverselyRelatedRecord(recordIdentity: RecordIdentity, inverseRelationship: RelatedRecordIdentity): void {
    let rels = this._inverseRelationships[recordIdentity.type].get(recordIdentity.id);
    rels = rels ? clone(rels) : [];
    rels.push(inverseRelationship);
    this._inverseRelationships[recordIdentity.type].set(recordIdentity.id, rels);
  }

  removeInverselyRelatedRecord(recordIdentity: RecordIdentity, inverseRelationship: RelatedRecordIdentity): void {
    let rels = this._inverseRelationships[recordIdentity.type].get(recordIdentity.id);
    if (rels) {
      let newRels = rels.filter(r => !(r.record.type === inverseRelationship.record.type &&
                                       r.record.id === inverseRelationship.record.id &&
                                       r.relationship === inverseRelationship.relationship));
      this._inverseRelationships[recordIdentity.type].set(recordIdentity.id, newRels);
    }
  }

  removeInverseRelationships(recordIdentity: RecordIdentity): void {
    this._inverseRelationships[recordIdentity.type].remove(recordIdentity.id);
  }

  get queryBuilder(): QueryBuilder {
    return this._queryBuilder;
  }

  /**
   Allows a client to run queries against the cache.

   @example
   ``` javascript
   // using a query builder callback
   cache.query(qb.record('planet', 'idabc123')).then(results => {});
   ```

   @example
   ``` javascript
   // using an expression
   cache.query(oqe('record', 'planet', 'idabc123')).then(results => {});
   ```

   @method query
   @param {Expression} query
   @return {Object} result of query (type depends on query)
   */
  query(queryOrExpression: QueryOrExpression, options?: object, id?: string): any {
    const query = buildQuery(queryOrExpression, options, id, this._queryBuilder);
    return this._query(query.expression);
  }

  /**
   * Resets the cache's state to be either empty or to match the state of
   * another cache.
   *
   * @example
   * ``` javascript
   * cache.reset(); // empties cache
   * cache.reset(cache2); // clones the state of cache2
   * ```
   *
   * @param {Cache} [base]
   * @memberof Cache
   */
  reset(base?: Cache): void {
    this._records = {};

    Object.keys(this._schema.models).forEach(type => {
      let baseRecords = base && base._records[type];

      this._records[type] = new ImmutableMap<string, Record>(baseRecords);
    });

    this._resetInverseRelationships(base);

    this._processors.forEach(processor => processor.reset(base));

    this.emit('reset');
  }

  /**
   * Upgrade the cache based on the current state of the schema.
   *
   * @memberof Cache
   */
  upgrade() {
    Object.keys(this._schema.models).forEach(type => {
      if (!this._records[type]) {
        this._records[type] = new ImmutableMap<string, Record>();
      }
    });

    this._resetInverseRelationships();
    this._processors.forEach(processor => processor.upgrade());
  }

  /////////////////////////////////////////////////////////////////////////////
  // Protected methods
  /////////////////////////////////////////////////////////////////////////////

  protected _resetInverseRelationships(base?: Cache) {
    const inverseRelationships = {};
    Object.keys(this._schema.models).forEach(type => {
      let baseRelationships = base && base._inverseRelationships[type];
      inverseRelationships[type] = new ImmutableMap(baseRelationships);
    });
    this._inverseRelationships = inverseRelationships;
  }

  protected _query(expression: QueryExpression): any {
    const operator = QueryOperators[expression.op];
    if (!operator) {
      throw new Error('Unable to find operator: ' + expression.op);
    }
    return operator(this, expression);
  }
}
