-- Authority: https://afroloc.ao (qg-engine v40). app.afroloc.ao is a consumer.
-- New GPS declarations use the official compact urban form.
-- No historical row updates or certificate grants. Legacy codec retained for reconciliation.
create or replace function public.afroloc_b36_signed(n bigint)
returns text language plpgsql immutable as $$
declare
  u bigint;
  s text := '';
  d int;
  digits constant text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
begin
  u := abs(n);
  if u = 0 then return '0'; end if;
  while u > 0 loop
    d := (u % 36)::int;
    s := substr(digits, d + 1, 1) || s;
    u := u / 36;
  end loop;
  return case when n < 0 then 'N' else '' end || s;
end;
$$;

-- Official compact format; keep the existing SQL signature for callers.
create or replace function public.afroloc_nom(
  p_cc text, p_prov text, p_mun text, p_zona text,
  p_lat double precision, p_lng double precision
) returns text language plpgsql immutable as $$
declare
  r      constant double precision := 6378137.0;
  maxlat constant double precision := 85.05112878;
  clat   double precision;
  x      double precision;
  y      double precision;
  ix     bigint;
  iy     bigint;
  xy     text;
  cc     text := upper(coalesce(p_cc, '??'));
begin
  -- Standard form avoids inventing administrative divisions from Banda labels.
  -- Official administrative codes must come from afroloc.ao, not inferred names.
  p_prov := null; p_mun := null; p_zona := null;
  if p_lat is null or p_lng is null then return null; end if;
  clat := greatest(-maxlat, least(maxlat, p_lat));
  x := r * (p_lng * pi() / 180);
  y := r * ln(tan(pi() / 4 + (clat * pi() / 180) / 2));
  ix := floor(x / 10)::bigint;           -- grelha urbana 10 m (G10)
  iy := floor(y / 10)::bigint;
  xy := public.afroloc_b36_signed(ix) || '-' || public.afroloc_b36_signed(iy);
  return cc || '-ZU-G10-' || xy;
end;
$$;


create or replace function public.set_afroloc_code()
returns trigger language plpgsql as $$
declare
  v_prov text; v_mun text; v_com text;
begin
  -- Do not silently rewrite historical codes on unrelated profile updates.
  if tg_op = 'UPDATE' then
    if (new.latitude,new.longitude,new.country_code,new.afroloc_code)
       is not distinct from (old.latitude,old.longitude,old.country_code,old.afroloc_code) then
      return new;
    end if;
  end if;
  if new.latitude is null or new.longitude is null then
    return new;
  end if;
  if upper(coalesce(new.country_code,'')) = 'AO'
     and new.city is not null and new.neighborhood is not null then
    select prov_seg, mun_slug, com_slug into v_prov, v_mun, v_com
      from public.afroloc_banda_division
     where country_code = 'AO'
       and lower(city) = lower(new.city)
       and banda_norm = lower(btrim(new.neighborhood))
     limit 1;
  end if;
  new.afroloc_code := public.afroloc_nom(
    coalesce(upper(new.country_code),'AO'), v_prov, v_mun, v_com,
    new.latitude, new.longitude
  );
  return new;
end;
$$;
