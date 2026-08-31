# AURA — Production Infrastructure & OpenAI Media Integration Specification

## 1. Mission

Upgrade the existing AURA multi-agent creative studio for reliable live deployment and judging.

AURA is a WebMCP-native AI video production studio where:

* An external AI agent discovers AURA's WebMCP tools.
* The Creative Director orchestrates a 10-agent production crew.
* Production artifacts appear progressively on a visual timeline.
* Humans can intervene through Human Veto.
* The final output is a playable video.
* The application is deployed on Vercel.
* Structured state is stored in Supabase PostgreSQL.
* Generated media is stored in Cloudflare R2.
* OpenAI provides the LLM and supported image/video generation.
* Speechify provides voice generation.
* Existing deterministic fallbacks remain available for reliability.

The implementation must prioritize:

1. Reliability
2. Low API cost
3. Fast judge experience
4. High-quality media
5. OpenAI integration
6. Speechify integration
7. Provider independence where practical
8. Preservation of the existing WebMCP contract
9. No unnecessary architectural rewrites

---

# 2. LOCKED ARCHITECTURE

Use this architecture:

```text
                    EXTERNAL AI AGENT
                           |
                           v
                    +-------------+
                    |   VERCEL    |
                    |  Next.js    |
                    +------+------+
                           |
                       WebMCP
                           |
                  14 Production Tools
                           |
        +------------------+------------------+
        |                  |                  |
        v                  v                  v
   SUPABASE            OPENAI            SPEECHIFY
  PostgreSQL         LLM / Image /       Text-to-Speech
                       Video*
        |                  |                  |
        |                  |                  |
        +------------------+------------------+
                           |
                           v
                    CLOUDFLARE R2
                      MEDIA STORE
                           |
             +-------------+-------------+
             |             |             |
            PNG           WAV/MP3       MP4
             |             |             |
             +-------------+-------------+
                           |
                           v
                    AURA TIMELINE
                           |
                           v
                       HUMAN VETO
                           |
                           v
                       FINAL VIDEO
```

`*` Video generation must use the currently supported OpenAI video capability if available to the deployed application/account. Do not invent an unsupported API.

---

# 3. SERVICE RESPONSIBILITIES

## Vercel

Vercel hosts:

* Next.js application
* AURA control-room UI
* WebMCP registration
* WebMCP execution endpoint
* Agent orchestration
* API routes
* Human Veto
* OpenAI API integration
* Speechify API integration
* Supabase queries
* R2 signed URL generation
* asynchronous job handling
* provider routing

Do NOT use the Vercel filesystem as persistent media storage.

Do NOT store permanent MP4/WAV/PNG files on the Vercel filesystem.

---

# 4. SUPABASE

Supabase PostgreSQL is the source of truth for structured production state.

Use Supabase for:

* Projects
* Scenes
* Agents
* Production state
* Tool execution logs
* Artifact metadata
* Human decisions
* AI generation jobs
* Revision history
* Provider status

Do NOT use Supabase Storage for primary media storage.

Cloudflare R2 is the media store.

---

# 5. CLOUDFLARE R2

Cloudflare R2 is the persistent media store.

Store:

* PNG images
* WAV/MP3 voiceovers
* MP4 scene videos
* final MP4 exports
* thumbnails
* optional caption assets

Suggested structure:

```text
projects/
  {projectId}/
    scenes/
      {sceneId}/
        image/
          {artifactId}.png
        video/
          {artifactId}.mp4
        audio/
          {artifactId}.mp3
        captions/
          {artifactId}.json

    final/
      {artifactId}.mp4
```

Supabase stores metadata and R2 object keys.

Supabase must NOT contain large binary media blobs.

---

# 6. OPENAI

OpenAI is the primary AI provider.

Use OpenAI for:

## LLM

Use the currently supported OpenAI model/API for:

* Creative Director planning
* script generation
* copy generation
* storyboard reasoning
* QA/review reasoning
* refinement instructions
* agent orchestration reasoning where appropriate

Do not hard-code a model name unless it is confirmed to exist in the current API environment.

Make the model configurable through environment variables.

Example:

```text
OPENAI_LLM_MODEL=
```

The implementation agent must inspect the current OpenAI API documentation/SDK and use the supported API.

---

# 7. OPENAI IMAGE GENERATION

