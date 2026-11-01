<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Use Cloud Auth email/password with one root session subscriber; protected workshop routes live under the client-only authenticated layout because sessions are browser-managed.
- Fetch private workshop data through authenticated server functions and owner-scoped RLS; account creation and quotas are database triggers so direct requests cannot bypass them.
- Subscription fields are service-managed and owner-read-only; never accept subscription upgrades or permissions from signup metadata.
- Client routes use authenticated server functions and Query-backed loaders; shared Zod validation and database contact validation protect both forms and direct requests, while existing owner RLS and quota triggers remain authoritative.
