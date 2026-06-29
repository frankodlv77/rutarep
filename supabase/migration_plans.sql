alter table profiles add column if not exists plan text default 'free';
alter table profiles add column if not exists trial_start timestamptz default now();