Use OpenAI's currently supported image-generation API/model for:

```text
generate_image
```

The tool must:

1. Check cache.
2. Generate through OpenAI if configured.
3. Receive image output.
4. Upload image to R2.
5. Store metadata in Supabase.
6. Return the artifact.
7. Fall back to the existing deterministic image generator if OpenAI fails.

Do not store the image permanently in Vercel.

Architecture:

```text
generate_image
      |
      v
cache?
  |       |
 YES      NO
 |        |
return   OpenAI
          |
       image
          |
          v
         R2
          |
          v
      Supabase
          |
          v
       artifact
```

---

# 8. OPENAI VIDEO GENERATION

Use OpenAI's currently supported video-generation API/model if it is available to the deployment.

IMPORTANT:

Do not assume a specific video endpoint, model name, SDK method, or response structure.

Before implementation:

1. Inspect the current OpenAI API/SDK.
2. Confirm the supported video-generation capability.
3. Confirm whether image-to-video is supported.
4. Confirm whether asynchronous jobs are required.
5. Confirm current response format.
6. Implement only the supported API.

If supported:

```text
image_to_video
      |
      v
OpenAI video API
      |
      v
async generation job
      |
      v
poll/status or supported completion mechanism
      |
      v
video
      |
      v
R2
      |
      v
Supabase
      |
      v
timeline
```

If OpenAI video generation is not available in the deployed environment:

```text
image_to_video
      |
      v
existing deterministic/still-video fallback
      |
      v
R2
      |
      v
Supabase
```

Do NOT break the application because video inference is unavailable.

---

# 9. PROVIDER ABSTRACTION

Keep AI provider implementations behind internal interfaces.

Suggested architecture:

```text
lib/
  ai/
    llm/
      index.ts
      openai.ts

    image/
      index.ts
      openai.ts
      deterministic.ts

    video/
      index.ts
      openai.ts
      deterministic.ts

    speech/
      index.ts
      speechify.ts
      fallback.ts
```

Adapt the exact folder structure to the existing repository.

Do not create duplicate implementations if equivalent abstractions already exist.

---

# 10. SPEECHIFY

Speechify is the preferred TTS provider.

Do NOT replace Speechify with another provider.

Existing WebMCP tool:

```text
text_to_speech
```

Flow:

```text
text_to_speech
      |
      v
SpeechProvider
      |
      v
Speechify API
      |
      v
audio
      |
      v
Cloudflare R2
      |
      v
Supabase artifact metadata
      |
      v
Timeline
```

Speechify credentials must remain server-side.

Example environment variable:

```text
SPEECHIFY_API_KEY=
```

Use the currently supported Speechify API and SDK/request format.

Do not invent endpoints.

---

# 11. SPEECH FALLBACK

If Speechify:

* is unavailable
* times out
* returns an error
* has no API key
* exceeds rate limits

then use the existing fallback implementation if one exists.

The application must not crash.

---

# 12. PROVIDER ROUTING

Every expensive media operation must follow:

```text
Tool
 |
 v
Cache
 |
 +---- HIT ----> existing R2 artifact
 |
 +---- MISS ---> primary provider
                  |
                  +---- SUCCESS ---> R2 ---> Supabase
                  |
                  +---- FAILURE ---> fallback
```

Do not make a paid AI provider the single point of failure.

---

# 13. CACHE

Caching is mandatory.

Before generating media:

1. Create deterministic generation signature.
2. Hash relevant inputs.
3. Check Supabase/R2 for existing artifact.
4. Return cached artifact when valid.
5. Only call OpenAI/Speechify when necessary.

Generation signature should include relevant values such as:

```text
project
scene
prompt
model
duration
resolution
aspect ratio
input artifact
generation settings
voice settings
```

Do not include timestamps in the generation hash.

---

# 14. LLM ARCHITECTURE

Use OpenAI for the reasoning-heavy agents where appropriate.

Recommended:

```text
Creative Director
       |
       v
OpenAI LLM
       |
       +--> production plan

Brand Strategist
       |
       v
OpenAI LLM
       |
       +--> audience / voice / angle

Scriptwriter
       |
       v
OpenAI LLM
       |
       +--> scene narrative

Copywriter
       |
       v
OpenAI LLM
       |
       +--> captions / CTA

Critic / QA
       |
       v
OpenAI LLM
       |
       +--> review / issues / approval recommendation
```

