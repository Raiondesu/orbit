import { isArray, deepGet } from '@orbit/utils';
import {
  cloneRecordIdentity,
  Record,
  RecordIdentity,
  RecordOperation
} from '@orbit/data';
import { SyncOperationProcessor } from '../sync-operation-processor';

/**
 * An operation processor that ensures that a cache's data is consistent and
 * doesn't contain any dead references.
 *
 * This is achieved by maintaining a mapping of reverse relationships for each
 * record. When a record is removed, any references to it can also be identified
 * and removed.
 */
export default class CacheIntegrityProcessor extends SyncOperationProcessor {
  after(operation: RecordOperation): RecordOperation[] {
    switch (operation.op) {
      case 'replaceRelatedRecord':
        this.removeInverseRelationship(operation.record, operation.relationship);
        return [];

      case 'replaceRelatedRecords':
        this.removeInverseRelationships(operation.record, operation.relationship);
        return [];

      case 'removeFromRelatedRecords':
        this.removeInverseRelationship(operation.record, operation.relationship, operation.relatedRecord);
        return [];

      case 'removeRecord':
        let ops = this.clearInverseRelationshipOps(operation.record);
        this.removeAllInverseRelationships(operation.record);
        return ops;

      case 'replaceRecord':
        this.removeAllInverseRelationships(operation.record);
        return [];

      default:
        return [];
    }
  }

  finally(operation): RecordOperation[] {
    switch (operation.op) {
      case 'replaceRelatedRecord':
        this.addInverseRelationship(operation.record, operation.relationship, operation.relatedRecord);
        return [];

      case 'replaceRelatedRecords':
        this.addInverseRelationships(operation.record, operation.relationship, operation.relatedRecords);
        return [];

      case 'addToRelatedRecords':
        this.addInverseRelationship(operation.record, operation.relationship, operation.relatedRecord);
        return [];

      case 'addRecord':
        this.addAllInverseRelationships(operation.record);
        return [];

      case 'replaceRecord':
        this.addAllInverseRelationships(operation.record);
        return [];

      default:
        return [];
    }
  }

  protected addInverseRelationship(record: RecordIdentity, relationship: string, relatedRecord: RecordIdentity): void {
    if (relatedRecord) {
      const relationshipDef = this.cache.schema.getModel(record.type).relationships[relationship];
      if (relationshipDef.inverse) {
        const recordIdentity = cloneRecordIdentity(record);
        this.cache.addInverselyRelatedRecord(relatedRecord, { record: recordIdentity, relationship });
      }
    }
  }

  protected addInverseRelationships(record: RecordIdentity, relationship: string, relatedRecords: RecordIdentity[]): void {
    if (relatedRecords && relatedRecords.length > 0) {
      const relationshipDef = this.cache.schema.getModel(record.type).relationships[relationship];
      if (relationshipDef.inverse) {
        const recordIdentity = cloneRecordIdentity(record);
        relatedRecords.forEach(relatedRecord => {
          this.cache.addInverselyRelatedRecord(relatedRecord, { record: recordIdentity, relationship });
        });
      }
    }
  }

  protected addAllInverseRelationships(record: Record): void {
    const relationships = record.relationships;
    const recordIdentity = cloneRecordIdentity(record);
    if (relationships) {
      Object.keys(relationships).forEach(relationship => {
        const relationshipData = relationships[relationship] && relationships[relationship].data;
        if (relationshipData) {
          if (isArray(relationshipData)) {
            const relatedRecords = relationshipData as Record[];
            relatedRecords.forEach(relatedRecord => {
              this.cache.addInverselyRelatedRecord(relatedRecord, { record: recordIdentity, relationship })
            });
          } else {
            const relatedRecord = relationshipData as Record;
            this.cache.addInverselyRelatedRecord(relatedRecord, { record: recordIdentity, relationship })
          }
        }
      });
    }
  }

  protected removeInverseRelationship(record: RecordIdentity, relationship: string, relatedRecord?: RecordIdentity): void {
    const relationshipDef = this.cache.schema.getModel(record.type).relationships[relationship];

    if (relationshipDef.inverse) {
      if (relatedRecord === undefined) {
        const currentRecord = this.cache.getRecord(record);
        relatedRecord = currentRecord && deepGet(currentRecord, ['relationships', relationship, 'data']);
      }

      if (relatedRecord) {
        this.cache.removeInverselyRelatedRecord(relatedRecord, { record, relationship });
      }
    }
  }

  protected removeInverseRelationships(record: RecordIdentity, relationship: string, relatedRecords?: RecordIdentity[]): void {
    const relationshipDef = this.cache.schema.getModel(record.type).relationships[relationship];

    if (relationshipDef.inverse) {
      if (relatedRecords === undefined) {
        const currentRecord = this.cache.getRecord(record);
        relatedRecords = currentRecord && deepGet(currentRecord, ['relationships', relationship, 'data']);
      }

      if (relatedRecords) {
        relatedRecords.forEach(relatedRecord => this.cache.removeInverselyRelatedRecord(relatedRecord, { record, relationship }));
      }
    }
  }

  protected removeAllInverseRelationships(record: RecordIdentity): void {
    const recordInCache = this.cache.getRecord(record);
    const relationships = recordInCache && recordInCache.relationships;
    if (relationships) {
      Object.keys(relationships).forEach(relationship => {
        const relationshipData = relationships[relationship] && relationships[relationship].data;
        if (relationshipData) {
          if (isArray(relationshipData)) {
            const relatedRecords = relationshipData as Record[];
            relatedRecords.forEach(relatedRecord => {
              this.cache.removeInverselyRelatedRecord(relatedRecord, { record, relationship });
            });
          } else {
            const relatedRecord = relationshipData as Record;
            this.cache.removeInverselyRelatedRecord(relatedRecord, { record, relationship });
          }
        }
      });
    }
    this.cache.removeInverseRelationships(record);
  }

  protected clearInverseRelationshipOps(record: RecordIdentity): RecordOperation[] {
    const ops: RecordOperation[] = [];
    const inverseRels = this.cache.getInverselyRelatedRecords(record);

    if (inverseRels.length > 0) {
      const recordIdentity = cloneRecordIdentity(record);
      inverseRels.forEach(rel => {
        const relationshipDef = this.cache.schema.getModel(rel.record.type).relationships[rel.relationship];
        if (relationshipDef.type === 'hasMany') {
          ops.push({
            op: 'removeFromRelatedRecords',
            record: rel.record,
            relationship: rel.relationship,
            relatedRecord: recordIdentity
          });
        } else {
          ops.push({
            op: 'replaceRelatedRecord',
            record: rel.record,
            relationship: rel.relationship,
            relatedRecord: null
          });
        }
      });
    }

    return ops;
  }
}
