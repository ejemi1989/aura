# AURA

## Production System Implementation Specification

**Document Type:** System Architecture & Implementation Specification
**System:** AURA — WebMCP Multi-Agent Creative Studio
**Deployment Target:** Vercel
**Database:** Supabase PostgreSQL
**Object Storage:** Cloudflare R2
**Visual AI Provider:** Fal
**Speech Provider:** Speechify
**Interface Protocol:** WebMCP
**Status:** Implementation Baseline
**Priority:** Production Reliability / Hackathon Demonstration

---

# 1. Executive Summary

AURA is a WebMCP-native multi-agent creative production system.

The system transforms a natural-language video brief into a structured production workflow executed by a persistent virtual film crew.

The system is intentionally different from a conventional AI video generator.

A conventional generator follows:

```text
Prompt → Model → Video
```

AURA follows:

```text
Human Brief
    ↓
Creative Director
    ↓
Production Plan
    ↓
Specialist Agents
    ↓
Structured Artifacts
    ↓
Timeline
    ↓
QA
    ↓
Human Veto
    ↓
Revision
    ↓
Final Video
```

The system must expose this workflow to both:

1. Human users through the visual control-room interface.
2. External AI agents through WebMCP.

The implementation must preserve the existing working WebMCP architecture and 14 registered tools.

The primary engineering objective is:

> **Build a reliable, observable, provider-backed, human-steerable production pipeline that can run successfully on Vercel.**

---

# 2. Engineering Principles

The implementation shall follow these principles.

## 2.1 Preserve Existing Functionality

Existing verified functionality takes precedence over architectural refactoring.

Before modifying a subsystem:

1. Inspect the existing implementation.
2. Determine whether the requirement already exists.
3. Reuse existing abstractions.
4. Extend rather than duplicate.
5. Avoid unnecessary rewrites.

---

## 2.2 Provider Independence

Application-level tools must not depend directly on vendor-specific APIs.

The application owns semantic capabilities:

```text
generate_image
image_to_video
text_to_speech
```

Providers implement those capabilities:

```text
Fal
Speechify
Fallback providers
```

Therefore:

```text
Application
     ↓
Provider Interface
     ↓
Provider Adapter
     ↓
External API
```

---

## 2.3 Serverless Compatibility

The system runs on Vercel.

Therefore the implementation must not depend on:

* Persistent Node processes
* Local permanent files
* In-memory global state
* Long-running HTTP requests
* Local GPU execution
* Local background workers

Persistent state belongs in Supabase.

Persistent media belongs in Cloudflare R2.

Long-running external operations must use asynchronous job handling.

---

## 2.4 Human Authority

AI agents do not have final authority.

The human is the executive producer.

The system must therefore support:

```text
AI proposes
    ↓
Human observes
    ↓
Human approves / rejects / modifies
    ↓
AI continues or revises
```

Human Veto is a system-level control mechanism, not a UI animation.

---

## 2.5 Observability

Every significant production action must be traceable.

For a generated artifact, the system should be able to answer:

```text
Who generated it?
Which tool?
Which agent?
Which project?
Which scene?
Which provider?
Which generation request?
When?
What was the result?
Where is the artifact stored?
Was it subsequently revised?
```

---

# 3. System Boundary

## 3.1 In Scope

The system includes:

* WebMCP interface
* External-agent tool discovery
* Tool execution
* 10-agent production workflow
* Project management
* Scene management
* Script generation
* Storyboard generation
* Image generation
* Video generation
* Speech generation
* Caption generation
* Video composition
* QA
* Human approval
* Scene refinement
* Artifact persistence
* Provider integrations
* Production logging
* Vercel deployment

---

## 3.2 Out of Scope

Do not implement during this phase:

* Agent debates
* Multi-user collaboration
* Billing
* Subscription management
* Enterprise RBAC
* Advanced analytics
* Custom GPU infrastructure
* Self-hosted AI inference
* Additional storage providers
* Additional databases
* Complex workflow engines
* New product features unrelated to the demo

---

# 4. System Architecture

