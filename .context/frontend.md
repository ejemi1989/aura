Modern UI Prompt for Multi-Agent Creative Studio
Design a single-page application for a multi-agent creative studio where 10+ AI agents collaborate with humans to create video content. This is for the OpenAI WebMCP Challenge and needs to look like a professional creative tool—clean, intentional, and human-designed.

Overall Design Philosophy
Clean Light/Dark Professional Aesthetic: Think Linear, Notion, Figma—not generic "cyberpunk" or overstyled AI demos

Subtle, Purposeful Design: Every element has a reason. No decorative gradients or unnecessary glass effects

Clear Information Hierarchy: What matters most is largest and most prominent

Type-Led Design: Typography does the heavy lifting; color is used sparingly and intentionally

Whitespace as a Design Tool: Generous spacing creates breathing room and clarity

Subtle Micro-Interactions: Small, purposeful animations that provide feedback, not distraction

Layout Structure
text
┌──────────────────────────────────────────────────────────────────────┐
│  Studio Logo    Project: EcoStep Campaign    ● Live    ⚙️  Share   │
├──────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌─────────┐  ┌─────────────────────────────────────────────────┐  │
│  │ Agents  │  │              Workspace                         │  │
│  │ 10      │  │                                                 │  │
│  │         │  │  ┌─────────────────────────────────────────┐    │  │
│  │ ● Dir   │  │  │       Video Preview                    │    │  │
│  │ ✓ Wri   │  │  │       [Screen ratio 16:9]             │    │  │
│  │ ◉ Des   │  │  │       00:00 / 00:30                   │    │  │
│  │ ○ Mot   │  │  └─────────────────────────────────────────┘    │  │
│  │ ○ Voi   │  │                                                 │  │
│  │ ○ Cop   │  │  ┌─────────────────────────────────────────┐    │  │
│  │ ○ Cri   │  │  │  Storyboard   Script   Audio  Timeline │    │  │
│  │ ○ PM    │  │  │  [Thumbnails in a clean grid]          │    │  │
│  │         │  │  └─────────────────────────────────────────┘    │  │
│  └─────────┘  └─────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  [Describe your video concept...]  [Send]  ● 3/10 steps   │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  🔧 WebMCP Tools  [12 calls]  ▼                            │  │
│  │  14:32:01  generate_script  ✓  142ms                       │  │
│  │  14:32:03  create_storyboard  ✓  89ms                      │  │
│  │  14:32:05  generate_image  ✓  234ms                        │  │
│  └──────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
Design Tokens
css
/* Light Theme (default) */
:root {
  --bg-app: #f8f9fa;
  --bg-surface: #ffffff;
  --bg-sidebar: #f1f3f5;
  --bg-input: #ffffff;
  --border-subtle: #e9ecef;
  --border-focus: #228be6;
  
  --text-primary: #212529;
  --text-secondary: #495057;
  --text-tertiary: #868e96;
  
  --accent-blue: #228be6;
  --accent-green: #12b886;
  --accent-amber: #f59f00;
  --accent-red: #fa5252;
  --accent-purple: #7950f2;
  
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.06);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.08);
  --radius: 8px;
}

/* Dark Theme */
[data-theme="dark"] {
  --bg-app: #141517;
  --bg-surface: #1e1f23;
  --bg-sidebar: #18191c;
  --bg-input: #2a2b2f;
  --border-subtle: #2d2e33;
  
  --text-primary: #e9ecef;
  --text-secondary: #adb5bd;
  --text-tertiary: #6c757d;
  
  --accent-blue: #4dabf7;
  --accent-green: #69db7c;
  --accent-amber: #ffd43b;
  --accent-red: #ff6b6b;
  --accent-purple: #9775fa;
}
Component Specifications
1. Top Navigation Bar
text
Clean, minimal navigation bar:
- Height: 56px
- Left: Studio logo (simple wordmark or icon mark)
- Center: Project name (editable on click) with breadcrumb
- Right: 
  - Status indicator (small dot + "Live" text)
  - Share button (outline)
  - Theme toggle (icon)
- Bottom: Very subtle border (1px, low opacity)
- Background: bg-surface (white or dark surface)
2. Agent Swarm Panel (Left, 216px wide)
text
Clean sidebar with agent list:
- Header: "Agents" + count badge (10)
- Each agent: 
  - Status indicator (small dot, color-coded)
  - Agent name (14px, medium weight)
  - Agent role/current action (12px, text-secondary)
  - Active agents show a thin progress bar (2px height)
