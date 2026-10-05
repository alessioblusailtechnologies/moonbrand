-- Lo schema di moonbrand per un progetto Supabase nuovo (per esempio la produzione): tutto lo schema presenza come
-- sul DB di sviluppo dopo la migration 20261005100000_brand_workers. Le migration in ../migrations fino a quella
-- sono già qui dentro; su un DB nato da questo file si applicano solo quelle con data successiva.
--
-- Si lancia una volta, intero, dall'SQL Editor di Supabase (utente postgres). Prima cambia la password qui sotto:
-- è quella di DATABASE_URL (utente presenza_app.<id del progetto>, pooler in session mode, porta 5432).
-- Rifatto con: pg_dump --schema-only --schema=presenza, senza le tabelle vecchie jobs, visual_jobs e schema_migrations.

-- Ruoli: presenza_app è l'utente di API e worker e possiede lo schema; presenza_user è il ruolo che l'API prende per le
-- richieste di chi usa moonbrand, con le policy RLS.
create role presenza_user nologin;
create role presenza_app login password 'CAMBIA-QUESTA-PASSWORD';
grant presenza_user to presenza_app;
grant presenza_app to postgres;


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: presenza; Type: SCHEMA; Schema: -; Owner: presenza_app
--

CREATE SCHEMA presenza;


ALTER SCHEMA presenza OWNER TO presenza_app;

--
-- Name: charge_job_cost(); Type: FUNCTION; Schema: presenza; Owner: presenza_app
--

CREATE FUNCTION presenza.charge_job_cost() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.cost_usd is distinct from old.cost_usd and coalesce(new.cost_usd, 0) <> coalesce(old.cost_usd, 0) then
    insert into presenza.credit_movements (account_id, amount, kind, job_id)
    values (new.account_id, -presenza.credits_for(coalesce(new.cost_usd, 0) - coalesce(old.cost_usd, 0)), 'claude', new.id);
  end if;
  return new;
end;
$$;


ALTER FUNCTION presenza.charge_job_cost() OWNER TO presenza_app;

--
-- Name: charge_usage(); Type: FUNCTION; Schema: presenza; Owner: presenza_app
--

CREATE FUNCTION presenza.charge_usage() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.cost_usd > 0 and new.account_id is not null then
    insert into presenza.credit_movements (account_id, amount, kind, job_id, usage_id)
    values (new.account_id, -presenza.credits_for(new.cost_usd), 'generation', new.job_id, new.id);
  end if;
  return new;
end;
$$;


ALTER FUNCTION presenza.charge_usage() OWNER TO presenza_app;

--
-- Name: credits_for(numeric); Type: FUNCTION; Schema: presenza; Owner: presenza_app
--

CREATE FUNCTION presenza.credits_for(usd numeric) RETURNS numeric
    LANGUAGE sql IMMUTABLE
    AS $$ select round(usd * 100, 4) $$;


ALTER FUNCTION presenza.credits_for(usd numeric) OWNER TO presenza_app;

--
-- Name: current_account_id(); Type: FUNCTION; Schema: presenza; Owner: presenza_app
--

CREATE FUNCTION presenza.current_account_id() RETURNS uuid
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid;
$$;


ALTER FUNCTION presenza.current_account_id() OWNER TO presenza_app;

--
-- Name: touch_updated_at(); Type: FUNCTION; Schema: presenza; Owner: presenza_app
--

CREATE FUNCTION presenza.touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION presenza.touch_updated_at() OWNER TO presenza_app;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: accounts; Type: TABLE; Schema: presenza; Owner: presenza_app
--

CREATE TABLE presenza.accounts (
    id uuid NOT NULL,
    email text NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    active_brand_id uuid,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    locale text DEFAULT 'it'::text NOT NULL,
    CONSTRAINT accounts_locale_check CHECK ((locale = ANY (ARRAY['it'::text, 'en'::text, 'fr'::text])))
);


ALTER TABLE presenza.accounts OWNER TO presenza_app;

--
-- Name: ai_jobs; Type: TABLE; Schema: presenza; Owner: presenza_app
--

CREATE TABLE presenza.ai_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid NOT NULL,
    kind text NOT NULL,
    input jsonb NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    steps jsonb DEFAULT '[]'::jsonb NOT NULL,
    result jsonb,
    error text,
    attempts integer DEFAULT 0 NOT NULL,
    locked_until timestamp with time zone,
    session_id text,
    cost_usd numeric,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    agent_token text,
    cancel_requested boolean DEFAULT false NOT NULL,
    session_cost_usd numeric,
    CONSTRAINT ai_jobs_kind_check CHECK ((kind = ANY (ARRAY['website'::text, 'visual'::text, 'visual-edit'::text, 'ideas'::text, 'content'::text, 'content-edit'::text, 'content-video'::text, 'chat'::text, 'style'::text, 'welcome'::text, 'video-setup'::text]))),
    CONSTRAINT ai_jobs_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'running'::text, 'done'::text, 'failed'::text, 'stopped'::text])))
);