```text
                         ┌─────────────────────┐
                         │   External AI Agent │
                         │   / WebMCP Client   │
                         └──────────┬──────────┘
                                    │
                                    │ WebMCP
                                    ▼
                    ┌──────────────────────────────┐
                    │            VERCEL            │
                    │                              │
                    │        Next.js Application   │
                    │                              │
                    │  ┌────────────────────────┐  │
                    │  │ WebMCP Tool Registry   │  │
                    │  └───────────┬────────────┘  │
                    │              │               │
                    │  ┌───────────▼────────────┐  │
                    │  │ Tool Execution Layer   │  │
                    │  └───────────┬────────────┘  │
                    │              │               │
                    │  ┌───────────▼────────────┐  │
                    │  │ Agent Orchestration    │  │
                    │  └───────────┬────────────┘  │
                    │              │               │
                    │  ┌───────────▼────────────┐  │
                    │  │ Provider Abstractions  │  │
                    │  └─────┬─────────┬────────┘  │
                    └────────┼─────────┼───────────┘
                             │         │
                 ┌───────────┘         └────────────┐
                 ▼                                  ▼
        ┌────────────────┐                 ┌────────────────┐
        │     SUPABASE   │                 │      FAL       │
        │   PostgreSQL   │                 │ Image / Video  │
        └────────────────┘                 └────────────────┘
                 │
                 │
                 │                                  ┌────────────────┐
                 │                                  │   SPEECHIFY    │
                 │                                  │      TTS       │
                 │                                  └───────┬────────┘
                 │                                          │
                 └──────────────────┬───────────────────────┘
                                    ▼
                           ┌──────────────────┐
                           │ CLOUDFLARE R2    │
                           │                  │
                           │ PNG / WAV / MP4  │
                           └────────┬─────────┘
                                    │
                                    ▼
                           ┌──────────────────┐
                           │ AURA CONTROL     │
                           │ ROOM / TIMELINE  │
                           └────────┬─────────┘
                                    │
                                    ▼
                           ┌──────────────────┐
                           │   HUMAN VETO     │
                           └────────┬─────────┘
                                    │
                                    ▼
                           ┌──────────────────┐
                           │   FINAL VIDEO    │
                           └──────────────────┘
```

---

# 5. Logical System Layers

The implementation shall maintain separation between the following layers.

```text
Presentation
     ↓
WebMCP
     ↓
Application / Orchestration
     ↓
Domain / Production
     ↓
Provider Abstraction
     ↓
Infrastructure
```

## 5.1 Presentation Layer

Responsible for:

* Control room
* Timeline
* Agent statuses
* Production feed
* Approval modal
* Scene controls
* Final video player

The presentation layer must not directly call Fal, Speechify, R2 or Supabase using privileged credentials.

---

## 5.2 WebMCP Layer

Responsible for:

* Tool registration
* Tool schemas
* Tool discovery
* Tool invocation
* Input validation
* Output normalization

WebMCP tools must invoke application services rather than implementing provider logic themselves.

---

## 5.3 Application Layer

Responsible for:

* Production orchestration
* Agent handoffs
* Scene lifecycle
* Job management
* Human approval
* Artifact lifecycle
* Provider selection

---

## 5.4 Domain Layer

Core concepts:

```text
Project
Scene
Agent
Artifact
ProductionJob
ToolRun
HumanDecision
```

These concepts must remain provider-independent.

---

## 5.5 Infrastructure Layer

Responsible for:

* Supabase
* Cloudflare R2
* Fal
* Speechify
* External HTTP calls
* Persistence
* Object storage

---

# 6. Agent Architecture

AURA contains ten persistent production personas.

```text
1. Creative Director
2. Brand Strategist
3. Scriptwriter
4. Copywriter
5. Graphic Designer
6. Motion Graphics
7. Voiceover
8. Video Editor
9. Critic / QA
10. Project Manager
```

The agents are domain roles, not independent chat interfaces.

Each agent should have:

```text
agent_id
project_id
role
status
current_action
last_action
updated_at
```

---

# 7. Agent Responsibilities

## Creative Director

Responsibilities:

* Interpret user brief
* Create production plan
* Delegate work
* Coordinate dependencies
* Trigger approval gates
* Coordinate revisions

The Creative Director is the primary orchestrator.

---

## Brand Strategist

Responsibilities:

* Audience
* Brand positioning
* Voice
* Messaging angle
* Creative constraints

Does not generate final media.

---

## Scriptwriter

