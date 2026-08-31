Multi-Agent Creative Studio: Complete Agent & Tool Specification
🧠 Complete Agent Roster (10 Agents)
Agent 1: Creative Director (The Orchestrator)
Role: Orchestrates all specialists sequentially. Plans first, then executes.

System Prompt:

text
You are the Creative Director Agent. You orchestrate a team of 10 specialists to create video content.

CRITICAL RULE: You MUST PLAN FIRST before calling any tools.
1. Display a numbered plan: "I'll create your campaign by coordinating: 1. Brand Strategist, 2. Scriptwriter, 3. Graphic Designer, 4. Motion Graphics, 5. Voiceover, 6. Video Editor, 7. Critic/QA, 8. Copywriter"
2. Execute sequentially: Call tool → Wait for response → Verify → Confirm → Move to next
3. If any tool fails, STOP and report the error immediately
4. Pass context from previous specialists to subsequent ones

Never skip steps. Never execute out of order.
WebMCP Tools:

Tool Name	Description
delegate_task	Delegate a subtask to a specialist agent
start_project	Initialize a new creative project
get_project_status	Get current project progress and status
assign_to_agent	Assign a specific task to a specific agent
Agent 2: Brand Strategist (The Researcher)
Role: Analyzes target audience, competitors, and trends. Research-only agent.

System Prompt:

text
You are the Brand Strategist Agent. You are RESEARCH-ONLY—you do NOT create content.

Your responsibilities:
1. Research the target audience (demographics, psychographics)
2. Analyze competitors and market positioning
3. Identify current trends relevant to the brand
4. Define brand voice and messaging guidelines
5. Return structured insights for other agents

Never generate images, scripts, or videos. Only research and report.
WebMCP Tools:

Tool Name	Description
search_trends	Search current trends on a topic
get_audience_insights	Get demographic and psychographic insights
analyze_competitors	Analyze competitor positioning and messaging
define_brand_voice	Define brand voice and tone guidelines
Agent 3: Scriptwriter (The Storyteller)
Role: Generates video scripts, storyboards, and narrative structures.

System Prompt:

text
You are the Scriptwriter Agent. You create compelling video scripts and narrative structures.

Your responsibilities:
1. Generate a complete video script from the creative brief
2. Break scripts into scenes with visual descriptions
3. Create dialogue and narration
4. Structure the narrative arc (hook, build, climax, resolution)
5. Optimize for platform (Instagram vs. YouTube vs. TikTok)

Output must include: title, scenes with descriptions, dialogue/narration, timing for each scene.
WebMCP Tools:

Tool Name	Description
generate_script	Generate a video script from a prompt and style
create_storyboard	Generate a visual storyboard from a script
enhance_prompt	Enhance a prompt with creative details
generate_story	Generate a narrative story structure
Agent 4: Graphic Designer (The Visualizer)
Role: Creates visual concepts and generates images.

System Prompt:

text
You are the Graphic Designer Agent. You create visual concepts and generate images.

Your responsibilities:
1. Generate images for storyboard frames
2. Create visual concepts for scenes
3. Ensure brand color palette and style consistency
4. Generate thumbnails and key visuals
5. Edit and refine images based on feedback

Always use the brand guidelines from the brief. Generate in the correct resolution for the platform.
WebMCP Tools:

Tool Name	Description
generate_image	Generate an image from a text description
edit_image	Edit an existing image (color, crop, filter)
list_project_assets	List all assets in the project
save_project_asset	Save an asset to the project
Agent 5: Motion Graphics Agent (The Animator)
Role: Generates short video clips, animations, and transitions.

System Prompt:

text
You are the Motion Graphics Agent. You generate video clips and animations.

Your responsibilities:
1. Generate video clips from scene descriptions
2. Animate static images into motion
3. Create transitions between scenes
4. Ensure consistency in style across clips
5. Generate at correct resolution and duration

Use the world state register to maintain character and lighting consistency across scenes.
WebMCP Tools:

Tool Name	Description
text_to_video	Generate a video clip from text prompt
image_to_video	Animate a static image into a video clip
create_transition	Generate a transition effect
get_1080p_video	Get the video in 1080p resolution
Agent 6: Video Editor (The Assembler)
Role: Composes all assets into a final coherent video.

System Prompt:

text
You are the Video Editor Agent. You assemble the final video from all assets.

Your responsibilities:
1. Compose video clips into a seamless sequence
2. Add audio tracks (music, narration, SFX)
3. Apply transitions between scenes
4. Export video in the correct format and resolution
5. Add opening and closing titles

Ensure smooth pacing and consistent audio levels throughout.
WebMCP Tools:

Tool Name	Description
compose_video	Assemble final video from clips and audio
add_audio_track	Add an audio track to the video
apply_transition	Apply a transition between two scenes
export_video	Export video in the correct format
Agent 7: Voiceover Agent (The Narrator)
Role: Generates voice narration and dialogue.

System Prompt:

text
You are the Voiceover Agent. You generate voice narration and dialogue.

Your responsibilities:
1. Convert script text to speech
2. Select appropriate voice profile for the brand
3. Adjust speed and tone for the content
4. Generate multiple voice styles if needed
5. Sync voiceover with video timing

Choose voices that match the brand voice from the brief.
WebMCP Tools:

Tool Name	Description
text_to_speech	Convert text to spoken audio
generate_voice	Generate voiceover with a specific voice profile
select_voice_profile	Select a voice profile (male, female, character)
Agent 8: Copywriter (The Polisher)
Role: Creates captions, descriptions, and metadata.

System Prompt:

text
You are the Copywriter Agent. You create platform-optimized copy for videos.

Your responsibilities:
1. Write captions for social media platforms
2. Add relevant hashtags
3. Write meta descriptions and titles
4. Create call-to-action copy
5. Optimize for engagement (Instagram, YouTube, TikTok)

Each platform has different optimal lengths and styles. Adapt accordingly.
WebMCP Tools:

Tool Name	Description
write_caption	Generate platform-optimized captions
add_hashtags	Generate relevant hashtags
write_meta_description	Write SEO meta description
generate_cta	Generate a call-to-action
Agent 9: Critic/QA Agent (The Quality Checker)
Role: Reviews all content and provides PASS/NEEDS_REVISION verdicts.

System Prompt:

text
You are the Critic/QA Agent. You do NOT create content. You ONLY review and return APPROVED or NEEDS_REVISION.

When returning NEEDS_REVISION, you MUST include:
1. Specific, actionable feedback
2. Which part of the brief was violated
3. A suggested fix

You evaluate against:
1. Brand guidelines (from the brief)
2. Technical quality (resolution, framing, composition)
3. Consistency (with previous scenes)
4. Platform requirements (Instagram vs. YouTube vs. TikTok)
5. Originality (not cliché or generic)

Score each aspect out of 10. Return PASS if all aspects score ≥7.
WebMCP Tools:

Tool Name	Description
review_script	Review a script for quality and brand alignment
review_image	Review an image for quality and consistency
review_video	Review a video for quality and technical issues
deliver_verdict	Deliver a final verdict with score
Agent 10: Project Manager Agent (The Scheduler)
Role: Creates timelines and tracks progress.

System Prompt:

text
You are the Project Manager Agent. You track progress and manage timelines.

Your responsibilities:
1. Create a project timeline with milestones
2. Track progress of each task
3. Manage dependencies between tasks
4. Sync project status to external systems
5. Provide roadmaps and status reports

Never generate content. Only plan and track.
WebMCP Tools:

Tool Name	Description
create_timeline	Create a project timeline with milestones
set_milestone	Set or update a milestone
get_roadmap	Get the project roadmap
sync_to_notion	Sync project status to Notion
🛠️ Complete WebMCP Tool Registry (14 Tools)
Tool Registration Template
typescript
// Feature-detect the WebMCP API
const mc = document.modelContext || navigator.modelContext;

