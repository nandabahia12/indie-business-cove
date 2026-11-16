CREATE OR REPLACE FUNCTION public.crm_intake(_org uuid, _source text, _payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE errs text[] := '{}'; nm text := btrim(coalesce(_payload->>'name',''));
  em text := nullif(btrim(coalesce(_payload->>'email','')), ''); ph text := nullif(btrim(coalesce(_payload->>'phone','')), '');
  wa text := nullif(btrim(coalesce(_payload->>'whatsapp','')), ''); dc text := nullif(btrim(coalesce(_payload->>'doc','')), '');
  src text := nullif(btrim(coalesce(_source,'')), ''); m uuid; cid uuid;
BEGIN
  IF NOT has_org_permission(_org, 'crm.create') THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501'; END IF;
  IF src IS NULL OR length(src) > 60 THEN errs := array_append(errs, 'origem obrigatória'); END IF;
  IF nm = '' OR length(nm) > 200 THEN errs := array_append(errs, 'nome obrigatório'); END IF;
  IF em IS NULL AND ph IS NULL AND wa IS NULL THEN errs := array_append(errs, 'informe e-mail, telefone ou WhatsApp'); END IF;
  IF em IS NOT NULL AND crm_email_norm(em) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN errs := array_append(errs, 'e-mail inválido'); END IF;
  IF dc IS NOT NULL AND NOT crm_valid_doc(dc) THEN errs := array_append(errs, 'CPF/CNPJ inválido'); END IF;
  IF cardinality(errs) > 0 THEN
    INSERT INTO crm_intake_log(organization_id, source, payload, result, errors) VALUES (_org, coalesce(src,'desconhecida'), coalesce(_payload,'{}'), 'rejected', errs);
    RETURN jsonb_build_object('status','rejected','errors', to_jsonb(errs));
  END IF;
  SELECT f.id INTO m FROM crm_find_duplicates(_org, em, ph, wa, dc, NULL) f WHERE NOT f.archived LIMIT 1;
  IF m IS NOT NULL THEN
    PERFORM crm_log(_org, m, NULL, 'intake_matched', 'Novo contato recebido de ' || src || ' (cadastro existente)', jsonb_build_object('source', src));
    INSERT INTO crm_intake_log(organization_id, source, payload, result, contact_id) VALUES (_org, src, _payload, 'matched', m);
    RETURN jsonb_build_object('status','matched','contact_id', m);
  END IF;
  INSERT INTO crm_contacts(organization_id, kind, name, email, phone, whatsapp, source, relationship, notes)
  VALUES (_org, CASE WHEN length(regexp_replace(coalesce(dc,''),'[^0-9]','','g')) = 14 THEN 'pj' ELSE 'pf' END,
          nm, em, ph, wa, src, 'lead', nullif(btrim(coalesce(_payload->>'message','')), ''))
  RETURNING id INTO cid;
  IF dc IS NOT NULL THEN INSERT INTO crm_contact_private(contact_id, organization_id, doc) VALUES (cid, _org, dc); END IF;
  INSERT INTO crm_intake_log(organization_id, source, payload, result, contact_id) VALUES (_org, src, _payload, 'created', cid);
  RETURN jsonb_build_object('status','created','contact_id', cid);
END $$;

CREATE OR REPLACE FUNCTION public.crm_contact_history() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE changed text[] := '{}';
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM crm_log(NEW.organization_id, NEW.id, NULL, 'contact_created', 'Contato cadastrado', '{}'); RETURN NEW;
  END IF;
  IF NEW.merged_into_id IS DISTINCT FROM OLD.merged_into_id THEN RETURN NEW; END IF;
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    PERFORM crm_log(NEW.organization_id, NEW.id, NULL, 'owner_changed', 'Responsável alterado', jsonb_build_object('from', OLD.owner_id, 'to', NEW.owner_id));
  END IF;
  IF NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN
    PERFORM crm_log(NEW.organization_id, NEW.id, NULL, CASE WHEN NEW.archived_at IS NULL THEN 'contact_restored' ELSE 'contact_archived' END,
      CASE WHEN NEW.archived_at IS NULL THEN 'Contato reativado' ELSE 'Contato arquivado' END, '{}');
  END IF;
  IF NEW.name IS DISTINCT FROM OLD.name THEN changed := array_append(changed, 'nome'); END IF;
  IF NEW.email_norm IS DISTINCT FROM OLD.email_norm THEN changed := array_append(changed, 'e-mail'); END IF;
  IF NEW.phone_digits IS DISTINCT FROM OLD.phone_digits THEN changed := array_append(changed, 'telefone'); END IF;
  IF NEW.whatsapp_digits IS DISTINCT FROM OLD.whatsapp_digits THEN changed := array_append(changed, 'WhatsApp'); END IF;
  IF NEW.kind IS DISTINCT FROM OLD.kind THEN changed := array_append(changed, 'tipo'); END IF;
  IF NEW.relationship IS DISTINCT FROM OLD.relationship THEN changed := array_append(changed, 'relacionamento'); END IF;
  IF NEW.address_city IS DISTINCT FROM OLD.address_city OR NEW.address_street IS DISTINCT FROM OLD.address_street THEN changed := array_append(changed, 'endereço'); END IF;
  IF array_length(changed, 1) > 0 THEN
    PERFORM crm_log(NEW.organization_id, NEW.id, NULL, 'contact_updated', 'Cadastro alterado: ' || array_to_string(changed, ', '), jsonb_build_object('fields', changed));
  END IF;
  RETURN NEW;
END $$;