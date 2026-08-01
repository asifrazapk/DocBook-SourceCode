# DocBook backend

FastAPI + SQLModel backend for the DocBook clinic assistant, backed by PostgreSQL and Azure OpenAI.

## What changed in this update

1. **Data store → PostgreSQL**, managed/inspected via **pgAdmin**. `db/schema.sql` has the full DDL.
2. **Azure OpenAI** connection (light model, `gpt-5.4-nano` deployment) replaces the public OpenAI client.
3. **Authentication removed** — the `/auth` route, JWT tokens, password hashing, and `verify_token` guards are gone. Every endpoint is now open (no bearer token required).

⚠️ **Removing auth means anyone who can reach this API can create/edit/delete clinics, doctors, FAQs, and appointments.** That's fine for local dev or a fully firewalled internal deployment, but if this API is ever exposed to the internet you'll want some form of access control back (even a simple API key or network-level restriction) before going further.

---

## 1. Set up PostgreSQL with pgAdmin

1. Install PostgreSQL locally (or use a hosted instance) and open **pgAdmin**.
2. In pgAdmin, right-click **Databases → Create → Database**, name it `DocBook`, owner `DocBook` (or your preferred role).
3. Create the app role if it doesn't exist yet: right-click **Login/Group Roles → Create → Login/Group Role**
   - General tab: name `DocBook`
   - Definition tab: password `DocBook` (change this for anything beyond local dev)
   - Privileges tab: enable "Can login?"
4. Load the schema: open the `DocBook` database in pgAdmin, open the **Query Tool**, paste the contents of `db/schema.sql`, and execute (F5).
   - Alternatively, you don't have to run this manually — the FastAPI app calls `SQLModel.metadata.create_all()` on startup and will create any missing tables automatically. `db/schema.sql` is there so you can inspect/manage the schema directly in pgAdmin, or provision the DB before the app ever runs.
5. Confirm tables appear under `DocBook → Schemas → public → Tables` in the pgAdmin tree: `clinics`, `doctors`, `faqs`, `appointments`, `conversations`, `messages`.

## 2. Configure environment variables

Copy `.env.example` to `.env` and fill in real values:

```bash
cp .env.example .env
```

```env
DATABASE_URL=postgresql+psycopg2://DocBook:DocBook@localhost:5432/DocBook

AZURE_OPENAI_ENDPOINT_SM=https://YOUR-RESOURCE-NAME.openai.azure.com/
AZURE_OPENAI_KEY_SM=your-azure-openai-key
AZURE_OPENAI_MODEL_SM=gpt-5.4-nano
AZURE_OPENAI_PREVIEW_API_VERSION_SM=2024-12-01-preview
```

`AZURE_OPENAI_MODEL_SM` must match the **deployment name** you created in Azure AI Studio for this model (not necessarily the underlying model's public name) — Azure OpenAI routes by deployment name, not model name.

A `.env` populated with the credentials you shared is already included in this build for convenience — **treat that key as compromised since it was pasted in plain text in chat, and rotate it in the Azure portal** before relying on this for anything beyond local testing. Never commit `.env` to git (a `.gitignore` is included).

## 3. Install and run

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Visit `http://localhost:8000/docs` for the interactive API docs — every route is callable directly now, no `Authorization` header needed.

## Project layout

```
app/
  core/
    config.py       # env settings (Postgres URL, Azure OpenAI creds)
    database.py      # SQLModel engine/session (Postgres)
  models/             # SQLModel table definitions
  routes/             # FastAPI routers (auth.py removed)
  services/
    openai_service.py     # Azure OpenAI chat + tool-calling loop
    appointment_service.py
    faq_service.py
db/
  schema.sql          # Postgres DDL, for pgAdmin / manual provisioning
```