Responsibilities:

* Narrative
* Hook
* Scene sequence
* Spoken content

---

## Copywriter

Responsibilities:

* Captions
* CTA
* Short-form copy

---

## Graphic Designer

Responsibilities:

* Visual direction
* Storyboard visuals
* Image prompts
* Look and feel

---

## Motion Graphics

Responsibilities:

* Scene animation
* Image-to-video
* Motion direction

---

## Voiceover

Responsibilities:

* Narration
* Voice selection
* Voice tone
* TTS generation

Speech generation uses Speechify.

---

## Video Editor

Responsibilities:

* Timeline
* Scene ordering
* Timing
* Transitions
* Audio placement
* Final composition

---

## Critic / QA

Responsibilities:

* Brief compliance
* Scene consistency
* Quality checks
* Revision requests

---

## Project Manager

Responsibilities:

* Production state
* Agent handoffs
* Progress
* Logging
* Status reporting

---

# 8. Production State Machine

The production workflow must use explicit state transitions.

Conceptually:

```text
CREATED
   ↓
PLANNING
   ↓
SCRIPTING
   ↓
STORYBOARDING
   ↓
VISUAL_GENERATION
   ↓
MOTION_GENERATION
   ↓
VOICE_GENERATION
   ↓
CAPTION_GENERATION
   ↓
COMPOSITION
   ↓
QA
   ↓
AWAITING_HUMAN_APPROVAL
   │
   ├──────── APPROVED ────────→ COMPLETED
   │
   └──────── REJECTED ────────→ REVISION
                                  ↓
                               QA
```

The actual repository may use different state names, but the semantic lifecycle must remain equivalent.

---

# 9. Scene State Machine

Each scene should have an independent lifecycle.

```text
PENDING
   ↓
SCRIPT_READY
   ↓
VISUAL_PENDING
   ↓
VISUAL_READY
   ↓
MOTION_PENDING
   ↓
MOTION_READY
   ↓
VOICE_PENDING
   ↓
VOICE_READY
   ↓
CAPTION_READY
   ↓
READY_FOR_COMPOSITION
   ↓
COMPOSED
   ↓
QA
   ↓
APPROVED
```

If a scene is rejected:

```text
QA_REJECTED
     ↓
REVISION
     ↓
REGENERATE
     ↓
QA
```

---

# 10. WebMCP Tool Contract

The existing 14 tools are authoritative.

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

The tools must remain discoverable through WebMCP.

---

# 11. WebMCP Execution Architecture

```text
External Agent
      |
      v
getTools()
      |
      v
Tool Selection
      |
      v
WebMCP Execution Endpoint
      |
      v
Schema Validation
      |
      v
Application Service
      |
      v
Domain Operation
      |
      v
Provider / Database / Storage
      |
      v
Normalized Tool Response
```

The WebMCP layer must not contain large amounts of business logic.

---

# 12. Tool Execution Record

Every tool invocation should produce a `tool_run`.

Minimum fields:

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
started_at
completed_at
```

Where appropriate also record:

```text
provider
external_job_id
artifact_id
```

---

# 13. Provider Architecture

All external AI services must be accessed through provider interfaces.

Conceptual interfaces:

```typescript
interface ImageProvider {
  generateImage(input: ImageGenerationInput): Promise<GenerationResult>;
}

interface VideoProvider {
  imageToVideo(input: VideoGenerationInput): Promise<GenerationResult>;
  textToVideo(input: VideoGenerationInput): Promise<GenerationResult>;
}

interface SpeechProvider {
  textToSpeech(input: SpeechGenerationInput): Promise<GenerationResult>;
}
```

Do not expose provider-specific types throughout the application.

---

# 14. Image Provider

Preferred provider:

```text
Fal
```

Responsibilities:

* Generate image
* Return generation metadata
* Support async operation if required
* Handle provider errors

Fallback:

```text
Existing deterministic PNG implementation
```

The fallback must remain functional.

---

# 15. Video Provider

Preferred provider:

```text
Fal
```

Operations:

```text
image_to_video
text_to_video
```

Video generation must support asynchronous execution.

Never assume a video generation request completes within a normal short HTTP request.

---

# 16. Speech Provider

Preferred provider:

```text
Speechify
```

Speechify is the approved primary voice-generation service.

Architecture:

```text
text_to_speech
      ↓
