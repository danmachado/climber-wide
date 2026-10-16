# Climber Wide: one-time setup (Dan)

Two things only you can do. Everything else is in the repo.

## 1. The GitHub repo and its page

- Make an empty repo `danmachado/climber-wide` on GitHub (no README, no license, nothing in it).
- Push this folder to it (first push from wherever the folder lives):

```
git push -u origin main
```

- Settings, Pages: deploy from `main`, folder `/ (root)`. The game is then at
  `https://danmachado.github.io/climber-wide/` and the builder at `.../climber-wide/builder/`.
- Saved progress, stars and controller settings use the `climberwide.` prefix, so they never clash with the frame's
  `climber.` saves even though both live under `danmachado.github.io`.

## 2. The wide rooms' own tables in Supabase

The wide game reads and publishes to `rooms_wide` and `room_versions_wide` (set in `src/shared-config.js`), so the
frame's portrait rooms and these landscape rooms never load into the wrong game. Same project, same public key.

Run this once in the Supabase SQL editor. It copies the two tables, their keys, and every row-level security policy.

```sql
create table rooms_wide (like rooms including all);
create table room_versions_wide (like room_versions including all);

alter table room_versions_wide
  add foreign key (room_id) references rooms_wide (id) on delete cascade;
alter table rooms_wide
  add foreign key (published_version_id) references room_versions_wide (id) on delete set null;

alter table rooms_wide enable row level security;
alter table room_versions_wide enable row level security;

do $$
declare p record;
begin
  for p in select * from pg_policies where schemaname = 'public' and tablename in ('rooms', 'room_versions') loop
    execute format('create policy %I on public.%I as %s for %s to %s %s %s',
      p.policyname, p.tablename || '_wide', p.permissive, p.cmd,
      array_to_string(p.roles, ','),
      coalesce('using (' || replace(replace(p.qual, 'room_versions', 'room_versions_wide'), 'rooms', 'rooms_wide') || ')', ''),
      coalesce('with check (' || replace(replace(p.with_check, 'room_versions', 'room_versions_wide'), 'rooms', 'rooms_wide') || ')', ''));
  end loop;
end $$;
```

- Not tested against your project (I cannot sign in). If the policy loop errors, the two tables are still there:
  copy the policies by hand in Authentication, Policies (one per policy on `rooms` and `room_versions`).
- `admins` is shared on purpose: the same sign-in publishes to both games.
- Check: open the wide builder, sign in, publish a room, and it should appear in the wide game and not on the frame.