The agent personas remain part of AURA.

Do not replace them with a single generic chatbot.

---

# 15. AGENT PERSONAS

Maintain these 10 agents:

1. Creative Director
2. Brand Strategist
3. Scriptwriter
4. Copywriter
5. Graphic Designer
6. Motion Graphics
7. Voiceover
8. Video Editor
9. Critic/QA
10. Project Manager

The Creative Director remains the orchestrator.

The agents should report production state through the existing crew/handoff system.

---

# 16. WEBMCP TOOLS

Do NOT rename or remove the existing tools.

The existing 14 tools are:

```text
create_project
generate_script
create_storyboard
generate_image
text_to_speech
write_caption
image_to_video
text_to_video
compose_video
review_video
request_human_approval
get_project_status
refine_scene
color_grade
```

All 14 must remain registered.

Preserve their existing schemas wherever possible.

Do not introduce provider-specific WebMCP tools.

---

# 17. EXTERNAL AGENT FLOW

The following flow must continue working:

```text
getTools()
    |
    v
create_project
    |
    v
generate_script
    |
    v
create_storyboard
    |
    v
generate_image × scenes
    |
    v
image_to_video
    |
    v
text_to_speech
    |
    v
write_caption
    |
    v
compose_video
    |
    v
review_video
    |
    v
request_human_approval
    |
    +---- approve
    |
    +---- reject
              |
              v
         refine_scene
              |
              v
         compose_video
              |
              v
            review
              |
              v
           approve
```

This is the core demo.

---

# 18. CREATE PROJECT

Existing tool:

```text
create_project
```

It must:

1. Create project in Supabase.
2. Initialize project state.
3. Initialize agent state.
4. Return project ID.
5. Make the project immediately available to the control room.

---

# 19. SCRIPT

Existing tool:

```text
generate_script
```

Use OpenAI LLM.

Persist:

* script
* scenes
* hook
* narrative
* metadata

Do not make the script generation purely deterministic unless OpenAI is unavailable.

---

# 20. STORYBOARD

Existing tool:

```text
create_storyboard
```

Use OpenAI LLM for storyboard reasoning.

The storyboard should contain:

* scene number
* visual description
* camera/shot description
* visual prompt
* narration
* caption concept
* approximate duration
* transition intent

Persist the structured storyboard in Supabase.

---

# 21. IMAGE

Existing tool:

```text
generate_image
```

Primary:

```text
OpenAI image generation
```

Fallback:

```text
existing deterministic image generator
```

Store successful images in R2.

---

# 22. TTS

Existing tool:

```text
text_to_speech
```

Primary:

```text
Speechify
```

Fallback:

```text
existing fallback
```

Store audio in R2.

---

# 23. IMAGE-TO-VIDEO

Existing tool:

```text
image_to_video
```

Primary:

```text
OpenAI supported video generation
```

Fallback:

```text
existing still-video implementation
```

The implementation MUST inspect the current OpenAI API before coding this section.

Do not invent an API.

Video generation must support asynchronous execution if required by the current provider.

---

# 24. TEXT-TO-VIDEO

Existing tool:

```text
text_to_video
```

Use OpenAI's supported video generation capability if available.

If the current OpenAI API does not provide the required text-to-video functionality:

* preserve the tool
* return a valid controlled fallback
* do not break the WebMCP registry

The fallback may use:

```text
text prompt
   |
   v
generate_image
   |
   v
image_to_video
```

if the available capabilities support this chain.

---

# 25. ASYNCHRONOUS VIDEO JOBS

Never hold a Vercel request open indefinitely waiting for video generation.

Preferred:

```text
image_to_video
      |
      v
create job
      |
      v
return job ID
      |
      v
provider processes
      |
      v
poll/status/webhook
      |
      v
video ready
      |
      v
download
      |
      v
R2
      |
      v
Supabase
      |
      v
timeline
```

Persist generation jobs in Supabase.

---

# 26. GENERATION JOB TABLE

Minimum fields:

```text
id
project_id
scene_id
tool_name
provider
external_job_id
status
error
created_at
updated_at
```

Statuses:

```text
QUEUED
PROCESSING
DOWNLOADING
UPLOADING
COMPLETE
FAILED
FALLBACK
```

---

# 27. ARTIFACT MODEL