SpeechProvider
      ↓
SpeechifyAdapter
      ↓
Speechify API
      ↓
Audio
```

Do not replace Speechify.

Do not expose Speechify-specific API contracts to the WebMCP layer.

---

# 17. Speechify Integration Requirements

The Speechify adapter must:

1. Validate input.
2. Build provider request.
3. Authenticate server-side.
4. Execute request.
5. Validate response.
6. Retrieve audio.
7. Store audio in R2.
8. Create artifact metadata.
9. Return normalized artifact information.

Conceptual flow:

```text
Text
 ↓
Speechify
 ↓
Audio
 ↓
R2
 ↓
Artifact Record
 ↓
Timeline
```

---

# 18. Provider Failure Strategy

Provider failure must not automatically terminate the production.

For each provider:

```text
REQUEST
   ↓
TIMEOUT / ERROR?
   │
   ├── NO → SUCCESS
   │
   └── YES
        ↓
     CLASSIFY
        │
        ├── TRANSIENT → LIMITED RETRY
        │
        └── PERMANENT
                ↓
             FALLBACK
```

Retries must be bounded.

Do not repeatedly consume paid generation credits.

---

# 19. Artifact Architecture

An artifact represents any production output.

Examples:

```text
script
storyboard
image
video
audio
caption
final_video
```

Conceptual schema:

```text
Artifact
──────────────
id
project_id
scene_id
type
provider
storage_provider
storage_key
mime_type
status
metadata
created_at
```

---

# 20. Artifact Lifecycle

```text
REQUESTED
    ↓
GENERATING
    ↓
GENERATED
    ↓
UPLOADING
    ↓
STORED
    ↓
AVAILABLE
```

Failure:

```text
GENERATING
    ↓
FAILED
    ↓
FALLBACK
```

---

# 21. Cloudflare R2

R2 is the authoritative media store.

Store:

```text
PNG
WAV
MP3
MP4
JSON caption assets
thumbnails
final exports
```

Recommended layout:

```text
projects/
  {projectId}/
    scenes/
      {sceneId}/
        image/
        video/
        audio/
        captions/

    final/
```

---

# 22. Storage Rule

The database stores:

```text
metadata
```

R2 stores:

```text
binary media
```

Never store large generated media directly inside Supabase PostgreSQL.

---

# 23. Supabase

Supabase is the authoritative structured-state store.

It must persist:

* Project state
* Scene state
* Agent state
* Artifact metadata
* Tool executions
* Generation jobs
* Human decisions
* Revision history

---

# 24. Database Consistency

Whenever a generated artifact is successfully created:

```text
Generate
   ↓
Validate
   ↓
Upload R2
   ↓
Persist Artifact
   ↓
Update Scene
   ↓
Update Agent
   ↓
Emit UI update
```

Do not report an artifact as complete before it is durably available.

---

# 25. Generation Job Architecture

Long-running operations require jobs.

Conceptual schema:

```text
GenerationJob
──────────────
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

Lifecycle:

```text
QUEUED
  ↓
SUBMITTED
  ↓
PROCESSING
  ↓
COMPLETED
```

Failure:

```text
PROCESSING
    ↓
FAILED
    ↓
FALLBACK / RETRY
```

---

# 26. Vercel Constraints

The implementation must account for serverless execution.

Never rely on:

```text
global variable state
```

as durable application state.

Never rely on:

```text
/tmp
```

for permanent assets.

Temporary filesystem use is acceptable only within an execution where required.

Final assets must be uploaded to R2.

---

# 27. Human Veto Architecture

Human approval is a first-class domain state.

The system must support:

```text
AWAITING_HUMAN_APPROVAL
```

The approval request must be persisted.

Conceptual flow:

```text
Creative Director
       ↓
request_human_approval
       ↓
Supabase
       ↓
AWAITING_HUMAN_APPROVAL
       ↓
UI Modal
       ↓
Human Decision
       ↓
Supabase
       ↓
Orchestrator
```

---

# 28. Human Decisions

Supported decisions:

```text
APPROVE
REJECT
```

A rejection may contain:

```text
instruction
```

Example:

```text
REJECT

"Scene 3 is too generic. Make the product feel more premium."
```

