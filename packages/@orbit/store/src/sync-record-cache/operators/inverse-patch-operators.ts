import { Dict, deepGet, deepSet, eq, isArray } from '@orbit/utils';
import {
  RecordOperation,
  AddRecordOperation,
  AddToRelatedRecordsOperation,
  ReplaceAttributeOperation,
  RemoveFromRelatedRecordsOperation,
  RemoveRecordOperation,
  ReplaceRelatedRecordsOperation,
  ReplaceRelatedRecordOperation,
  ReplaceKeyOperation,
  ReplaceRecordOperation,
  equalRecordIdentities,
  equalRecordIdentitySets
} from '@orbit/data';
import { SyncRecordCache } from '../sync-record-cache';

export interface InversePatchOperator {
  (cache: SyncRecordCache, op: RecordOperation): RecordOperation;
}

const InversePatchOperators: Dict<InversePatchOperator> = {
  addRecord(cache: SyncRecordCache, op: AddRecordOperation): RecordOperation {
    const { type, id } = op.record;
    const current = cache.getRecord(op.record);

    if (current === undefined) {
      return {
        op: 'removeRecord',
        record: { type, id }
      };
    } else if (eq(current, op.record)) {
      return;
    } else {
      return {
        op: 'replaceRecord',
        record: current
      };
    }
  },

  replaceRecord(cache: SyncRecordCache, op: ReplaceRecordOperation): RecordOperation {
    const current = cache.getRecord(op.record);
    const replacement = op.record;
    const { type, id } = replacement;

    if (current === undefined) {
      return {
        op: 'removeRecord',
        record: { type, id }
      };
    } else {
      let result = { type, id };
      let changed = false;

      ['attributes', 'keys'].forEach(grouping => {
        if (replacement[grouping]) {
          Object.keys(replacement[grouping]).forEach(field => {
            let value = replacement[grouping][field];
            let currentValue = deepGet(current, [grouping, field]);
            if (!eq(value, currentValue)) {
              changed = true;
              deepSet(result, [grouping, field], currentValue === undefined ? null : currentValue);
            }
          });
        }
      });

      if (replacement.relationships) {
        Object.keys(replacement.relationships).forEach(field => {
          let currentData = deepGet(current, ['relationships', field, 'data']);
          let data = deepGet(replacement, ['relationships', field, 'data']);

          let relationshipMatch;
          if (isArray(data)) {
            relationshipMatch = equalRecordIdentitySets(currentData, data);
          } else {
            relationshipMatch = equalRecordIdentities(currentData, data);
          }

          if (!relationshipMatch) {
            changed = true;
            deepSet(result, ['relationships', field, 'data'], currentData === undefined ? null : currentData);
          }
        });
      }

      if (changed) {
        return {
          op: 'replaceRecord',
          record: result
        };
      }
    }
  },

  removeRecord(cache: SyncRecordCache, op: RemoveRecordOperation): RecordOperation {
    const current = cache.getRecord(op.record);

    if (current !== undefined) {
      return {
        op: 'addRecord',
        record: current
      };
    }
  },

  replaceKey(cache: SyncRecordCache, op: ReplaceKeyOperation): RecordOperation {
    const record = cache.getRecord(op.record);
    const current = record && deepGet(record, ['keys', op.key]);

    if (!eq(current, op.value)) {
      const { type, id } = op.record;

      return {
        op: 'replaceKey',
        record: { type, id },
        key: op.key,
        value: current
      };
    }
  },

  replaceAttribute(cache: SyncRecordCache, op: ReplaceAttributeOperation): RecordOperation {
    const { attribute } = op;
    const record = cache.getRecord(op.record);
    const current = record && deepGet(record, ['attributes', attribute]);

    if (!eq(current, op.value)) {
      const { type, id } = record;

      return {
        op: 'replaceAttribute',
        record: { type, id },
        attribute,
        value: current
      };
    }
  },

  addToRelatedRecords(cache: SyncRecordCache, op: AddToRelatedRecordsOperation): RecordOperation {
    const { record, relationship, relatedRecord } = op;

    if (!cache.relatedRecordsInclude(record, relationship, [relatedRecord])) {
      return {
        op: 'removeFromRelatedRecords',
        record,
        relationship,
        relatedRecord
      };
    }
  },

  removeFromRelatedRecords(cache: SyncRecordCache, op: RemoveFromRelatedRecordsOperation): RecordOperation {
    const { record, relationship, relatedRecord } = op;

    if (cache.relatedRecordsInclude(record, relationship, relatedRecord)) {
      return {
        op: 'addToRelatedRecords',
        record,
        relationship,
        relatedRecord
      };
    }
  },

  replaceRelatedRecords(cache: SyncRecordCache, op: ReplaceRelatedRecordsOperation): RecordOperation {
    const { record, relationship, relatedRecords } = op;
    const currentRelatedRecords = cache.getRelatedRecords(record, relationship);

    if (!equalRecordIdentitySets(currentRelatedRecords, relatedRecords)) {
      return {
        op: 'replaceRelatedRecords',
        record,
        relationship,
        relatedRecords: currentRelatedRecords
      };
    }
  },

  replaceRelatedRecord(cache: SyncRecordCache, op: ReplaceRelatedRecordOperation): RecordOperation {
    const { record, relationship, relatedRecord } = op;
    const currentRelatedRecord = cache.getRelatedRecord(record, relationship);

    if (!equalRecordIdentities(currentRelatedRecord, relatedRecord)) {
      return {
        op: 'replaceRelatedRecord',
        record,
        relationship,
        relatedRecord: currentRelatedRecord
      };
    }
  }
};

export default InversePatchOperators;
