alter table menu_items
  add column if not exists preparation_minutes integer,
  add column if not exists image_path text;