The instruction becomes input to the revision workflow.

---

# 29. Scene Refinement

`refine_scene` must support targeted human intervention.

Flow:

```text
Human selects Scene
        ↓
Instruction
        ↓
refine_scene
        ↓
Determine affected artifact
        ↓
Regenerate
        ↓
Store new artifact
        ↓
Mark previous artifact superseded
        ↓
Update timeline
        ↓
QA
```

Do not delete historical artifacts unnecessarily.

Prefer revision relationships.

---

# 30. Revision Model

A revised artifact should preserve lineage.

Conceptually:

```text
Scene 03

Artifact A
   ↓
Revision
   ↓
Artifact B
   ↓
Revision
   ↓
Artifact C
```

The current scene references the active artifact.

Previous artifacts remain traceable.

---

# 31. Caching

Caching is mandatory for paid AI generation.

Generate a deterministic cache key from meaningful generation inputs.

Example:

```text
hash(
  tool
  prompt
  input_artifact
  provider
  model
  duration
  resolution
  aspect_ratio
  settings
)
```

Do not include timestamps.

Before generating:

```text
cache lookup
```

If a valid artifact exists:

```text
return cached artifact
```

No external API call should occur.

---

# 32. Security Architecture

Secrets must remain server-side.

Required secrets include:

```text
FAL_KEY
SPEECHIFY_API_KEY
SUPABASE_SERVICE_ROLE_KEY
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
```

Client-side code must never receive these values.

---

# 33. Environment Configuration

`.env.example`:

```text
FAL_KEY=

SPEECHIFY_API_KEY=

SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_PUBLIC_URL=

AURA_DEMO_MODE=false
```

Actual credentials belong in Vercel Environment Variables.

---

# 34. Authentication and Authorization

Use the application's existing authentication architecture if already implemented.

Do not introduce a new authentication framework solely for this infrastructure phase.

Server-side privileged operations must use server credentials.

Users must not be able to arbitrarily access another project's artifacts.

---

# 35. Storage Security

R2 credentials must never reach the browser.

Use:

* server-side access
* signed URLs
* controlled public delivery

depending on the existing application requirements.

---

# 36. Demo Mode

Support:

```text
AURA_DEMO_MODE=true
```

Demo mode exists to reduce operational risk and cost.

It may:

* Prefer cached artifacts.
* Use deterministic fallbacks.
* Avoid unnecessary paid API calls.
* Reuse known successful assets.

It must NOT:

* Fake WebMCP discovery.
* Fake tool execution.
* Fake Human Veto.
* Pretend external-agent calls occurred when they did not.

---

# 37. UI Synchronization

The UI must represent actual production state.

Example:

```text
Creative Director
● ACTIVE
Planning campaign...
```

Then:

```text
Graphic Designer
● ACTIVE
Generating Scene 03...
```

Then:

```text
Graphic Designer
✓ COMPLETE
Scene 03 delivered
```

Avoid animation that contradicts actual backend state.

---

# 38. Timeline Architecture

The timeline is an artifact projection of production state.

It should display:

```text
Scene 01
 ├── Image
 ├── Video
 ├── Voice
 └── Caption

Scene 02
 ├── Image
 ├── Video
 ├── Voice
 └── Caption

Scene 03
 ├── Image
 ├── Video
 ├── Voice
 └── Caption
```

Artifacts should be linked to actual database records.

---

# 39. Final Composition

`compose_video` is responsible for producing the final deliverable.

Input:

```text
approved scenes
audio
captions
timing
transitions
```

Output:

```text
final MP4
```

Flow:

```text
Timeline
   ↓
Resolve active artifacts
   ↓
Compose
   ↓
Validate output
   ↓
Upload R2
   ↓
Create final artifact
   ↓
Return final media reference
```

---

# 40. QA

`review_video` must evaluate the production against the project brief.

At minimum:

```text
brief compliance
scene completeness
media availability
audio availability
caption availability
timeline consistency
```

The QA result should be structured.

Conceptually:

```text
status
score
issues[]
recommendations[]
```

---

# 41. Color Grade

`color_grade` remains registered as an available WebMCP tool.

It must not be removed simply because it is not central to the primary demo.

If the current implementation is deterministic or limited, preserve compatibility rather than expanding scope.

