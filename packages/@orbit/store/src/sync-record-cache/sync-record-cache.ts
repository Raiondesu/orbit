import {
  evented,
  Evented
} from '@orbit/core';
import { deepGet, isArray } from '@orbit/utils';
import {
  KeyMap,
  Record,
  RecordIdentity,
  RecordOperation,
  Schema,
  TransformBuilder,
  TransformBuilderFunc
} from '@orbit/data';
import { SyncOperationProcessor, SyncOperationProcessorClass } from './sync-operation-processor';
import CacheIntegrityProcessor from './sync-operation-processors/cache-integrity-processor';
import SchemaConsistencyProcessor from './sync-operation-processors/schema-consistency-processor';
import SchemaValidationProcessor from './sync-operation-processors/schema-validation-processor';
import { PatchOperators } from './operators/patch-operators';
import InversePatchOperators, { InversePatchOperator } from './operators/inverse-patch-operators';

export interface RelatedRecordIdentity {
  record: RecordIdentity;
  relationship: string;
}

export type PatchResultData = Record | RecordIdentity | null;

export interface PatchResult {
  inverse: RecordOperation[],
  data: PatchResultData[]
}

export interface SyncRecordCacheSettings {
  schema?: Schema;
  keyMap?: KeyMap;
  processors?: SyncOperationProcessorClass[];
  transformBuilder?: TransformBuilder;
}

@evented
export abstract class SyncRecordCache implements Evented {
  protected _keyMap: KeyMap;
  protected _schema: Schema;
  protected _transformBuilder: TransformBuilder;
  protected _processors: SyncOperationProcessor[];

  // Evented interface stubs
  on: (event: string, callback: Function, binding?: object) => void;
  off: (event: string, callback: Function, binding?: object) => void;
  one: (event: string, callback: Function, binding?: object) => void;
  emit: (event: string, ...args) => void;
  listeners: (event: string) => any[];

  // Abstract methods for getting records and relationships
  abstract getRecord(recordIdentity: RecordIdentity): Record;
  abstract getRecords(type: string): Record[];
  abstract getInverselyRelatedRecords(recordIdentity: RecordIdentity): RelatedRecordIdentity[];

  // Abstract methods for setting records and relationships
  abstract setRecord(record: Record): void;
  abstract setRecords(type: string, records: Record[]): void;
  abstract removeRecord(recordIdentity: RecordIdentity): null | Record;
  abstract removeRecords(type: string, recordIdentities: RecordIdentity[]): Record[];
  abstract addInverselyRelatedRecord(recordIdentity: RecordIdentity, relatedRecordIdentity: RelatedRecordIdentity): void;
  abstract removeInverselyRelatedRecord(recordIdentity: RecordIdentity, relatedRecordIdentity: RelatedRecordIdentity): void;
  abstract removeInverseRelationships(recordIdentity: RecordIdentity): void;

  constructor(settings: SyncRecordCacheSettings) {
    this._schema = settings.schema;
    this._keyMap = settings.keyMap;

    this._transformBuilder = settings.transformBuilder || new TransformBuilder({
      recordInitializer: this._schema
    });

    const processors: SyncOperationProcessorClass[] = settings.processors ? settings.processors : [SchemaValidationProcessor, SchemaConsistencyProcessor, CacheIntegrityProcessor];
    this._processors = processors.map(Processor => new Processor(this));
  }

  get keyMap(): KeyMap {
    return this._keyMap;
  }

  get schema(): Schema {
    return this._schema;
  }

  get transformBuilder(): TransformBuilder {
    return this._transformBuilder;
  }

  getRelatedRecord(identity: RecordIdentity, relationship: string): RecordIdentity | null {
    const record = this.getRecord(identity);
    const relatedRecord = record && deepGet(record, ['relationships', relationship, 'data']);
    return relatedRecord || null;
  }

  getRelatedRecords(identity: RecordIdentity, relationship: string): RecordIdentity[] {
    const record = this.getRecord(identity);
    const relatedRecords = record && deepGet(record, ['relationships', relationship, 'data']);
    return relatedRecords || [];
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
