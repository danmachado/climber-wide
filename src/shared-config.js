  // ---- where published rooms live (this key is the public, read-only kind and is safe to ship) ----
  // The wide game keeps its own tables (`rooms_wide`, `room_versions_wide`) so the frame's portrait rooms and these
  // landscape rooms never load into the wrong game. Same project, same key, different tables.
  var BACKEND = window.CLIMBER_BACKEND || {
    url: 'https://idgdoglrbegjorqekadr.supabase.co',
    key: 'sb_publishable_5CPsQIpba-pLQFGgiQzdQw_PiJOsvuR'
  };
  var TB = { rooms: BACKEND.rooms || 'rooms_wide', versions: BACKEND.versions || 'room_versions_wide' };