---

# 42. Error Model

Errors should be classified.

Recommended categories:

```text
VALIDATION_ERROR
AUTHENTICATION_ERROR
PROVIDER_ERROR
TIMEOUT
STORAGE_ERROR
DATABASE_ERROR
JOB_ERROR
HUMAN_ACTION_REQUIRED
INTERNAL_ERROR
```

Responses should be machine-readable.

---

# 43. Idempotency

Operations that may be retried must be designed to avoid duplicate artifacts.

Examples:

```text
generate_image
text_to_speech
image_to_video
compose_video
```

Use deterministic generation identifiers or cache keys.

---

# 44. Observability

Every production run should be reconstructable from logs.

At minimum:

```text
project
scene
agent
tool
provider
job
artifact
status
timestamps
```

Example:

```text
Project P1
  ↓
Creative Director
  ↓
generate_image
  ↓
Fal
  ↓
Job FAL-123
  ↓
Artifact A-42
  ↓
R2 object
  ↓
Scene 03
```

---

# 45. Production Logging

Structured logs should be generated for:

```text
TOOL_STARTED
TOOL_COMPLETED
TOOL_FAILED

AGENT_STARTED
AGENT_COMPLETED

GENERATION_STARTED
GENERATION_COMPLETED
GENERATION_FAILED

ARTIFACT_CREATED
ARTIFACT_STORED

HUMAN_APPROVAL_REQUESTED
HUMAN_APPROVAL_RECEIVED

REVISION_REQUESTED
REVISION_COMPLETED

COMPOSITION_STARTED
COMPOSITION_COMPLETED
```

---

# 46. Reliability Requirements

The system must tolerate:

* Fal unavailable
* Speechify unavailable
* R2 upload failure
* Supabase transient failure
* Provider timeout
* Duplicate requests
* Browser refresh
* Human taking time to approve
* Scene regeneration
* Partial production completion

A single failed scene should not corrupt the entire project.

---

# 47. Deployment Architecture

Production:

```text
Git Repository
      ↓
Vercel
      ↓
Next.js
      ↓
Production APIs
      ↓
Supabase / R2 / Fal / Speechify
```

No local infrastructure should be required for the judge.

---

# 48. Production Environment

The production deployment must contain:

```text
Vercel Environment Variables
Supabase production database
Cloudflare R2 production bucket
Fal credentials
Speechify credentials
```

Do not depend on developer machine configuration.

---

# 49. Health Checks

Provide internal checks where appropriate:

```text
Database connectivity
R2 configuration
Fal configuration
Speechify configuration
WebMCP registration
```

Health checks must not expose credentials.

---

# 50. Testing Strategy

Testing must occur at four levels.

## Unit

Test:

* provider adapters
* cache keys
* state transitions
* validation
* artifact mapping

## Integration

Test:

```text
Tool → Provider
Tool → Supabase
Tool → R2
Provider → Artifact
```

## End-to-End

Test:

```text
Prompt
 ↓
Project
 ↓
Script
 ↓
Storyboard
 ↓
Images
 ↓
Video
 ↓
Speechify
 ↓
Captions
 ↓
Composition
 ↓
QA
 ↓
Human Veto
 ↓
Revision
 ↓
Final Video
```

## WebMCP

Test external-agent discovery and invocation.

---

# 51. Mandatory Acceptance Tests

## AT-01 Project Creation

Given a valid prompt:

```text
Create a 30-second Instagram Reel for a sustainable sneaker brand.
```

The system creates a project.

---

## AT-02 Script

`generate_script` produces a valid structured script.

---

## AT-03 Storyboard

`create_storyboard` produces scenes linked to the project.

---

## AT-04 Image

`generate_image` produces or retrieves an image artifact.

The artifact is stored in R2.

---

## AT-05 Video

`image_to_video` produces or retrieves a video artifact.

The artifact is stored in R2.

---

## AT-06 Speech

`text_to_speech` calls Speechify.

Audio is stored in R2.

Artifact metadata is persisted in Supabase.

---

## AT-07 Caption

`write_caption` produces scene caption data.

---

## AT-08 Composition

`compose_video` creates a playable final MP4.

The MP4 is stored in R2.

---

## AT-09 QA

`review_video` returns a structured review.