ALTER TABLE presenza.ai_jobs OWNER TO presenza_app;

--
-- Name: ai_usage; Type: TABLE; Schema: presenza; Owner: presenza_app
--

CREATE TABLE presenza.ai_usage (
    id bigint NOT NULL,
    account_id uuid,
    brand_id uuid,
    task text NOT NULL,
    model text NOT NULL,
    outcome text NOT NULL,
    error text,
    duration_ms integer NOT NULL,
    turns integer DEFAULT 0 NOT NULL,
    cost_usd numeric(10,6),
    input_tokens integer DEFAULT 0 NOT NULL,
    output_tokens integer DEFAULT 0 NOT NULL,
    cache_read_tokens integer DEFAULT 0 NOT NULL,
    cache_write_tokens integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    job_id uuid,
    units numeric,
    unit text,
    CONSTRAINT ai_usage_outcome_check CHECK ((outcome = ANY (ARRAY['ok'::text, 'error'::text])))
);


ALTER TABLE presenza.ai_usage OWNER TO presenza_app;

--
-- Name: ai_usage_id_seq; Type: SEQUENCE; Schema: presenza; Owner: presenza_app
--

ALTER TABLE presenza.ai_usage ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME presenza.ai_usage_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: brand_welcome; Type: TABLE; Schema: presenza; Owner: presenza_app
--

CREATE TABLE presenza.brand_welcome (
    brand_id uuid NOT NULL,
    account_id uuid NOT NULL,
    day date NOT NULL,
    fingerprint text NOT NULL,
    greetings jsonb NOT NULL,
    suggestions jsonb NOT NULL,
    job_created_at timestamp with time zone NOT NULL,
    generated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE presenza.brand_welcome OWNER TO presenza_app;

--
-- Name: brand_workers; Type: TABLE; Schema: presenza; Owner: presenza_app
--

CREATE TABLE presenza.brand_workers (
    brand_id text NOT NULL,
    worker_id text NOT NULL,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE presenza.brand_workers OWNER TO presenza_app;

--
-- Name: brands; Type: TABLE; Schema: presenza; Owner: presenza_app
--

CREATE TABLE presenza.brands (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid NOT NULL,
    identity jsonb NOT NULL,
    positioning jsonb NOT NULL,
    channels jsonb NOT NULL,
    themes jsonb NOT NULL,
    voice jsonb NOT NULL,
    visual jsonb NOT NULL,
    refs jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    style_guide text
);


ALTER TABLE presenza.brands OWNER TO presenza_app;

--
-- Name: contents; Type: TABLE; Schema: presenza; Owner: presenza_app
--

CREATE TABLE presenza.contents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    brand_id uuid NOT NULL,
    account_id uuid NOT NULL,
    slot_id uuid,
    idea_id uuid,
    brief jsonb,
    title text NOT NULL,
    theme_id text,
    channels text[] NOT NULL,
    format text NOT NULL,
    variants jsonb NOT NULL,
    visual jsonb NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    revision integer DEFAULT 0 NOT NULL,
    approved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    conversation_id uuid,
    CONSTRAINT contents_format_check CHECK ((format = ANY (ARRAY['post'::text, 'carousel'::text, 'video'::text, 'article'::text]))),
    CONSTRAINT contents_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'approved'::text])))
);


ALTER TABLE presenza.contents OWNER TO presenza_app;

--
-- Name: conversation_turns; Type: TABLE; Schema: presenza; Owner: presenza_app
--

CREATE TABLE presenza.conversation_turns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    account_id uuid NOT NULL,
    message text NOT NULL,
    job_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    attachments text[] DEFAULT '{}'::text[] NOT NULL
);


ALTER TABLE presenza.conversation_turns OWNER TO presenza_app;

--
-- Name: conversations; Type: TABLE; Schema: presenza; Owner: presenza_app
--

CREATE TABLE presenza.conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid NOT NULL,
    brand_id uuid NOT NULL,
    title text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE presenza.conversations OWNER TO presenza_app;

--
-- Name: credit_movements; Type: TABLE; Schema: presenza; Owner: presenza_app
--

CREATE TABLE presenza.credit_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid NOT NULL,
    amount numeric NOT NULL,
    kind text NOT NULL,
    job_id uuid,
    usage_id bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT credit_movements_kind_check CHECK ((kind = ANY (ARRAY['claude'::text, 'generation'::text, 'plan'::text, 'topup'::text, 'adjustment'::text])))
);


ALTER TABLE presenza.credit_movements OWNER TO presenza_app;

--
-- Name: ideas; Type: TABLE; Schema: presenza; Owner: presenza_app
--

