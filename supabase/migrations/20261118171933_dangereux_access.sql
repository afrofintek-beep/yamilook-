create schema dangereux_private;
revoke all on schema dangereux_private from public;
grant usage on schema dangereux_private to anon, authenticated;

create table dangereux_private.pilot (
  singleton boolean primary key check (singleton),
  link_digest bytea,
  places jsonb not null,
  administration jsonb not null
);
alter table dangereux_private.pilot enable row level security;
revoke all on dangereux_private.pilot from public, anon, authenticated;
insert into dangereux_private.pilot(singleton, places, administration)
values (true, $places$[
  {
    "id": "padaria",
    "name": "Padaria da Banda",
    "category": "Comércio",
    "zone": "Zona central",
    "info": "Pão fresco e bolos de fabrico local.",
    "reference": "DEMO · 001",
    "point": [
      335,
      83
    ],
    "via": [
      [
        215,
        188
      ],
      [
        350,
        148
      ]
    ],
    "directions": "Da entrada, segue pela avenida até ao largo. Vira à esquerda para a travessa da padaria."
  },
  {
    "id": "mercado",
    "name": "Mercado do Largo",
    "category": "Comércio",
    "zone": "Zona central",
    "info": "Bancas de fruta, hortícolas e mercearia.",
    "reference": "DEMO · 002",
    "point": [
      222,
      215
    ],
    "via": [
      [
        215,
        188
      ]
    ],
    "directions": "Segue pela avenida até à praça. O mercado fica à direita, junto à entrada da praça."
  },
  {
    "id": "oficina",
    "name": "Oficina de Bicicletas",
    "category": "Serviços",
    "zone": "Zona nascente",
    "info": "Reparação de bicicletas e afinação de travões.",
    "reference": "DEMO · 003",
    "point": [
      440,
      122
    ],
    "via": [
      [
        215,
        188
      ],
      [
        350,
        148
      ]
    ],
    "directions": "Segue pela avenida, atravessa o largo e continua até à oficina."
  },
  {
    "id": "espaco",
    "name": "Espaço Comunitário",
    "category": "Comunidade",
    "zone": "Zona poente",
    "info": "Encontros, oficinas e actividades para moradores.",
    "reference": "DEMO · 004",
    "point": [
      184,
      83
    ],
    "via": [
      [
        215,
        188
      ]
    ],
    "directions": "Na praça, vira à esquerda e sobe a rua até ao espaço comunitário."
  },
  {
    "id": "atelie",
    "name": "Ateliê Linha da Banda",
    "category": "Serviços",
    "zone": "Por marcação",
    "info": "Costura e arranjos num ateliê em casa. A costureira divulga apenas o serviço.",
    "reference": "DEMO · 005"
  }
]$places$::jsonb, $admin${
  "cases": [
    {
      "id": "DB-021",
      "kind": "Residência",
      "zone": "Zona central"
    },
    {
      "id": "DB-022",
      "kind": "Negócio",
      "zone": "Zona nascente"
    },
    {
      "id": "DB-023",
      "kind": "Residência",
      "zone": "Zona poente"
    }
  ],
  "zones": [
    [
      "Zona central",
      8
    ],
    [
      "Zona nascente",
      6
    ],
    [
      "Zona poente",
      4
    ]
  ]
}$admin$::jsonb);

create function dangereux_private.open_pilot(p_key text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  admin_access boolean := auth.uid() is not null and public.has_role(auth.uid(), 'admin');
  pilot dangereux_private.pilot%rowtype;
begin
  select * into strict pilot from dangereux_private.pilot where singleton;
  if admin_access then
    return jsonb_build_object('places', pilot.places, 'admin', pilot.administration);
  end if;
  if length(p_key) = 64 and p_key ~ '^[a-f0-9]{64}$'
     and pilot.link_digest = sha256(convert_to(p_key, 'UTF8')) then
    return jsonb_build_object('places', pilot.places);
  end if;
  return null;
end;
$$;

create function public.open_dangereux_pilot(p_key text default null)
returns jsonb language sql stable security invoker set search_path = ''
as $$ select dangereux_private.open_pilot(p_key) $$;

create function dangereux_private.change_link(p_enable boolean)
returns text language plpgsql security definer set search_path = '' as $$
declare
  link_key text;
begin
  if auth.uid() is null or not coalesce(public.has_role(auth.uid(), 'admin'), false) then
    raise insufficient_privilege;
  end if;
  if p_enable then
    link_key := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  end if;
  update dangereux_private.pilot set link_digest = sha256(convert_to(link_key, 'UTF8')) where singleton;
  return link_key;
end;
$$;
create function public.change_dangereux_link(p_enable boolean)
returns text language sql volatile security invoker set search_path = ''
as $$ select dangereux_private.change_link(p_enable) $$;

revoke all on function dangereux_private.open_pilot(text), public.open_dangereux_pilot(text),
  dangereux_private.change_link(boolean), public.change_dangereux_link(boolean) from public, anon, authenticated;
grant execute on function dangereux_private.open_pilot(text), public.open_dangereux_pilot(text) to anon, authenticated;
grant execute on function dangereux_private.change_link(boolean), public.change_dangereux_link(boolean) to authenticated;
