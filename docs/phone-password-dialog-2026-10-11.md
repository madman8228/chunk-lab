# Phone authentication dialog

- Code-send button appears beside the phone field on desktop and mobile.
- SMS login auto-registers an unknown verified phone. Optional password setting requires successful SMS verification; existing verified users may use the same flow to reset their password.
- Phone/password login only accepts identities already verified by SMS. Legacy username login remains disabled in phone mode.
- Password validation: at least 6 characters, at most 72 UTF-8 bytes. bcrypt cost 10; plaintext passwords are never persisted. Unknown identities and incorrect passwords have the same response and a dummy bcrypt comparison.
- Binding retains the account ID and cache/session identity; conflicts do not merge accounts or change passwords.
- Shared dialog extends the supplied course-cover visual family with the existing garden asset, warm paper and honey wooden controls.
- Tests use a newly allocated temporary database and isolated port, with injected SMS only. HTTP/browser tests cover password creation, login, short/incorrect passwords, verified binding, mobile/desktop rendering and same-account behavior.
- No course packages or learning records are migrated or cleared.