- Spacing: 8px between agents
- Active agent has a subtle background highlight
- Panel auto-scrolls to active agents
- Background: bg-sidebar
Agent Colors & Dots:

Active: Blue dot, subtle blue background

Completed: Green dot

Loading: Amber dot with pulse

Idle: Gray dot

Error: Red dot

3. Workspace (Center, Flexible)
text
Main workspace area:

A. VIDEO PREVIEW (Top, flexible height)
- 16:9 aspect ratio container
- Dark background behind video
- Video controls at bottom of preview:
  - Play/pause button
  - Progress bar (thin)
  - Time counter (00:00 / 00:30)
  - Resolution badge (1080p)
- When rendering: Show clean loading state with spinner and "Rendering..." text
- No unnecessary decorations

B. TABBED CONTENT PANEL (Bottom, ~200px fixed height)
- Tab bar with: Storyboard, Script, Audio, Timeline
- Active tab underlined (2px blue indicator)
- Content area:
  - Storyboard: Clean masonry grid (3 columns) with scene thumbnails
  - Script: Clean monospace text area (system font stack)
  - Audio: Simple waveform visualization
  - Timeline: Horizontal bar showing scene segments
4. Bottom Controls Bar
text
Fixed bottom bar:
- Height: 64px
- Background: bg-surface
- Top border: 1px border-subtle

Left side:
- Prompt input (flex: 1)
  - Clean input with rounded corners
  - Padding: 10px 16px
  - Border: 1px border-subtle
  - Focus: border-blue
  - Placeholder: "Describe your video concept..."
- Send button: 
  - Blue primary button
  - Icon + text
  - Padding: 10px 20px

Right side:
- Progress indicator: "3/10 steps"
- Optional: Cancel button (if in progress)
5. Approval Modal (Human Veto)
text
Clean modal overlay:
- Overlay: rgba(0,0,0,0.4) with blur (optional)
- Modal card: bg-surface, rounded, max-width 480px
- Padding: 32px
- Title: "Approval Required" (18px, semibold)
- Agent name: "Critic/QA" (small label)
- Action description: "Generate final video" (16px)
- Context paragraph: (14px, text-secondary)
- Two buttons:
  - "Approve" (blue primary, full-width or side-by-side)
  - "Reject" (ghost/outline button)
- Optional: "Rejection reason" text area (shown if reject clicked)
- Esc key: closes modal without approving
6. Debug Panel (Collapsible, Bottom-right)
text
Terminal-inspired panel:
- Toggle: Small button with "🔧" icon + call count
- When open: 
  - Position: Fixed, bottom-right corner
  - Width: 540px, Height: 280px
  - Background: bg-sidebar (or dark bg for contrast)
  - Font: inter
  - Font size: 12px
  - Header: "Tool Calls" + count + "Clear" button
  - Each log entry:
    - Timestamp (gray, 12px)
    - Tool name (blue, medium weight)
    - Status: ✓ or ✗
    - Duration (gray)
  - Expandable to show input/output JSON
  - Auto-scrolls to latest
Typography
Element	Size	Weight	Color
App name	16px	600	text-primary
Project name	14px	500	text-primary
Agent name	13px	500	text-primary
Agent action	12px	400	text-secondary
Tab labels	13px	500	text-secondary
Video timestamp	14px	500	white (on video)
Modal title	18px	600	text-primary
Modal body	14px	400	text-secondary
Prompt input	14px	400	text-primary
Debug log	12px	400	monospace
Status badge	11px	500	uppercase
Font Family: Inter (system font stack fallback)

Color Palette
Role	Light	Dark
Background App	#f8f9fa	#141517
Surface	#ffffff	#1e1f23
Sidebar	#f1f3f5	#18191c
Border	#e9ecef	#2d2e33
Text Primary	#212529	#e9ecef
Text Secondary	#495057	#adb5bd
Text Tertiary	#868e96	#6c757d
Blue (Primary)	#228be6	#4dabf7
Green (Success)	#12b886	#69db7c
Amber (Warning)	#f59f00	#ffd43b
Red (Error)	#fa5252	#ff6b6b
Purple (Active)	#7950f2	#9775fa
Animation Specifications
Purposeful, subtle animations:

css
/* Agent status transition - subtle */
.agent-status-change {
  transition: background-color 0.2s ease;
}

/* Progress indicator - smooth */
.progress-bar {
  transition: width 0.3s ease;
}

/* Modal appearance - clean */
.modal-enter {
  animation: modalFade 0.15s ease-out;
}

