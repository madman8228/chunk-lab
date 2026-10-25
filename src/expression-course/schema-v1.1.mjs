import packageV1 from './expression-package.schema.json' with { type: 'json' };
import lessonV1 from './lesson.schema.json' with { type: 'json' };

export function createExpressionV11Schemas() {
  const packageSchema = structuredClone(packageV1);
  packageSchema.$id = 'https://jqka.top/contracts/expression-package-1.1.schema.json';
  packageSchema.properties.formatVersion = { const: '1.1' };
  packageSchema.required = [...packageSchema.required, 'curriculum'];
  packageSchema.properties.curriculum = {
    type: 'object', additionalProperties: false,
    required: ['track', 'stage', 'knowledgeMapVersion'],
    properties: {
      track: { enum: ['scenario', 'sentence-building', 'pronunciation', 'phonics'] },
      stage: { enum: ['S0', 'S1', 'S2', 'S3', 'S4'] },
      knowledgeMapVersion: { const: '1.0' }
    }
  };
  const lessonSchema = structuredClone(lessonV1);
  lessonSchema.$id = 'https://jqka.top/contracts/expression-lesson-1.1.schema.json';
  lessonSchema.required = [...lessonSchema.required, 'knowledgeIds', 'recommendedKnowledgeIds'];
  lessonSchema.properties.schemaVersion = { const: '1.1' };
  lessonSchema.properties.knowledgeIds = { type: 'array', minItems: 1, uniqueItems: true, items: { type: 'string', minLength: 1 } };
  lessonSchema.properties.recommendedKnowledgeIds = { type: 'array', uniqueItems: true, items: { type: 'string', minLength: 1 } };
  lessonSchema.properties.vocabulary.minItems = 0;
  lessonSchema.properties.activities.minItems = 4;
  const activity = lessonSchema.$defs.activity;
  activity.properties.type.enum.push('sound_demo', 'grapheme_build', 'speaking_practice');
  const listening = lessonSchema.$defs.listeningPayload;
  listening.properties.questionKind = { enum: ['meaning', 'sound', 'decoding'] };
  lessonSchema.$defs.soundDemoPayload = {
    type: 'object', additionalProperties: false, required: ['instructionZh', 'segments'],
    properties: {
      instructionZh: { type: 'string', minLength: 2 },
      segments: { type: 'array', minItems: 1, maxItems: 12, items: { type: 'object', additionalProperties: false,
        required: ['label', 'audioAssetId'], properties: { label: { type: 'string', minLength: 1 }, symbol: { type: 'string', minLength: 1 }, audioAssetId: { type: 'string', minLength: 1 } } } }
    }
  };
  lessonSchema.$defs.graphemeBuildPayload = {
    type: 'object', additionalProperties: false, required: ['targetMeaning', 'audioAssetId', 'availableTokens', 'correctTokens'],
    properties: {
      targetMeaning: { type: 'string', minLength: 1 }, audioAssetId: { type: 'string', minLength: 1 },
      availableTokens: { type: 'array', minItems: 1, maxItems: 16, items: { type: 'string', minLength: 1, maxLength: 8 } },
      correctTokens: { type: 'array', minItems: 1, maxItems: 12, items: { type: 'string', minLength: 1, maxLength: 8 } }
    }
  };
  lessonSchema.$defs.speakingPracticePayload = {
    type: 'object', additionalProperties: false, required: ['scenario', 'referenceText', 'audioAssetId'],
    properties: {
      scenario: { type: 'string', minLength: 3 }, referenceText: { type: 'string', minLength: 1 }, audioAssetId: { type: 'string', minLength: 1 }
    }
  };
  const addType = (type, payloadRef, stage, countsTowardMastery) => activity.allOf.push({
    if: { properties: { type: { const: type } } },
    then: { properties: { stage: stage ? { const: stage } : {}, payload: { $ref: `#/$defs/${payloadRef}` },
      evaluation: { properties: { countsTowardMastery: { const: countsTowardMastery } } } } }
  });
  addType('sound_demo', 'soundDemoPayload', 'guided', false);
  addType('grapheme_build', 'graphemeBuildPayload', null, false);
  addType('speaking_practice', 'speakingPracticePayload', null, false);
  return { packageSchema, lessonSchema };
}