CREATE TABLE presenza.ideas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    brand_id uuid NOT NULL,
    account_id uuid NOT NULL,
    title text NOT NULL,
    angle_label text NOT NULL,
    angle text NOT NULL,
    rationale text NOT NULL,
    theme_id text,
    signal jsonb NOT NULL,
    source jsonb,
    formats text[] NOT NULL,
    channels text[] NOT NULL,
    status text DEFAULT 'new'::text NOT NULL,
    decided_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ideas_status_check CHECK ((status = ANY (ARRAY['new'::text, 'saved'::text, 'discarded'::text])))
);


ALTER TABLE presenza.ideas OWNER TO presenza_app;

--
-- Name: publications; Type: TABLE; Schema: presenza; Owner: presenza_app
--

CREATE TABLE presenza.publications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid NOT NULL,
    brand_id uuid NOT NULL,
    content_id uuid NOT NULL,
    slot_id uuid,
    channel text NOT NULL,
    status text NOT NULL,
    zernio_post_id text,
    post_url text,
    error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    published_at timestamp with time zone,
    CONSTRAINT publications_channel_check CHECK ((channel = ANY (ARRAY['linkedin'::text, 'instagram'::text, 'facebook'::text, 'tiktok'::text, 'x'::text]))),
    CONSTRAINT publications_status_check CHECK ((status = ANY (ARRAY['publishing'::text, 'published'::text, 'failed'::text])))
);


ALTER TABLE presenza.publications OWNER TO presenza_app;

--
-- Name: slots; Type: TABLE; Schema: presenza; Owner: presenza_app
--

