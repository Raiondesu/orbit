import {
  evented,
  Evented
} from '@orbit/core';
import { isArray } from '@orbit/utils';
import {
  KeyMap,
  Record,
  RecordOperation,
  Schema,
  QueryBuilder,
  QueryOrExpression,
  QueryExpression,
  buildQuery,
  TransformBuilder,
  TransformBuilderFunc,
  RecordIdentity
} from '@orbit/data';
import { SyncOperationProcessor, SyncOperationProcessorClass } from './sync-operation-processor';
import CacheIntegrityProcessor from './sync-operation-processors/cache-integrity-processor';
import SchemaConsistencyProcessor from './sync-operation-processors/schema-consistency-processor';
import SchemaValidationProcessor from './sync-operation-processors/schema-validation-processor';
import { PatchOperators } from './operators/patch-operators';
import { QueryOperators } from './operators/query-operators';
import InversePatchOperators, { InversePatchOperator } from './operators/inverse-patch-operators';
import { SyncRecordAccessor, SyncRecordAccessorSettings } from './sync-record-accessor';

export type PatchResultData = Record | RecordIdentity | null;

export interface PatchResult {
  inverse: RecordOperation[],
  data: PatchResultData[]
}

export interface SyncRecordCacheSettings extends SyncRecordAccessorSettings {
  processors?: SyncOperationProcessorClass[];
  transformBuilder?: TransformBuilder;
  queryBuilder?: QueryBuilder;
}

@evented
export abstract class SyncRecordCache extends SyncRecordAccessor implements Evented {
  protected _keyMap: KeyMap;
  protected _schema: Schema;
  protected _transformBuilder: TransformBuilder;
  protected _queryBuilder: QueryBuilder;
  protected _processors: SyncOperationProcessor[];

  // Evented interface stubs
  on: (event: string, callback: Function, binding?: object) => void;
  off: (event: string, callback: Function, binding?: object) => void;
  one: (event: string, callback: Function, binding?: object) => void;
  emit: (event: string, ...args) => void;
  listeners: (event: string) => any[];

  constructor(settings: SyncRecordCacheSettings) {
    super(settings);

    this._queryBuilder = settings.queryBuilder || new QueryBuilder();

    this._transformBuilder = settings.transformBuilder || new TransformBuilder({
      recordInitializer: this._schema
    });

    const processors: SyncOperationProcessorClass[] = settings.processors ? settings.processors : [SchemaValidationProcessor, SchemaConsistencyProcessor, CacheIntegrityProcessor];
    this._processors = processors.map(Processor => new Processor(this));
  }

  get queryBuilder(): QueryBuilder {
    return this._queryBuilder;
  }

  get transformBuilder(): TransformBuilder {
    return this._transformBuilder;
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
   * Patches the document with an operation.
   *
   * @param {(Operation | Operation[] | TransformBuilderFunc)} operationOrOperations
   * @returns {Operation[]}
   * @memberof Cache
   */
  patch(operationOrOperations: RecordOperation | RecordOperation[] | TransformBuilderFunc): PatchResult {
    if (typeof operationOrOperations === 'function') {
      operationOrOperations = <RecordOperation | RecordOperation[]>operationOrOperations(this._transformBuilder);
    }

    const result: PatchResult = {
      inverse: [],
      data: []
    }

    if (isArray(operationOrOperations)) {
      this._applyOperations(<RecordOperation[]>operationOrOperations, result, true);

    } else {
      this._applyOperation(<RecordOperation>operationOrOperations, result, true);
    }

    result.inverse.reverse();

    return result;
  }

  /////////////////////////////////////////////////////////////////////////////
  // Protected methods
  /////////////////////////////////////////////////////////////////////////////

  protected _query(expression: QueryExpression): any {
    const operator = QueryOperators[expression.op];
    if (!operator) {
      throw new Error('Unable to find operator: ' + expression.op);
    }
    return operator(this, expression);
  }

  protected _applyOperations(ops: RecordOperation[], result: PatchResult, primary: boolean = false) {
    ops.forEach(op => this._applyOperation(op, result, primary));
  }

  protected _applyOperation(operation: RecordOperation, result: PatchResult, primary: boolean = false) {
    this._processors.forEach(processor => processor.validate(operation));

    const inverseTransform: InversePatchOperator = InversePatchOperators[ operation.op ];
    const inverseOp: RecordOperation = inverseTransform(this, operation);

    if (inverseOp) {
      result.inverse.push(inverseOp);

      // Query and perform related `before` operations
      this._processors
          .map(processor => processor.before(operation))
          .forEach(ops => this._applyOperations(ops, result));

      // Query related `after` operations before performing
      // the requested operation. These will be applied on success.
      let preparedOps = this._processors.map(processor => processor.after(operation));

      // Perform the requested operation
      let operator = PatchOperators[operation.op];
      let data = operator(this, operation);
      if (primary) {
        result.data.push(data);
      }

      // Query and perform related `immediate` operations
      this._processors
          .forEach(processor => processor.immediate(operation));

      // Emit event
      this.emit('patch', operation, data);

      // Perform prepared operations after performing the requested operation
      preparedOps.forEach(ops => this._applyOperations(ops, result));

      // Query and perform related `finally` operations
      this._processors
          .map(processor => processor.finally(operation))
          .forEach(ops => this._applyOperations(ops, result));
    } else if (primary) {
      result.data.push(null);
    }
  }
};