Every generated asset must have a database record.

Minimum conceptual fields:

```text
id
project_id
scene_id
type
provider
storage_key
mime_type
status
metadata
created_at
```

Examples:

```text
image
video
audio
caption
final_video
```

---

# 28. R2 ARTIFACT FLOW

For generated media:

```text
AI provider
    |
    v
temporary response
    |
    v
Vercel server
    |
    v
Cloudflare R2
    |
    v
artifact record
    |
    v
Supabase
```

Do not keep media permanently in Vercel.

---

# 29. COMPOSE VIDEO

Existing tool:

```text
compose_video
```

Requirements:

1. Read project/scenes from Supabase.
2. Resolve artifact references.
3. Retrieve required media from R2.
4. Compose the timeline.
5. Produce final MP4.
6. Upload final MP4 to R2.
7. Record final artifact in Supabase.
8. Return final artifact reference.

If composition requires temporary files, treat them as ephemeral.

Do not rely on persistent local filesystem storage.

---

# 30. HUMAN VETO

Existing tool:

```text
request_human_approval
```

This is a core product feature.

Flow:

```text
Production complete
        |
        v
request_human_approval
        |
        v
PENDING
        |
        v
Approval Modal
        |
        +---- APPROVE ---> continue
        |
        +---- REJECT ----> revise/replan
```

The decision must be durable.

Do not rely exclusively on an in-memory Promise or server process state because Vercel is serverless.

Use Supabase as the durable source of truth for the approval state.

The existing `waitForHumanDecision` user experience may remain, but the deployment-safe state model must persist the decision.

---

# 31. SCENE-LEVEL OVERRIDE

Existing tool:

```text
refine_scene
```

Human can:

* select scene
* enter instruction
* regenerate image
* regenerate video
* regenerate voice
* regenerate caption
* replace artifact
* continue production

Example:

```text
Scene 03

Human:
"Make the scene more cinematic and premium."

        |
        v
refine_scene
        |
        v
new artifact
        |
        v
R2
        |
        v
Supabase
        |
        v
timeline
        |
        v
QA
```

---

# 32. SUPABASE SCHEMA

Use the existing schema if already present.

Do not duplicate existing tables.

Conceptual minimum:

## projects

```text
id
name
prompt
status
created_at
updated_at
```

## scenes

```text
id
project_id
scene_number
prompt
status
duration
created_at
updated_at
```

## agents

```text
id
project_id
role
status
current_action
updated_at
```

## artifacts

```text
id
project_id
scene_id
type
storage_key
mime_type
provider
status
metadata
created_at
```

## tool_runs

```text
id
project_id
scene_id
tool_name
agent
status
input
output
error
created_at
```

## human_decisions

```text
id
project_id
scene_id
decision
instruction
created_at
```

## generation_jobs

```text
id
project_id
scene_id
tool_name
provider
external_job_id
status
error
created_at
updated_at
```

---

# 33. REALTIME

If Supabase Realtime already exists, preserve it.

Use it for:

* agent status
* artifact completion
* scene status
* approval state
* generation status
* timeline updates

Example:

```text
OpenAI generation completes
        |
        v
R2 upload
        |
        v
Supabase artifact insert
        |
        v
Realtime event
        |
        v
AURA timeline
        |
        v
artifact appears
```

Do not fake production events.

---

# 34. SECURITY

All secrets must remain server-side.

Vercel environment variables:

```text
OPENAI_API_KEY=
OPENAI_LLM_MODEL=

SPEECHIFY_API_KEY=

SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_PUBLIC_URL=
```

Never expose:

```text
OPENAI_API_KEY
SPEECHIFY_API_KEY
SUPABASE_SERVICE_ROLE_KEY
R2_SECRET_ACCESS_KEY
```

to browser code.

---

# 35. ENVIRONMENT CONFIGURATION

Create/update `.env.example` with placeholder values only.

Do not commit:

```text
.env
.env.local
production secrets
API keys
R2 secrets
```

---

# 36. COST CONTROL

This is a hackathon deployment.

Mandatory:

* Cache generated assets.
* Avoid duplicate OpenAI calls.
* Avoid duplicate Speechify calls.
* Reuse artifacts.
* Keep video durations short.
* Use appropriate demo resolution.
* Do not automatically regenerate unchanged scenes.
* Limit retries.
* Persist completed jobs.
* Return cached artifacts whenever possible.