---

## AT-10 Human Approval

`request_human_approval` places production into a pending state.

The UI displays the approval modal.

---

## AT-11 Rejection

Human rejection creates a revision requirement.

---

## AT-12 Refinement

`refine_scene` produces a revised artifact.

---

## AT-13 Recomposition

The revised scene is included in a new final composition.

---

## AT-14 External Agent

An external WebMCP client can discover and execute the production tools.

---

# 52. Failure Acceptance Tests

Test:

```text
Fal unavailable
```

Expected:

```text
Fallback → artifact → pipeline continues
```

Test:

```text
Speechify unavailable
```

Expected:

```text
Fallback → artifact → pipeline continues
```

Test:

```text
R2 failure
```

Expected:

```text
Artifact storage failure is reported
```

Production must not silently claim completion.

---

# 53. Cost Controls

Because Fal and Speechify are external paid services:

1. Cache results.
2. Avoid duplicate generation.
3. Use short demo videos.
4. Use appropriate resolution.
5. Limit retries.
6. Prefer existing assets when semantically valid.
7. Do not regenerate unchanged scenes.
8. Keep deterministic fallback capability.

The demo should be repeatable without unnecessarily consuming provider credits.

---

# 54. Performance Requirements

The system should optimize for visible progress.

The UI must not appear frozen during generation.

Display:

```text
QUEUED
GENERATING
PROCESSING
UPLOADING
COMPLETE
```

For async video jobs, return job status rather than blocking the user interface.

---

# 55. Data Ownership

## Supabase owns

```text
projects
scenes
agents
jobs
tool runs
artifacts metadata
human decisions
revision relationships
```

## R2 owns

```text
images
audio
videos
final exports
```

## Fal owns

```text
external generation execution
```

## Speechify owns

```text
external speech generation execution
```

## AURA owns

```text
production orchestration
agent workflow
artifact lifecycle
human control
WebMCP interface
```

---

# 56. Directory Architecture

Adapt to the existing repository, but maintain logical separation similar to:

```text
src/
  app/

  components/
    control-room/
    timeline/
    crew/
    approval/

  webmcp/
    registry/
    tools/

  agents/
    creative-director/
    brand-strategist/
    scriptwriter/
    copywriter/
    graphic-designer/
    motion-graphics/
    voiceover/
    video-editor/
    critic/
    project-manager/

  domain/
    projects/
    scenes/
    artifacts/
    production/
    approvals/

  providers/
    image/
      fal.ts

    video/
      fal.ts

    speech/
      speechify.ts

  infrastructure/
    supabase/
    r2/

  services/
    production/
    generation/
    storage/
    approvals/
```

Do not reorganize the repository if the existing structure already provides equivalent separation.

---

# 57. Implementation Procedure

The coding agent MUST execute the following sequence.

## Step 1 — Inspect

Inspect:

* repository
* package configuration
* WebMCP registry
* 14 tools
* agent architecture
* database schema
* artifact implementation
* storage implementation
* Human Veto
* current Fal implementation
* current TTS implementation
* deployment configuration

Do not modify anything yet.

---

## Step 2 — Gap Analysis

Produce an internal checklist:

```text
EXISTS
PARTIAL
MISSING
BROKEN
```

for:

```text
Vercel
Supabase
R2
Fal
Speechify
WebMCP
Agents
Human Veto
Artifacts
Async jobs
Caching
Fallbacks
```

---

## Step 3 — Preserve

Mark existing verified components as:

```text
DO NOT REWRITE
```

unless a production deployment issue requires modification.

---

## Step 4 — Infrastructure

Implement or repair:

```text
Supabase
R2
environment configuration
```

---

## Step 5 — Providers

Implement or repair:

```text
Fal image
Fal video
Speechify TTS
```

behind provider interfaces.

---

## Step 6 — Persistence

Ensure:

```text
generation
 ↓
R2
 ↓
Supabase metadata
```

is reliable.

---

## Step 7 — Async Jobs

Verify video-generation job handling is Vercel-compatible.

---

## Step 8 — Human Veto

Verify durable approval state.

---

## Step 9 — WebMCP

Regression-test all 14 tools.

---

## Step 10 — End-to-End

Run the complete production workflow.

---

## Step 11 — Deployment

