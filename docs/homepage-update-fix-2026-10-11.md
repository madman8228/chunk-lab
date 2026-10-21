# Homepage background updates

Observed in the owner's open page: garden-body computed background was `none`, and homepage scripts contained no service-worker update check. Disk/server files already contained the new background. A fresh isolated browser test had therefore missed the stale installed-bundle case.

The homepage now registers/checks the service worker independently of cached external scripts, bypasses HTTP caching for worker updates, and reloads once after an existing controller switches to the fully installed bundle. An open account panel or authentication dialog postpones the reload until dismissed; hidden tabs defer until visible. Offline failure retains the installed bundle. No account storage is reset.

Regression `node scripts/homepage-update.test.cjs` failed before implementation and passes after, checking update invocation, dialog protection and absence of reload loops. After reloading the user's actual browser, DOM inspection confirmed the new background URL; visible inspection confirmed foliage around vocabulary and learning-path sections.