Do not waste API credits during judge testing.

---

# 37. DEMO MODE

Support:

```text
AURA_DEMO_MODE=true
```

When enabled:

* prefer cached artifacts
* retain deterministic fallbacks
* avoid unnecessary API calls
* allow high-quality provider generation when explicitly requested
* maintain genuine WebMCP execution
* maintain genuine Human Veto

Demo mode must NOT fake the WebMCP workflow.

---

# 38. PROVIDER CONFIGURATION

Allow configuration through environment variables.

Example:

```text
OPENAI_LLM_MODEL=
OPENAI_IMAGE_MODEL=
OPENAI_VIDEO_MODEL=
```

Only use model identifiers confirmed to be supported.

If a configured model is invalid:

1. Log a clear server-side error.
2. Use fallback behavior where possible.
3. Do not crash the application.

---

# 39. ERROR HANDLING

Every external API operation requires:

* timeout
* structured error
* limited retry
* fallback where possible
* user-visible state
* persisted job state for asynchronous operations

Do not blindly retry expensive generation.

---

# 40. API FAILURE MATRIX

## OpenAI LLM failure

```text
LLM failure
    |
    v
controlled fallback
    |
    v
continue production if possible
```

## OpenAI image failure

```text
OpenAI image failure
    |
    v
deterministic image fallback
```

## OpenAI video failure

```text
OpenAI video failure
    |
    v
existing still-video fallback
```

## Speechify failure

```text
Speechify failure
    |
    v
existing TTS fallback
```

The entire production must not fail because one external provider failed.

---

# 41. PERFORMANCE

The application must feel alive during judging.

Show:

```text
QUEUED
GENERATING
PROCESSING
UPLOADING
COMPLETE
```

The UI must not appear frozen while AI generation is occurring.

Artifacts should appear as soon as they are available.

---

# 42. LOGGING

Log:

```text
project_id
scene_id
tool_name
agent
provider
job_id
status
duration
artifact_id
error
```

Never log:

* API keys
* secrets
* unnecessary sensitive information

---

# 43. TESTING

Before completion:

## Vercel

* [ ] Production build succeeds.
* [ ] Production deployment succeeds.
* [ ] Server-side environment variables resolve.
* [ ] No local filesystem persistence assumptions remain.

## Supabase

* [ ] Connection works.
* [ ] Projects persist.
* [ ] Scenes persist.
* [ ] Agents persist.
* [ ] Tool runs persist.
* [ ] Artifacts persist.
* [ ] Human decisions persist.
* [ ] Generation jobs persist.

## R2

* [ ] Image upload works.
* [ ] Audio upload works.
* [ ] Video upload works.
* [ ] Final MP4 upload works.
* [ ] Artifact retrieval works.

## OpenAI

* [ ] LLM call works.
* [ ] Image generation works.
* [ ] Video capability is explicitly verified before implementation.
* [ ] Invalid/missing model is handled safely.
* [ ] API failure triggers fallback.

## Speechify

* [ ] TTS call works.
* [ ] Audio is uploaded to R2.
* [ ] Audio metadata is stored.
* [ ] Failure triggers fallback.

## WebMCP

* [ ] All 14 tools register.
* [ ] All 14 tools execute.
* [ ] External agent can discover tools.
* [ ] Tool responses remain compatible.

## Human Veto

* [ ] Approval pauses production.
* [ ] Approval state persists.
* [ ] Approve continues.
* [ ] Reject triggers revision.
* [ ] Scene-level refinement works.

---

# 44. FULL END-TO-END TEST

Run:

```text
create_project
      ↓
generate_script
      ↓
create_storyboard
      ↓
generate_image × 5
      ↓
image_to_video
      ↓
text_to_speech
      ↓
write_caption
      ↓
compose_video
      ↓
review_video
      ↓
request_human_approval
      ↓
REJECT
      ↓
refine_scene
      ↓
image/video regeneration
      ↓
compose_video
      ↓
review_video
      ↓
request_human_approval
      ↓
APPROVE
      ↓
final MP4
      ↓
R2
```

The complete workflow must work on the deployed Vercel application.

---

# 45. DO NOT DO

Do NOT:

* replace WebMCP
* remove the 10 agents
* remove Human Veto
* replace Speechify
* add Fal
* add Hugging Face unless explicitly required later
* add another database
* add another primary object-storage provider
* move the application away from Vercel
* move structured state away from Supabase
* move media storage away from R2
* make OpenAI video a hard dependency without verifying current API availability
* invent OpenAI endpoints
* invent model names
* fake WebMCP execution
* fake Human Veto
* rewrite working tools unnecessarily
* introduce agent debates
* add unnecessary features before submission

---

# 46. IMPLEMENTATION ORDER

## Phase 1 — Inspect

Before changing code:

1. Inspect repository.
2. Identify current WebMCP registry.
3. Identify all 14 tools.
4. Identify current agent architecture.
5. Identify current database schema.
6. Identify current artifact model.
7. Identify current storage system.
8. Identify current Human Veto implementation.
9. Identify existing fallbacks.
10. Identify current deployment configuration.

Do not duplicate existing functionality.

---

## Phase 2 — Infrastructure

Verify:

```text
Vercel
Supabase
Cloudflare R2
```

connections.

Implement only missing pieces.

---

## Phase 3 — OpenAI LLM

Connect OpenAI to reasoning-heavy operations.

Prioritize:

```text
generate_script
create_storyboard
review_video
refine_scene
```

Do not rewrite the entire agent system.

---

## Phase 4 — OpenAI Image

Connect:

```text
generate_image
      ↓
OpenAI image API
      ↓
R2
      ↓
Supabase
```

Preserve deterministic fallback.

---

## Phase 5 — Speechify

Connect:

```text
text_to_speech
      ↓
Speechify
      ↓
R2
      ↓
Supabase
```

Preserve fallback.

---

## Phase 6 — OpenAI Video

FIRST verify the currently supported OpenAI video API/model.

Then connect:

```text
image_to_video
text_to_video
      ↓
OpenAI video capability
      ↓
async job
      ↓
R2
      ↓
Supabase
```

If unavailable:

```text
image_to_video
      ↓
existing fallback
```

Do not invent an implementation.

---

## Phase 7 — Cache

Implement/verify artifact caching.

---

## Phase 8 — Human Veto

Verify durable approval state.

---

## Phase 9 — WebMCP Regression

Run the full external-agent workflow.

---

## Phase 10 — Production Hardening

Test:

* missing OpenAI key
* invalid OpenAI model
* OpenAI timeout
* OpenAI image failure
* OpenAI video failure
* missing Speechify key
* Speechify timeout
* duplicate generation
* R2 failure
* Supabase failure
* page refresh
* Human Veto
* scene refinement
* final composition

---

# 47. ACCEPTANCE CRITERIA

The implementation is complete only when:

## Architecture

```text
Vercel
+
Supabase
+
Cloudflare R2
+
OpenAI
+
Speechify
```

works together.

## WebMCP

All 14 existing tools remain available.

## AI

OpenAI provides the LLM.

OpenAI provides image generation where supported.

OpenAI video generation is used only after verifying the currently supported API/model.

## Speech

Speechify remains the TTS provider.

## Storage

All generated media is persisted in R2.

## Database

All production metadata is persisted in Supabase.

## Reliability

Provider failures do not destroy the production workflow.

## Cost

Duplicate generation is cached.

## Human control

Human Veto remains real and durable.

## Deployment

The application works on Vercel without persistent local server state/filesystem assumptions.

---

# 48. FINAL PRODUCT PRINCIPLE

AURA is not simply:

> prompt → AI video

AURA is:

> **a WebMCP-native AI production studio where agents collaborate, produce inspectable artifacts, and humans remain in control.**

The underlying AI providers are replaceable.

The production workflow is the product.

Therefore the stable architecture is:

```text
                    WEBMCP
                       |
                       v
               AURA PRODUCTION
                       |
        +--------------+--------------+
        |              |              |
        v              v              v
     OpenAI        Speechify       Human
      LLM          Voiceover        Veto
        |              |              |
        +--------------+--------------+
                       |
                       v
                   ARTIFACTS
                       |
                       v
                Cloudflare R2
                       |
                       v
                  Supabase
                       |
                       v
                    VERCEL
                       |
                       v
                 FINAL VIDEO
```

The demo must communicate:

> **The AI agents do the production work. The human remains the executive producer.**

Do not sacrifice reliability for additional features.

# END OF SPECIFICATION