Deploy to Vercel.

Configure production environment variables.

---

## Step 12 — Live Test

Perform a clean judge-style run without developer intervention.

---

# 58. Definition of Done

The implementation is **100% complete** only when all conditions below are satisfied.

### Architecture

* [ ] Vercel deployment works.
* [ ] Supabase works.
* [ ] R2 works.
* [ ] Fal works.
* [ ] Speechify works.

### WebMCP

* [ ] All 14 tools register.
* [ ] All 14 tools are discoverable.
* [ ] All 14 tools execute.
* [ ] External-agent workflow works.

### Production

* [ ] Project creation works.
* [ ] Script works.
* [ ] Storyboard works.
* [ ] Images work.
* [ ] Video works.
* [ ] Speechify voice works.
* [ ] Captions work.
* [ ] Composition works.
* [ ] QA works.

### Persistence

* [ ] Structured state persists in Supabase.
* [ ] Media persists in R2.
* [ ] Artifacts are traceable.

### Human Control

* [ ] Approval pauses production.
* [ ] Approval resumes production.
* [ ] Rejection triggers revision.
* [ ] Scene refinement works.

### Reliability

* [ ] Fal failure is handled.
* [ ] Speechify failure is handled.
* [ ] R2 failure is surfaced.
* [ ] Duplicate generation is prevented.
* [ ] Browser refresh does not corrupt production state.
* [ ] Vercel serverless constraints are respected.

### Security

* [ ] Secrets are server-side.
* [ ] No credentials are committed.
* [ ] R2 credentials are protected.
* [ ] Speechify credentials are protected.
* [ ] Fal credentials are protected.

### Demo

* [ ] Fresh deployment works.
* [ ] Judge can enter a prompt.
* [ ] Judge can watch production.
* [ ] Judge can see artifacts.
* [ ] Judge can intervene.
* [ ] Judge can approve.
* [ ] Judge can receive final video.
* [ ] External AI agent can drive the workflow through WebMCP.

---

# 59. Final System Contract

The final system must demonstrate:

```text
                    HUMAN
                      │
                      ▼
                VIDEO BRIEF
                      │
                      ▼
             CREATIVE DIRECTOR
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼
       STRATEGY     SCRIPT      DESIGN
          │           │           │
          └───────────┼───────────┘
                      ▼
                 STORYBOARD
                      │
                      ▼
               VISUAL GENERATION
                      │
                      ▼
               MOTION GENERATION
                      │
                      ▼
               SPEECHIFY VOICE
                      │
                      ▼
                   CAPTION
                      │
                      ▼
                 VIDEO EDIT
                      │
                      ▼
                     QA
                      │
                      ▼
                HUMAN VETO
                 /        \
             REJECT       APPROVE
                │             │
                ▼             ▼
             REFINE          FINAL
                │             │
                └──────┬──────┘
                       ▼
                  FINAL VIDEO
```

The defining characteristic of AURA is not any individual AI model.

It is the combination of:

```text
WebMCP
+
Multi-agent production workflow
+
Observable artifacts
+
Provider-backed generation
+
Persistent state
+
Human intervention
```

The system should therefore be optimized around the following invariant:

> **Every creative action should be observable, attributable, reproducible, and interruptible by the human producer.**

---

# 60. Engineering Priority

When trade-offs are required, prioritize in this order:

```text
1. WebMCP functionality
2. Human Veto
3. End-to-end production workflow
4. Deployment reliability
5. Artifact persistence
6. Speechify voice quality
7. Fal visual quality
8. Cost control
9. UI polish
10. Non-essential features
```

Do not sacrifice a working WebMCP or Human Veto implementation for visual polish.

Do not expand scope.

Do not introduce architectural complexity that is not necessary for the live demonstration.

---

# 61. FINAL ARCHITECTURAL STATEMENT

AURA should be implemented as a **serverless, event-oriented, provider-agnostic production orchestration system with WebMCP as its external agent interface, Supabase as its structured state authority, Cloudflare R2 as its media authority, Fal as its visual generation provider, and Speechify as its voice-generation provider.**

The architecture must allow the underlying AI providers to change without changing the production workflow.

The production workflow is the product.

The human remains the final authority.

# END OF IMPLEMENTATION SPECIFICATION