@keyframes modalFade {
  from { opacity: 0; transform: scale(0.97); }
  to { opacity: 1; transform: scale(1); }
}

/* Status dot pulse - for active agents only */
@keyframes dotPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.status-dot.active {
  animation: dotPulse 1.5s ease-in-out infinite;
}
Components List
Layout:

AppShell

Sidebar

WorkspaceContainer

BottomBar

Navigation:

TopNav

ProjectSelector

ThemeToggle

Agents:

AgentList

AgentItem

Workspace:

VideoPreview (with custom controls)

TabBar (Storyboard, Script, Audio, Timeline)

StoryboardGrid

ScriptEditor

AudioWaveform

TimelineView

Controls:

PromptInput

SendButton

ProgressIndicator

Modals:

ApprovalModal

Debug:

DebugPanel

ToolCallLog

Common:

Button (Primary, Ghost, Outline)

StatusDot

Badge

Spinner

Example Component Code
Agent Item
tsx
function AgentItem({ agent }: { agent: Agent }) {
  return (
    <div className={`agent-item ${agent.status === 'active' ? 'active' : ''}`}>
      <StatusDot status={agent.status} />
      <div className="agent-info">
        <span className="agent-name">{agent.name}</span>
        <span className="agent-action">{agent.action}</span>
      </div>
      {agent.status === 'active' && (
        <div className="agent-progress">
          <div className="progress-bar" style={{ width: `${agent.progress}%` }} />
        </div>
      )}
    </div>
  );
}
Approval Modal
tsx
function ApprovalModal({ open, onApprove, onReject }) {
  if (!open) return null;
  
  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <h3>Approval Required</h3>
        <p className="agent-label">Critic/QA</p>
        <p className="action-text">Generate final video</p>
        <p className="context">
          The Critic agent has flagged a color mismatch in scene 3. 
          The brand guidelines require more vibrant colors.
        </p>
        <div className="modal-actions">
          <button className="button-secondary" onClick={onReject}>
            Reject
          </button>
          <button className="button-primary" onClick={onApprove}>
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}
Packages
json
{
  "dependencies": {
    "next": "14.2.3",
    "react": "^18",
    "react-dom": "^18",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.0.0"
  },
  "devDependencies": {
    "tailwindcss": "^3.4.0",
    "typescript": "^5",
    "@types/node": "^20"
  }
}
No unnecessary packages. Keep it lean.

Implementation Notes
Use Tailwind CSS with a custom config extending the design tokens above

No CSS-in-JS—use CSS modules or Tailwind

No external animation libraries—use CSS transitions and animations

Keep color palette tight—no random colors

Responsive: Mobile-first, but desktop is primary

Accessibility: Proper semantic HTML, ARIA where needed

Keyboard shortcuts: Cmd+K for command palette, Escape for modals

File Structure
text
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   ├── AgentList/
│   │   ├── AgentList.tsx
│   │   └── AgentItem.tsx
│   ├── Workspace/
│   │   ├── Workspace.tsx
│   │   ├── VideoPreview.tsx
│   │   └── tabs/
│   │       ├── Storyboard.tsx
│   │       ├── Script.tsx
│   │       ├── Audio.tsx
│   │       └── Timeline.tsx
│   ├── BottomBar/
│   │   ├── BottomBar.tsx
│   │   ├── PromptInput.tsx
│   │   └── ProgressIndicator.tsx
│   ├── TopNav/
│   │   └── TopNav.tsx
│   ├── ApprovalModal/
│   │   └── ApprovalModal.tsx
│   ├── DebugPanel/
│   │   ├── DebugPanel.tsx
│   │   └── ToolCallLog.tsx
│   └── common/
│       ├── Button.tsx
│       ├── StatusDot.tsx
│       └── Spinner.tsx
├── lib/
│   └── store/
│       ├── agentStore.ts
│       └── projectStore.ts
└── types/
    ├── agent.ts
    └── project.ts
Summary Checklist
□ Clean, professional aesthetic (Linear/Notion-inspired)
□ Dark/light theme toggle
□ Typography-led design with Inter font
□ Tight color palette (no random colors)
□ Agent list with status indicators
□ Video preview with custom controls
□ Tabbed workspace (Storyboard, Script, Audio, Timeline)
□ Bottom bar with prompt input
□ Approval modal for human veto
□ Collapsible debug panel showing tool calls
□ Subtle animations (no unnecessary movement)
□ Responsive, mobile-friendly
□ Accessible (semantic HTML, ARIA)