CREATE TABLE presenza.slots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    brand_id uuid NOT NULL,
    account_id uuid NOT NULL,
    publish_date date NOT NULL,
    publish_time text NOT NULL,
    channels text[] NOT NULL,
    theme_id text,
    idea_id uuid,
    content_title text,
    status text NOT NULL,
    origin text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT slots_origin_check CHECK ((origin = ANY (ARRAY['session'::text, 'manual'::text, 'idea'::text]))),
    CONSTRAINT slots_publish_time_check CHECK ((publish_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'::text)),
    CONSTRAINT slots_status_check CHECK ((status = ANY (ARRAY['empty'::text, 'toPrepare'::text, 'toApprove'::text, 'scheduled'::text, 'published'::text])))
);


ALTER TABLE presenza.slots OWNER TO presenza_app;

--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: presenza; Owner: presenza_app
--

ALTER TABLE ONLY presenza.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: ai_jobs ai_jobs_agent_token_key; Type: CONSTRAINT; Schema: presenza; Owner: presenza_app
--

ALTER TABLE ONLY presenza.ai_jobs
    ADD CONSTRAINT ai_jobs_agent_token_key UNIQUE (agent_token);


--
-- Name: ai_jobs ai_jobs_pkey; Type: CONSTRAINT; Schema: presenza; Owner: presenza_app
--

ALTER TABLE ONLY presenza.ai_jobs
    ADD CONSTRAINT ai_jobs_pkey PRIMARY KEY (id);


--
-- Name: ai_usage ai_usage_pkey; Type: CONSTRAINT; Schema: presenza; Owner: presenza_app
--

ALTER TABLE ONLY presenza.ai_usage
    ADD CONSTRAINT ai_usage_pkey PRIMARY KEY (id);


--
-- Name: brand_welcome brand_welcome_pkey; Type: CONSTRAINT; Schema: presenza; Owner: presenza_app
--

ALTER TABLE ONLY presenza.brand_welcome
    ADD CONSTRAINT brand_welcome_pkey PRIMARY KEY (brand_id);


--
-- Name: brand_workers brand_workers_pkey; Type: CONSTRAINT; Schema: presenza; Owner: presenza_app
--

ALTER TABLE ONLY presenza.brand_workers
    ADD CONSTRAINT brand_workers_pkey PRIMARY KEY (brand_id);


--
-- Name: brands brands_id_account_id_key; Type: CONSTRAINT; Schema: presenza; Owner: presenza_app
--

ALTER TABLE ONLY presenza.brands
    ADD CONSTRAINT brands_id_account_id_key UNIQUE (id, account_id);


--
-- Name: brands brands_pkey; Type: CONSTRAINT; Schema: presenza; Owner: presenza_app
--

ALTER TABLE ONLY presenza.brands
    ADD CONSTRAINT brands_pkey PRIMARY KEY (id);


--
-- Name: contents contents_pkey; Type: CONSTRAINT; Schema: presenza; Owner: presenza_app
--

ALTER TABLE ONLY presenza.contents
    ADD CONSTRAINT contents_pkey PRIMARY KEY (id);


--
-- Name: conversation_turns conversation_turns_pkey; Type: CONSTRAINT; Schema: presenza; Owner: presenza_app
--

ALTER TABLE ONLY presenza.conversation_turns
    ADD CONSTRAINT conversation_turns_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: presenza; Owner: presenza_app
--

ALTER TABLE ONLY presenza.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: credit_movements credit_movements_pkey; Type: CONSTRAINT; Schema: presenza; Owner: presenza_app
--

ALTER TABLE ONLY presenza.credit_movements
    ADD CONSTRAINT credit_movements_pkey PRIMARY KEY (id);


--
-- Name: credit_movements credit_movements_usage_id_key; Type: CONSTRAINT; Schema: presenza; Owner: presenza_app
--

ALTER TABLE ONLY presenza.credit_movements
    ADD CONSTRAINT credit_movements_usage_id_key UNIQUE (usage_id);


--
-- Name: ideas ideas_id_account_id_key; Type: CONSTRAINT; Schema: presenza; Owner: presenza_app
--

ALTER TABLE ONLY presenza.ideas
    ADD CONSTRAINT ideas_id_account_id_key UNIQUE (id, account_id);


--
-- Name: ideas ideas_pkey; Type: CONSTRAINT; Schema: presenza; Owner: presenza_app
--

ALTER TABLE ONLY presenza.ideas
    ADD CONSTRAINT ideas_pkey PRIMARY KEY (id);


--
-- Name: publications publications_content_id_channel_key; Type: CONSTRAINT; Schema: presenza; Owner: presenza_app
--

ALTER TABLE ONLY presenza.publications
    ADD CONSTRAINT publications_content_id_channel_key UNIQUE (content_id, channel);


--
-- Name: publications publications_pkey; Type: CONSTRAINT; Schema: presenza; Owner: presenza_app
--

ALTER TABLE ONLY presenza.publications
    ADD CONSTRAINT publications_pkey PRIMARY KEY (id);


--
-- Name: slots slots_id_account_id_key; Type: CONSTRAINT; Schema: presenza; Owner: presenza_app
--

ALTER TABLE ONLY presenza.slots
    ADD CONSTRAINT slots_id_account_id_key UNIQUE (id, account_id);


--
-- Name: slots slots_pkey; Type: CONSTRAINT; Schema: presenza; Owner: presenza_app
--

ALTER TABLE ONLY presenza.slots
    ADD CONSTRAINT slots_pkey PRIMARY KEY (id);


--
-- Name: ai_jobs_account; Type: INDEX; Schema: presenza; Owner: presenza_app
--

CREATE INDEX ai_jobs_account ON presenza.ai_jobs USING btree (account_id, created_at);


--
-- Name: ai_jobs_pending; Type: INDEX; Schema: presenza; Owner: presenza_app
--

CREATE INDEX ai_jobs_pending ON presenza.ai_jobs USING btree (created_at) WHERE (status = ANY (ARRAY['queued'::text, 'running'::text]));


--
-- Name: ai_usage_account; Type: INDEX; Schema: presenza; Owner: presenza_app
--

CREATE INDEX ai_usage_account ON presenza.ai_usage USING btree (account_id, created_at DESC);


--
-- Name: ai_usage_job_id_idx; Type: INDEX; Schema: presenza; Owner: presenza_app
--

CREATE INDEX ai_usage_job_id_idx ON presenza.ai_usage USING btree (job_id);


--
-- Name: brand_workers_worker; Type: INDEX; Schema: presenza; Owner: presenza_app
--

CREATE INDEX brand_workers_worker ON presenza.brand_workers USING btree (worker_id);


--
-- Name: brands_account; Type: INDEX; Schema: presenza; Owner: presenza_app
--

CREATE INDEX brands_account ON presenza.brands USING btree (account_id, created_at);


--
-- Name: contents_brand; Type: INDEX; Schema: presenza; Owner: presenza_app
--

CREATE INDEX contents_brand ON presenza.contents USING btree (brand_id, updated_at DESC);


--
-- Name: contents_slot; Type: INDEX; Schema: presenza; Owner: presenza_app
--

CREATE UNIQUE INDEX contents_slot ON presenza.contents USING btree (slot_id) WHERE (slot_id IS NOT NULL);


--
-- Name: conversation_turns_conversation; Type: INDEX; Schema: presenza; Owner: presenza_app
--

CREATE INDEX conversation_turns_conversation ON presenza.conversation_turns USING btree (conversation_id, created_at);


--
-- Name: conversations_brand; Type: INDEX; Schema: presenza; Owner: presenza_app
--

CREATE INDEX conversations_brand ON presenza.conversations USING btree (brand_id, updated_at DESC);


--
-- Name: credit_movements_account; Type: INDEX; Schema: presenza; Owner: presenza_app
--

CREATE INDEX credit_movements_account ON presenza.credit_movements USING btree (account_id, created_at);


--
-- Name: credit_movements_job; Type: INDEX; Schema: presenza; Owner: presenza_app
--

CREATE INDEX credit_movements_job ON presenza.credit_movements USING btree (job_id);


--
-- Name: ideas_brand; Type: INDEX; Schema: presenza; Owner: presenza_app
--

CREATE INDEX ideas_brand ON presenza.ideas USING btree (brand_id, created_at DESC);


--
-- Name: publications_publishing; Type: INDEX; Schema: presenza; Owner: presenza_app
--

CREATE INDEX publications_publishing ON presenza.publications USING btree (updated_at) WHERE (status = 'publishing'::text);


--
-- Name: publications_slot; Type: INDEX; Schema: presenza; Owner: presenza_app
--

CREATE INDEX publications_slot ON presenza.publications USING btree (slot_id);


--
-- Name: slots_brand; Type: INDEX; Schema: presenza; Owner: presenza_app
--

CREATE INDEX slots_brand ON presenza.slots USING btree (brand_id, publish_date, publish_time);


--
-- Name: accounts accounts_updated_at; Type: TRIGGER; Schema: presenza; Owner: presenza_app
--

CREATE TRIGGER accounts_updated_at BEFORE UPDATE ON presenza.accounts FOR EACH ROW EXECUTE FUNCTION presenza.touch_updated_at();


--
-- Name: ai_jobs ai_jobs_charge; Type: TRIGGER; Schema: presenza; Owner: presenza_app
--

CREATE TRIGGER ai_jobs_charge AFTER UPDATE OF cost_usd ON presenza.ai_jobs FOR EACH ROW EXECUTE FUNCTION presenza.charge_job_cost();


--
-- Name: ai_usage ai_usage_charge; Type: TRIGGER; Schema: presenza; Owner: presenza_app
--

CREATE TRIGGER ai_usage_charge AFTER INSERT ON presenza.ai_usage FOR EACH ROW EXECUTE FUNCTION presenza.charge_usage();


--
-- Name: brands brands_updated_at; Type: TRIGGER; Schema: presenza; Owner: presenza_app
--

CREATE TRIGGER brands_updated_at BEFORE UPDATE ON presenza.brands FOR EACH ROW EXECUTE FUNCTION presenza.touch_updated_at();


--
-- Name: contents contents_updated_at; Type: TRIGGER; Schema: presenza; Owner: presenza_app
--

CREATE TRIGGER contents_updated_at BEFORE UPDATE ON presenza.contents FOR EACH ROW EXECUTE FUNCTION presenza.touch_updated_at();


--
-- Name: accounts accounts_active_brand; Type: FK CONSTRAINT; Schema: presenza; Owner: presenza_app
--

ALTER TABLE ONLY presenza.accounts
    ADD CONSTRAINT accounts_active_brand FOREIGN KEY (active_brand_id, id) REFERENCES presenza.brands(id, account_id) ON DELETE SET NULL (active_brand_id);


--
-- Name: accounts accounts_id_fkey; Type: FK CONSTRAINT; Schema: presenza; Owner: presenza_app
--

ALTER TABLE ONLY presenza.accounts
    ADD CONSTRAINT accounts_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: ai_jobs ai_jobs_account_id_fkey; Type: FK CONSTRAINT; Schema: presenza; Owner: presenza_app
--

ALTER TABLE ONLY presenza.ai_jobs
    ADD CONSTRAINT ai_jobs_account_id_fkey FOREIGN KEY (account_id) REFERENCES presenza.accounts(id) ON DELETE CASCADE;


--
-- Name: ai_usage ai_usage_account_id_fkey; Type: FK CONSTRAINT; Schema: presenza; Owner: presenza_app
--

ALTER TABLE ONLY presenza.ai_usage
    ADD CONSTRAINT ai_usage_account_id_fkey FOREIGN KEY (account_id) REFERENCES presenza.accounts(id) ON DELETE SET NULL;


--
-- Name: ai_usage ai_usage_job_id_fkey; Type: FK CONSTRAINT; Schema: presenza; Owner: presenza_app
--

ALTER TABLE ONLY presenza.ai_usage
    ADD CONSTRAINT ai_usage_job_id_fkey FOREIGN KEY (job_id) REFERENCES presenza.ai_jobs(id) ON DELETE SET NULL;


--
-- Name: brand_welcome brand_welcome_account_id_fkey; Type: FK CONSTRAINT; Schema: presenza; Owner: presenza_app
--

ALTER TABLE ONLY presenza.brand_welcome
    ADD CONSTRAINT brand_welcome_account_id_fkey FOREIGN KEY (account_id) REFERENCES presenza.accounts(id) ON DELETE CASCADE;


--
-- Name: brand_welcome brand_welcome_brand_id_fkey; Type: FK CONSTRAINT; Schema: presenza; Owner: presenza_app
--

ALTER TABLE ONLY presenza.brand_welcome
    ADD CONSTRAINT brand_welcome_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES presenza.brands(id) ON DELETE CASCADE;


--
-- Name: brands brands_account_id_fkey; Type: FK CONSTRAINT; Schema: presenza; Owner: presenza_app
--

ALTER TABLE ONLY presenza.brands
    ADD CONSTRAINT brands_account_id_fkey FOREIGN KEY (account_id) REFERENCES presenza.accounts(id) ON DELETE CASCADE;


--
-- Name: contents contents_brand_id_account_id_fkey; Type: FK CONSTRAINT; Schema: presenza; Owner: presenza_app
--

ALTER TABLE ONLY presenza.contents
    ADD CONSTRAINT contents_brand_id_account_id_fkey FOREIGN KEY (brand_id, account_id) REFERENCES presenza.brands(id, account_id) ON DELETE CASCADE;


--
-- Name: contents contents_conversation_id_fkey; Type: FK CONSTRAINT; Schema: presenza; Owner: presenza_app
--

ALTER TABLE ONLY presenza.contents
    ADD CONSTRAINT contents_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES presenza.conversations(id) ON DELETE SET NULL;


--
-- Name: contents contents_idea_id_account_id_fkey; Type: FK CONSTRAINT; Schema: presenza; Owner: presenza_app
--

ALTER TABLE ONLY presenza.contents
    ADD CONSTRAINT contents_idea_id_account_id_fkey FOREIGN KEY (idea_id, account_id) REFERENCES presenza.ideas(id, account_id) ON DELETE SET NULL (idea_id);


--
-- Name: contents contents_slot_id_account_id_fkey; Type: FK CONSTRAINT; Schema: presenza; Owner: presenza_app
--

ALTER TABLE ONLY presenza.contents
    ADD CONSTRAINT contents_slot_id_account_id_fkey FOREIGN KEY (slot_id, account_id) REFERENCES presenza.slots(id, account_id) ON DELETE SET NULL (slot_id);


--
-- Name: conversation_turns conversation_turns_account_id_fkey; Type: FK CONSTRAINT; Schema: presenza; Owner: presenza_app
--

ALTER TABLE ONLY presenza.conversation_turns
    ADD CONSTRAINT conversation_turns_account_id_fkey FOREIGN KEY (account_id) REFERENCES presenza.accounts(id) ON DELETE CASCADE;


--
-- Name: conversation_turns conversation_turns_conversation_id_fkey; Type: FK CONSTRAINT; Schema: presenza; Owner: presenza_app
--

ALTER TABLE ONLY presenza.conversation_turns
    ADD CONSTRAINT conversation_turns_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES presenza.conversations(id) ON DELETE CASCADE;


--
-- Name: conversation_turns conversation_turns_job_id_fkey; Type: FK CONSTRAINT; Schema: presenza; Owner: presenza_app
--

ALTER TABLE ONLY presenza.conversation_turns
    ADD CONSTRAINT conversation_turns_job_id_fkey FOREIGN KEY (job_id) REFERENCES presenza.ai_jobs(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_account_id_fkey; Type: FK CONSTRAINT; Schema: presenza; Owner: presenza_app
--

ALTER TABLE ONLY presenza.conversations
    ADD CONSTRAINT conversations_account_id_fkey FOREIGN KEY (account_id) REFERENCES presenza.accounts(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_brand_id_fkey; Type: FK CONSTRAINT; Schema: presenza; Owner: presenza_app
--

ALTER TABLE ONLY presenza.conversations
    ADD CONSTRAINT conversations_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES presenza.brands(id) ON DELETE CASCADE;


--
-- Name: credit_movements credit_movements_account_id_fkey; Type: FK CONSTRAINT; Schema: presenza; Owner: presenza_app
--

ALTER TABLE ONLY presenza.credit_movements
    ADD CONSTRAINT credit_movements_account_id_fkey FOREIGN KEY (account_id) REFERENCES presenza.accounts(id) ON DELETE CASCADE;


--
-- Name: credit_movements credit_movements_job_id_fkey; Type: FK CONSTRAINT; Schema: presenza; Owner: presenza_app
--

ALTER TABLE ONLY presenza.credit_movements
    ADD CONSTRAINT credit_movements_job_id_fkey FOREIGN KEY (job_id) REFERENCES presenza.ai_jobs(id) ON DELETE SET NULL;


--
-- Name: ideas ideas_brand_id_account_id_fkey; Type: FK CONSTRAINT; Schema: presenza; Owner: presenza_app
--

ALTER TABLE ONLY presenza.ideas
    ADD CONSTRAINT ideas_brand_id_account_id_fkey FOREIGN KEY (brand_id, account_id) REFERENCES presenza.brands(id, account_id) ON DELETE CASCADE;


--
-- Name: publications publications_account_id_fkey; Type: FK CONSTRAINT; Schema: presenza; Owner: presenza_app
--

ALTER TABLE ONLY presenza.publications
    ADD CONSTRAINT publications_account_id_fkey FOREIGN KEY (account_id) REFERENCES presenza.accounts(id) ON DELETE CASCADE;


--
-- Name: publications publications_brand_id_fkey; Type: FK CONSTRAINT; Schema: presenza; Owner: presenza_app
--

ALTER TABLE ONLY presenza.publications
    ADD CONSTRAINT publications_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES presenza.brands(id) ON DELETE CASCADE;


--
-- Name: publications publications_content_id_fkey; Type: FK CONSTRAINT; Schema: presenza; Owner: presenza_app
--

ALTER TABLE ONLY presenza.publications
    ADD CONSTRAINT publications_content_id_fkey FOREIGN KEY (content_id) REFERENCES presenza.contents(id) ON DELETE CASCADE;


--
-- Name: publications publications_slot_id_fkey; Type: FK CONSTRAINT; Schema: presenza; Owner: presenza_app
--

ALTER TABLE ONLY presenza.publications
    ADD CONSTRAINT publications_slot_id_fkey FOREIGN KEY (slot_id) REFERENCES presenza.slots(id) ON DELETE SET NULL;


--
-- Name: slots slots_brand_id_account_id_fkey; Type: FK CONSTRAINT; Schema: presenza; Owner: presenza_app
--

ALTER TABLE ONLY presenza.slots
    ADD CONSTRAINT slots_brand_id_account_id_fkey FOREIGN KEY (brand_id, account_id) REFERENCES presenza.brands(id, account_id) ON DELETE CASCADE;


--
-- Name: slots slots_idea_id_account_id_fkey; Type: FK CONSTRAINT; Schema: presenza; Owner: presenza_app
--

ALTER TABLE ONLY presenza.slots
    ADD CONSTRAINT slots_idea_id_account_id_fkey FOREIGN KEY (idea_id, account_id) REFERENCES presenza.ideas(id, account_id) ON DELETE SET NULL (idea_id);


--
-- Name: accounts; Type: ROW SECURITY; Schema: presenza; Owner: presenza_app
--

ALTER TABLE presenza.accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: accounts accounts_own; Type: POLICY; Schema: presenza; Owner: presenza_app
--

CREATE POLICY accounts_own ON presenza.accounts TO presenza_user USING ((id = presenza.current_account_id())) WITH CHECK ((id = presenza.current_account_id()));


--
-- Name: ai_jobs; Type: ROW SECURITY; Schema: presenza; Owner: presenza_app
--

ALTER TABLE presenza.ai_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_jobs ai_jobs_insert_own; Type: POLICY; Schema: presenza; Owner: presenza_app
--

CREATE POLICY ai_jobs_insert_own ON presenza.ai_jobs FOR INSERT TO presenza_user WITH CHECK ((account_id = presenza.current_account_id()));


--
-- Name: ai_jobs ai_jobs_select_own; Type: POLICY; Schema: presenza; Owner: presenza_app
--

CREATE POLICY ai_jobs_select_own ON presenza.ai_jobs FOR SELECT TO presenza_user USING ((account_id = presenza.current_account_id()));


--
-- Name: ai_usage; Type: ROW SECURITY; Schema: presenza; Owner: presenza_app
--

ALTER TABLE presenza.ai_usage ENABLE ROW LEVEL SECURITY;

--
-- Name: brand_welcome; Type: ROW SECURITY; Schema: presenza; Owner: presenza_app
--

ALTER TABLE presenza.brand_welcome ENABLE ROW LEVEL SECURITY;

--
-- Name: brand_welcome brand_welcome_own; Type: POLICY; Schema: presenza; Owner: presenza_app
--

CREATE POLICY brand_welcome_own ON presenza.brand_welcome FOR SELECT TO presenza_user USING ((account_id = presenza.current_account_id()));


--
-- Name: brand_workers; Type: ROW SECURITY; Schema: presenza; Owner: presenza_app
--

ALTER TABLE presenza.brand_workers ENABLE ROW LEVEL SECURITY;

--
-- Name: brands; Type: ROW SECURITY; Schema: presenza; Owner: presenza_app
--

ALTER TABLE presenza.brands ENABLE ROW LEVEL SECURITY;

--
-- Name: brands brands_own; Type: POLICY; Schema: presenza; Owner: presenza_app
--

CREATE POLICY brands_own ON presenza.brands TO presenza_user USING ((account_id = presenza.current_account_id())) WITH CHECK ((account_id = presenza.current_account_id()));


--
-- Name: contents; Type: ROW SECURITY; Schema: presenza; Owner: presenza_app
--

ALTER TABLE presenza.contents ENABLE ROW LEVEL SECURITY;

--
-- Name: contents contents_own; Type: POLICY; Schema: presenza; Owner: presenza_app
--

CREATE POLICY contents_own ON presenza.contents TO presenza_user USING ((account_id = presenza.current_account_id())) WITH CHECK ((account_id = presenza.current_account_id()));


--
-- Name: conversation_turns; Type: ROW SECURITY; Schema: presenza; Owner: presenza_app
--

ALTER TABLE presenza.conversation_turns ENABLE ROW LEVEL SECURITY;

--
-- Name: conversation_turns conversation_turns_own; Type: POLICY; Schema: presenza; Owner: presenza_app
--

CREATE POLICY conversation_turns_own ON presenza.conversation_turns TO presenza_user USING ((account_id = presenza.current_account_id())) WITH CHECK ((account_id = presenza.current_account_id()));


--
-- Name: conversations; Type: ROW SECURITY; Schema: presenza; Owner: presenza_app
--

ALTER TABLE presenza.conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: conversations conversations_own; Type: POLICY; Schema: presenza; Owner: presenza_app
--

CREATE POLICY conversations_own ON presenza.conversations TO presenza_user USING ((account_id = presenza.current_account_id())) WITH CHECK ((account_id = presenza.current_account_id()));


--
-- Name: credit_movements; Type: ROW SECURITY; Schema: presenza; Owner: presenza_app
--

ALTER TABLE presenza.credit_movements ENABLE ROW LEVEL SECURITY;

--
-- Name: credit_movements credit_movements_own; Type: POLICY; Schema: presenza; Owner: presenza_app
--

CREATE POLICY credit_movements_own ON presenza.credit_movements FOR SELECT TO presenza_user USING ((account_id = presenza.current_account_id()));


--
-- Name: ideas; Type: ROW SECURITY; Schema: presenza; Owner: presenza_app
--

ALTER TABLE presenza.ideas ENABLE ROW LEVEL SECURITY;

--
-- Name: ideas ideas_own; Type: POLICY; Schema: presenza; Owner: presenza_app
--

CREATE POLICY ideas_own ON presenza.ideas TO presenza_user USING ((account_id = presenza.current_account_id())) WITH CHECK ((account_id = presenza.current_account_id()));


--
-- Name: publications; Type: ROW SECURITY; Schema: presenza; Owner: presenza_app
--

ALTER TABLE presenza.publications ENABLE ROW LEVEL SECURITY;

--
-- Name: publications publications_own; Type: POLICY; Schema: presenza; Owner: presenza_app
--

CREATE POLICY publications_own ON presenza.publications FOR SELECT TO presenza_user USING ((account_id = presenza.current_account_id()));


--
-- Name: slots; Type: ROW SECURITY; Schema: presenza; Owner: presenza_app
--

ALTER TABLE presenza.slots ENABLE ROW LEVEL SECURITY;

--
-- Name: slots slots_own; Type: POLICY; Schema: presenza; Owner: presenza_app
--

CREATE POLICY slots_own ON presenza.slots TO presenza_user USING ((account_id = presenza.current_account_id())) WITH CHECK ((account_id = presenza.current_account_id()));


--
-- Name: SCHEMA presenza; Type: ACL; Schema: -; Owner: presenza_app
--

GRANT USAGE ON SCHEMA presenza TO presenza_user;


--
-- Name: TABLE accounts; Type: ACL; Schema: presenza; Owner: presenza_app
--

GRANT SELECT,UPDATE ON TABLE presenza.accounts TO presenza_user;


--
-- Name: COLUMN accounts.locale; Type: ACL; Schema: presenza; Owner: presenza_app
--

GRANT UPDATE(locale) ON TABLE presenza.accounts TO presenza_user;


--
-- Name: TABLE ai_jobs; Type: ACL; Schema: presenza; Owner: presenza_app
--

GRANT SELECT,INSERT ON TABLE presenza.ai_jobs TO presenza_user;


--
-- Name: TABLE brand_welcome; Type: ACL; Schema: presenza; Owner: presenza_app
--

GRANT SELECT ON TABLE presenza.brand_welcome TO presenza_user;


--
-- Name: TABLE brands; Type: ACL; Schema: presenza; Owner: presenza_app
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE presenza.brands TO presenza_user;


--
-- Name: TABLE contents; Type: ACL; Schema: presenza; Owner: presenza_app
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE presenza.contents TO presenza_user;


--
-- Name: TABLE conversation_turns; Type: ACL; Schema: presenza; Owner: presenza_app
--

GRANT SELECT,INSERT ON TABLE presenza.conversation_turns TO presenza_user;


--
-- Name: TABLE conversations; Type: ACL; Schema: presenza; Owner: presenza_app
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE presenza.conversations TO presenza_user;


--
-- Name: TABLE credit_movements; Type: ACL; Schema: presenza; Owner: presenza_app
--

GRANT SELECT ON TABLE presenza.credit_movements TO presenza_user;


--
-- Name: TABLE ideas; Type: ACL; Schema: presenza; Owner: presenza_app
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE presenza.ideas TO presenza_user;


--
-- Name: TABLE publications; Type: ACL; Schema: presenza; Owner: presenza_app
--

GRANT SELECT ON TABLE presenza.publications TO presenza_user;


--
-- Name: TABLE slots; Type: ACL; Schema: presenza; Owner: presenza_app
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE presenza.slots TO presenza_user;


--
-- PostgreSQL database dump complete
--


