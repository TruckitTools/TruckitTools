# TruckitTools – Supabase Storage setup

1. Supabase Dashboard → **Storage** → **New bucket**
   - Name: `truckit-docs`
   - **Public bucket**: ON (so RateCon/BOL/photo links work without signed URLs)

2. Policies (Storage → truckit-docs → Policies), or SQL:

```sql
-- Allow anon read/upload for this private-tool setup (tighten later with Auth)
create policy "truckit docs public read"
  on storage.objects for select
  using (bucket_id = 'truckit-docs');

create policy "truckit docs anon insert"
  on storage.objects for insert
  with check (bucket_id = 'truckit-docs');

create policy "truckit docs anon update"
  on storage.objects for update
  using (bucket_id = 'truckit-docs');
```

3. Upload updated files:
   - cloud-sync.js
   - loads.html
   - index.html

Docs path layout:
- `docs/{loadId}/rateCon/...pdf`
- `docs/{loadId}/bol/...pdf`
- `docs/{loadId}/carrierPacket/...pdf`
- `photos/{trackingRef}/...jpg`

Load record gets `load.docs.rateCon.url` etc. after generate/send.
Session gets `truckPhotoUrl` after carrier starts tracking.
