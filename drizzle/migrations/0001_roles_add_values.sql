ALTER TYPE public.org_role ADD VALUE IF NOT EXISTS 'manager';
ALTER TYPE public.org_role ADD VALUE IF NOT EXISTS 'collaborator';
ALTER TYPE public.org_role ADD VALUE IF NOT EXISTS 'freelancer';
ALTER TYPE public.org_role ADD VALUE IF NOT EXISTS 'client';
COMMENT ON TYPE public.org_role IS 'owner=Proprietário, admin=Administrador, manager=Gestor, collaborator=Colaborador, freelancer=Freelancer, client=Cliente final. DEPRECATED values: member, viewer';