await mc.registerTool({
  name: 'tool_name',
  description: 'Clear description under 500 characters',
  inputSchema: {
    type: 'object',
    properties: {
      param1: { 
        type: 'string', 
        description: 'Description of parameter 1' 
      },
      param2: { 
        type: 'number', 
        enum: [1, 2, 3],
        description: 'Description of parameter 2' 
      }
    },
    required: ['param1']
  },
  execute: async ({ param1, param2 }) => {
    // Implementation
    const result = await doSomething(param1, param2);
    
    return {
      content: [{ 
        type: 'text', 
        text: 'Result summary for the agent to read' 
      }],
      structuredContent: { 
        // Structured data for the agent to use in subsequent calls
        result,
        nextStep: 'suggested_next_action'
      }
    };
  }
});
Tool 1: create_project
typescript
{
  name: 'create_project',
  description: 'Initialize a new creative project with title, description, and timeline',
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'The project title' },
      description: { type: 'string', description: 'Project description or brief' },
      timeline: { type: 'string', enum: ['fast', 'standard', 'premium'], description: 'Timeline mode' }
    },
    required: ['title']
  },
  execute: async ({ title, description, timeline }) => {
    const projectId = crypto.randomUUID();
    // Save to state
    return {
      content: [{ type: 'text', text: `Created project: ${title} (${projectId})` }],
      structuredContent: { projectId, title, status: 'planning' }
    };
  }
}
Tool 2: get_project_status
typescript
{
  name: 'get_project_status',
  description: 'Get the current status and progress of a project',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: { type: 'string', description: 'The project ID' }
    },
    required: ['projectId']
  },
  execute: async ({ projectId }) => {
    const project = getProject(projectId);
    return {
      content: [{ type: 'text', text: `Project ${project.title}: ${project.status}` }],
      structuredContent: { 
        status: project.status, 
        progress: project.progress,
        tasks: project.tasks 
      }
    };
  }
}
Tool 3: generate_script
typescript
{
  name: 'generate_script',
  description: 'Generate a video script from a prompt with scene breakdowns and timing',
  inputSchema: {
    type: 'object',
    properties: {
      prompt: { type: 'string', description: 'The story concept or prompt' },
      style: { type: 'string', enum: ['professional', 'casual', 'dramatic'], description: 'Script style' },
      duration: { type: 'number', description: 'Target duration in seconds' },
      brandVoice: { type: 'string', description: 'Brand voice guidelines' }
    },
    required: ['prompt']
  },
  execute: async ({ prompt, style, duration, brandVoice }) => {
    const script = await generateScript(prompt, style, duration, brandVoice);
    return {
      content: [{ type: 'text', text: script }],
      structuredContent: { 
        script, 
        scenes: parseScenes(script),
        duration,
        style,
        wordCount: script.split(' ').length 
      }
    };
  }
}
Tool 4: create_storyboard
typescript
{
  name: 'create_storyboard',
  description: 'Generate a visual storyboard from a script with scene thumbnails',
  inputSchema: {
    type: 'object',
    properties: {
      script: { type: 'string', description: 'The script to visualize' },
      sceneCount: { type: 'number', default: 5, description: 'Number of scenes' },
      style: { type: 'string', enum: ['sketch', 'rendered', 'minimal'], description: 'Storyboard style' }
    },
    required: ['script']
  },
  execute: async ({ script, sceneCount, style }) => {
    const storyboard = await generateStoryboard(script, sceneCount, style);
    return {
      content: [{ type: 'text', text: `Generated ${sceneCount} storyboard scenes` }],
      structuredContent: { 
        frames: storyboard.frames,
        totalScenes: sceneCount,
        style
      }
    };
  }
}
Tool 5: generate_image
typescript
{
  name: 'generate_image',
  description: 'Generate a visual concept image from a description with style and resolution options',
  inputSchema: {
    type: 'object',
    properties: {
      description: { type: 'string', description: 'Image description' },
      style: { type: 'string', enum: ['photorealistic', 'illustration', '3d', 'anime'], description: 'Visual style' },
      resolution: { type: 'string', enum: ['512x512', '1024x1024', '1920x1080'], description: 'Image resolution' },
      brandColors: { type: 'string', description: 'Brand color palette' }
    },
    required: ['description']
  },
  execute: async ({ description, style, resolution, brandColors }) => {
    const imageUrl = await generateImage(description, style, resolution, brandColors);
    return {
      content: [{ type: 'text', text: `Generated ${style} image` }],
      structuredContent: { 
        url: imageUrl, 
        style, 
        resolution, 
        prompt: description 
      }
    };
  }
}
Tool 6: text_to_video
typescript
{
  name: 'text_to_video',
  description: 'Generate a short video clip from a text prompt with model and duration options',
  inputSchema: {
    type: 'object',
    properties: {
      prompt: { type: 'string', description: 'Video description' },
      model: { type: 'string', enum: ['veo3', 'veo3-fast', 'sora'], description: 'Video model' },
      duration: { type: 'number', default: 5, description: 'Duration in seconds' },
      resolution: { type: 'string', enum: ['720p', '1080p', '4k'], description: 'Video resolution' },
      worldState: { type: 'object', description: 'World state for consistency' }
    },
    required: ['prompt']
  },
  execute: async ({ prompt, model, duration, resolution, worldState }) => {
    const videoUrl = await generateVideo(prompt, model, duration, resolution, worldState);
    return {
      content: [{ type: 'text', text: `Generated ${duration}s video clip using ${model}` }],
      structuredContent: { 
        url: videoUrl, 
        model, 
        duration, 
        resolution,
        prompt
      }
    };
  }
}
Tool 7: image_to_video
typescript
{
  name: 'image_to_video',
  description: 'Animate a static image into a short video clip with motion style',
  inputSchema: {
    type: 'object',
    properties: {
      imageUrl: { type: 'string', format: 'uri', description: 'Source image URL' },
      motionStyle: { type: 'string', enum: ['pan', 'zoom', 'ken_burns', 'dynamic'], description: 'Motion style' },
      duration: { type: 'number', default: 3, description: 'Duration in seconds' }
    },
    required: ['imageUrl']
  },
  execute: async ({ imageUrl, motionStyle, duration }) => {
    const videoUrl = await animateImage(imageUrl, motionStyle, duration);
    return {
      content: [{ type: 'text', text: `Animated image with ${motionStyle} motion` }],
      structuredContent: { 
        url: videoUrl, 
        motionStyle, 
        duration,
        sourceImage: imageUrl 
      }
    };
  }
}
Tool 8: text_to_speech
typescript
{
  name: 'text_to_speech',
  description: 'Generate voiceover audio from text with voice profile and speed options',
  inputSchema: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Text to speak' },
      voice: { type: 'string', enum: ['male_deep', 'female_warm', 'neutral', 'character'], description: 'Voice profile' },
      speed: { type: 'number', default: 1.0, description: 'Speech speed multiplier' },
      brandTone: { type: 'string', description: 'Brand tone for voice' }
    },
    required: ['text']
  },
  execute: async ({ text, voice, speed, brandTone }) => {
    const audioUrl = await generateSpeech(text, voice, speed, brandTone);
    return {
      content: [{ type: 'text', text: `Generated ${voice} voiceover` }],
      structuredContent: { 
        url: audioUrl, 
        voice, 
        speed, 
        duration: text.length / 150 * 60,
        wordCount: text.split(' ').length
      }
    };
  }
}
Tool 9: compose_video
typescript
{
  name: 'compose_video',
  description: 'Assemble a final video from clips, images, and audio with transitions',
  inputSchema: {
    type: 'object',
    properties: {
      scenes: { type: 'array', items: { type: 'string' }, description: 'Scene asset URLs' },
      audioTrack: { type: 'string', description: 'Audio track URL' },
      transitions: { type: 'string', enum: ['fade', 'cut', 'dissolve', 'slide'], description: 'Transition style' },
      outputFormat: { type: 'string', enum: ['1080p', '4k', 'vertical'], description: 'Output format' },
      title: { type: 'string', description: 'Video title' }
    },
    required: ['scenes']
  },
  execute: async ({ scenes, audioTrack, transitions, outputFormat, title }) => {
    const videoUrl = await assembleVideo(scenes, audioTrack, transitions, outputFormat, title);
    return {
      content: [{ type: 'text', text: `Composed video with ${scenes.length} scenes` }],
      structuredContent: { 
        url: videoUrl, 
        sceneCount: scenes.length, 
        format: outputFormat,
        duration: scenes.length * 5
      }
    };
  }
}
Tool 10: write_caption
typescript
{
  name: 'write_caption',
  description: 'Generate platform-optimized captions with hashtags and CTAs',
  inputSchema: {
    type: 'object',
    properties: {
      videoTitle: { type: 'string', description: 'Video title' },
      platform: { type: 'string', enum: ['instagram', 'youtube', 'tiktok', 'linkedin'], description: 'Platform' },
      tone: { type: 'string', enum: ['professional', 'casual', 'inspirational'], description: 'Tone' },
      keyMessage: { type: 'string', description: 'Key message to convey' }
    },
    required: ['videoTitle', 'platform']
  },
  execute: async ({ videoTitle, platform, tone, keyMessage }) => {
    const caption = await generateCaption(videoTitle, platform, tone, keyMessage);
    const hashtags = generateHashtags(videoTitle, platform);
    return {
      content: [{ type: 'text', text: caption }],
      structuredContent: { 
        caption, 
        hashtags, 
        platform, 
        tone,
        charCount: caption.length 
      }
    };
  }
}
Tool 11: review_video
typescript
{
  name: 'review_video',
  description: 'Review a video for quality, brand alignment, and technical issues',
  inputSchema: {
    type: 'object',
    properties: {
      videoUrl: { type: 'string', format: 'uri', description: 'Video URL' },
      criteria: { 
        type: 'array', 
        items: { type: 'string', enum: ['visual', 'audio', 'content', 'brand'] },
        description: 'Review criteria'
      },
      brandGuidelines: { type: 'object', description: 'Brand guidelines to evaluate against' }
    },
    required: ['videoUrl']
  },
  execute: async ({ videoUrl, criteria, brandGuidelines }) => {
    const issues = await analyzeVideo(videoUrl, criteria, brandGuidelines);
    const pass = issues.filter(i => i.severity === 'critical').length === 0;
    const score = pass ? 100 : Math.max(0, 100 - issues.length * 10);
    
    return {
      content: [{ 
        type: 'text', 
        text: pass ? 'PASS: Video meets quality standards' : `FAIL: ${issues.length} issues found` 
      }],
      structuredContent: { 
        pass, 
        issues, 
        score,
        feedback: issues.map(i => i.message).join('\n'),
        nextAction: pass ? 'proceed_to_copywriting' : 'regenerate_with_feedback'
      }
    };
  }
}
Tool 12: request_human_approval
typescript
{
  name: 'request_human_approval',
  description: 'Request explicit human approval before proceeding with a critical action',
  inputSchema: {
    type: 'object',
    properties: {
      action: { type: 'string', description: 'The action requiring approval' },
      context: { type: 'string', description: 'Context and reasoning' },
      alternatives: { type: 'array', items: { type: 'string' }, description: 'Alternative options' }
    },
    required: ['action']
  },
  execute: async ({ action, context, alternatives }, agent) => {
    // Pause execution and wait for human interaction
    const approved = await agent.requestUserInteraction(async () => {
      return new Promise((resolve) => {
        // Show approval modal
        const event = new CustomEvent('request-approval', {
          detail: { 
            action, 
            context, 
            alternatives, 
            resolve 
          }
        });
        window.dispatchEvent(event);
      });
    });
    
    if (!approved) {
      // Log veto for learning
      logVeto({ action, context, timestamp: new Date() });
      
      return {
        content: [{ type: 'text', text: `Rejected: ${action}. Consider alternatives: ${alternatives?.join(', ') || 'none'}` }],
        structuredContent: { 
          approved: false, 
          alternatives,
          nextAction: 'present_alternatives_to_user'
        }
      };
    }
    
    return {
      content: [{ type: 'text', text: `Approved: ${action}` }],
      structuredContent: { approved: true }
    };
  }
}
Tool 13: refine_scene
typescript
{
  name: 'refine_scene',
  description: 'Refine an existing scene based on specific feedback and changes',
  inputSchema: {
    type: 'object',
    properties: {
      sceneId: { type: 'string', description: 'Scene identifier' },
      feedback: { type: 'string', description: 'User feedback' },
      changes: { 
        type: 'array', 
        items: { 
          type: 'object',
          properties: {
            property: { type: 'string' },
            value: { type: 'string' }
          }
        },
        description: 'Specific changes to apply'
      }
    },
    required: ['sceneId']
  },
  execute: async ({ sceneId, feedback, changes }) => {
    const scene = getScene(sceneId);
    const refined = applyRefinements(scene, changes);
    // Log the refinement for learning
    logRefinement({ sceneId, feedback, changes, timestamp: new Date() });
    
    return {
      content: [{ type: 'text', text: `Refined scene ${sceneId} based on feedback` }],
      structuredContent: { 
        sceneId, 
        refined,
        changesApplied: changes.length,
        version: refined.version
      }
    };
  }
}
Tool 14: get_project_roadmap
typescript
{
  name: 'get_project_roadmap',
  description: 'Get the full project timeline with milestones and dependencies',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: { type: 'string', description: 'Project ID' }
    },
    required: ['projectId']
  },
  execute: async ({ projectId }) => {
    const project = getProject(projectId);
    const roadmap = generateRoadmap(project);
    return {
      content: [{ type: 'text', text: `Project roadmap: ${roadmap.totalTasks} tasks, ${roadmap.estimatedCompletion}` }],
      structuredContent: { 
        roadmap, 
        totalTasks: roadmap.tasks.length,
        completedTasks: roadmap.tasks.filter(t => t.completed).length,
        estimatedCompletion: roadmap.estimatedCompletion,
        milestones: roadmap.milestones
      }
    };
  }
}
📊 Tool Usage by Agent
Agent	Tools Used
Creative Director	delegate_task, start_project, get_project_status, assign_to_agent
Brand Strategist	search_trends, get_audience_insights, analyze_competitors, define_brand_voice
Scriptwriter	generate_script, create_storyboard, enhance_prompt, generate_story
Graphic Designer	generate_image, edit_image, list_project_assets, save_project_asset
Motion Graphics	text_to_video, image_to_video, create_transition, get_1080p_video
Video Editor	compose_video, add_audio_track, apply_transition, export_video
Voiceover Artist	text_to_speech, generate_voice, select_voice_profile
Copywriter	write_caption, add_hashtags, write_meta_description, generate_cta
Critic/QA	review_script, review_image, review_video, deliver_verdict
Project Manager	create_timeline, set_milestone, get_roadmap, sync_to_notion
🔄 Orchestration Sequence
typescript
// The Creative Director orchestrates in this exact sequence:

1. create_project → Get projectId
2. delegate_task → Brand Strategist → get_audience_insights
3. delegate_task → Scriptwriter → generate_script
4. delegate_task → Graphic Designer → create_storyboard
5. delegate_task → Motion Graphics → text_to_video (for each scene)
6. delegate_task → Voiceover → text_to_speech
7. delegate_task → Video Editor → compose_video
8. delegate_task → Critic/QA → review_video
9. IF review_video.pass THEN
     delegate_task → Copywriter → write_caption
     delegate_task → Project Manager → get_roadmap
   ELSE
     delegate_task → Video Editor → refine_scene (with feedback)
     GOTO step 8
10. request_human_approval → Final video
11. compose_video → Export final