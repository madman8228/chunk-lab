# Sentence cloze architecture

## Current contract

The owner approved a sentence with fixed English context and inline blanks for the learning targets. Chinese meaning stays above the sentence. For example: `I [decided] [to] have a picnic.` There are no stage tabs, repeated-prefix typing, reveal-step actions or optional-context completion shortcuts. Enter moves to the next blank; the last Enter checks the sentence. Tab remains native focus navigation. Mobile fields expose next/done keyboard actions. Errors preserve every answer and focus the first invalid blank. Exit pauses the current DOM; resume retains inputs. Skip records no success. Restart resets this round's UI only, never saved records.

## Separation of responsibilities

- `landing/practice-content.js`: authored scenes, model sentences, translations and versioned exercise data. Targeted error messages belong to the data, not word-specific UI branches.
- `landing/sentence-cloze-engine.js`: pure schema validation, answer normalization, accepted alternatives, per-field evaluation and sentence assembly. No DOM, network, account or persistence dependencies.
- `landing/sentence-cloze-view.js`: generic form rendering, keyboard/IME handling, accessibility and local feedback. Emits attempt/completion callbacks; knows nothing about lesson queues or account storage.
- `landing/practice.js`: round selection, retries, navigation, audio and existing account-scoped automatic event submission. Consumes the generic component; does not match answers itself.

## Authoring format

```js
exercise: {
  version: 1,
  parts: [
    { text: 'I ' },
    {
      id: 'verb',
      label: '决定（过去式）',
      answers: ['decided'],
      feedback: [{ values: ['decide'], message: '这里说已经发生的决定，用过去式 decided。' }]
    },
    { text: ' ' },
    { id: 'link', label: '决定做某事的连接词', answers: ['to'] },
    { text: ' have a picnic.' }
  ]
}
```

One, two or more blanks use the same renderer. A blank can accept a multiword expression or several explicitly authored alternatives. IDs must be unique; labels and accepted answers are required. The engine rejects malformed content. Matching ignores case, extra whitespace, typographic apostrophes and terminal punctuation; it does not guess synonyms or silently accept a grammatically different sentence. Rendered text uses textContent, never HTML interpolation.

To add a lesson, declare its content and exercise parts, check that the assembled canonical sentence matches the model sentence and that the picture depicts it, and add applicable authoring tests. The engine and renderer need no changes. The current backend still deliberately admits only the six pilot vocabulary IDs: expanding persisted content also requires extending that backend catalog. This change is not a 10,000-word content rollout.

## Learning records and safety

All inline-cloze completion events are `independent: false`: supplied context is scaffolding, including during scheduled review. Correct cloze completion must not be treated as free recall or inflate mastery. Incorrect nonempty submissions queue one end-of-round retry. This change does not migrate databases, edit courses, erase browser storage or restart the live service. The existing account-scoped outbox and idempotent automatic replay remain responsible for persistence.

## Verification

Pure tests cover all six lessons, unseen multiword/alternative answers, missing fields, duplicate IDs, malformed data and data-driven feedback. The existing browser/API harness runs on a newly allocated temporary data directory and isolated port. It covers desktop/mobile layouts, six-word completion, Enter/Tab/IME behavior, preservation of wrong and correct inputs, pause/resume/restart/skip, conservative credit and offline replay. Desktop and mobile screenshots were inspected. Asset budgets and global navigation remain covered by that harness. A service-worker bundle is regenerated and checked; active or paused rounds are not forcibly refreshed.
