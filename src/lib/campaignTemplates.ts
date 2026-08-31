import type { CreativeBrief } from "@/types";

// ---------------------------------------------------------------------------
// Selectable campaign templates for the Creative Brief rail.
//
// The bulk of these are ported 1:1 from `.context/data/campaign.md` — 20 demo
// briefs grouped by industry that showcase the studio's full agent pipeline
// (brand → script → storyboard → assets → voiceover → captions → edit → QA).
// Each entry is typed to `CampaignTemplate` so it can be dropped straight
// into the brief form and handed to the Creative Director.
//
// `goal` intentionally encodes the campaign's objective + key message + CTA
// so the agents land on-brand output from a single input.
// ---------------------------------------------------------------------------

export type CampaignCategory =
  | "Starter briefs"
  | "Social Media"
  | "E-Commerce"
  | "Educational"
  | "Creative & Entertainment"
  | "Healthcare & Wellness"
  | "Non-Profit & Social Impact"
  | "Marketing & Branding"
  | "Data & Analytics"
  | "Gaming & Tech";

export interface CampaignTemplate extends CreativeBrief {
  id: string;
  category: CampaignCategory;
  name: string;
  brand: string;
  keyMessage: string;
  cta: string;
}

const SECONDS_10 = 10;
const SECONDS_15 = 15;
const SECONDS_20 = 20;
const SECONDS_30 = 30;
const SECONDS_45 = 45;
const SECONDS_60 = 60;
const SECONDS_90 = 90;

export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  // ---------------------------------------------------------------------
  // Starter briefs — the three that shipped with the first build.
  // ---------------------------------------------------------------------
  {
    id: "starter-ecostep",
    category: "Starter briefs",
    name: "EcoStep Spring Campaign",
    brand: "EcoStep",
    goal: "drive signups for our eco-friendly walking-shoe launch",
    audience: "urban commuters aged 22-35 who care about sustainability",
    platform: "instagram",
    style: "playful",
    keyMessage: "Style that doesn't cost the earth",
    cta: "Pre-order now",
    targetDurationSeconds: SECONDS_30,
  },
  {
    id: "starter-nimbus",
    category: "Starter briefs",
    name: "Nimbus Cloud Migration",
    brand: "Nimbus",
    goal: "convince engineering leads to migrate their infra to Nimbus",
    audience: "VP Engineering at mid-stage SaaS companies",
    platform: "linkedin",
    style: "cinematic",
    keyMessage: "Cloud infra that scales with your roadmap",
    cta: "Talk to an engineer",
    targetDurationSeconds: SECONDS_45,
  },
  {
    id: "starter-spark",
    category: "Starter briefs",
    name: "Spark Energy Drink",
    brand: "Spark Energy",
    goal: "launch a high-energy new flavor for college athletes",
    audience: "college students and fitness creators on TikTok",
    platform: "tiktok",
    style: "dramatic",
    keyMessage: "Fuel that hits in seconds",
    cta: "Find it near campus",
    targetDurationSeconds: SECONDS_20,
  },

  // ---------------------------------------------------------------------
  // 📱 Social Media Campaigns
  // ---------------------------------------------------------------------
  {
    id: "soc-tiktok-challenge",
    category: "Social Media",
    name: "The 60-Second Glow Challenge",
    brand: "GlowUp Skincare",
    goal: "launch a viral TikTok challenge that drives user-generated content and brand awareness for our skincare range",
    audience: "Gen Z aged 16-24 active on TikTok",
    platform: "tiktok",
    style: "playful",
    keyMessage: "Transform your skin in 60 seconds",
    cta: "Share your glow up with #GlowUp60",
    targetDurationSeconds: SECONDS_15,
  },
  {
    id: "soc-instagram-carousel",
    category: "Social Media",
    name: "Hidden Gems of 2026",
    brand: "Wanderlust Travel Co.",
    goal: "drive website traffic and bookings with a 10-slide Instagram carousel of under-the-radar destinations",
    audience: "millennial travelers aged 25-35 planning their next trip",
    platform: "instagram",
    style: "cinematic",
    keyMessage: "Discover places your friends haven't heard of",
    cta: "Link in bio to book your adventure",
    targetDurationSeconds: SECONDS_30,
  },
  {
    id: "soc-linkedin-thought-leadership",
    category: "Social Media",
    name: "The Future of AI in Enterprise",
    brand: "TechForge Solutions",
    goal: "establish thought leadership and generate B2B leads with a professional explainer on enterprise AI",
    audience: "CTOs and IT Directors aged 35-55",
    platform: "linkedin",
    style: "professional",
    keyMessage: "AI isn't coming—it's already here",
    cta: "Download the white paper",
    targetDurationSeconds: SECONDS_60,
  },

  // ---------------------------------------------------------------------
  // 🛍️ E-Commerce Campaigns
  // ---------------------------------------------------------------------
  {
    id: "ecom-product-launch",
    category: "E-Commerce",
    name: "The Future of Fashion is Green",
    brand: "EcoStep Sustainable Footwear",
    goal: "drive pre-orders for a sustainable footwear product launch with an emotional, aspirational showcase",
    audience: "eco-conscious consumers aged 18-35",
    platform: "youtube",
    style: "cinematic",
    keyMessage: "Style that doesn't cost the earth",
    cta: "Pre-order now",
    targetDurationSeconds: SECONDS_30,
  },
  {
    id: "ecom-holiday-gift-guide",
    category: "E-Commerce",
    name: "The Ultimate Holiday Gift Guide",
    brand: "LuxeGifts Boutique",
    goal: "drive holiday sales with a fast-paced gift showcase that highlights must-have items",
    audience: "holiday shoppers aged 25-45",
    platform: "instagram",
    style: "playful",
    keyMessage: "Find the perfect gift in seconds",
    cta: "Shop the guide",
    targetDurationSeconds: SECONDS_15,
  },
  {
    id: "ecom-flash-sale",
    category: "E-Commerce",
    name: "48-Hour Flash Sale",
    brand: "TechDeals Marketplace",
    goal: "drive immediate conversions with a high-urgency 48-hour flash sale announcement",
    audience: "deal-hunting bargain shoppers",
    platform: "generic",
    style: "dramatic",
    keyMessage: "Up to 70% off—but only for 48 hours",
    cta: "Shop now",
    targetDurationSeconds: SECONDS_10,
  },

  // ---------------------------------------------------------------------
  // 🎓 Educational Campaigns
  // ---------------------------------------------------------------------
  {
    id: "edu-course-promo",
    category: "Educational",
    name: "Learn AI in 30 Days",
    brand: "SkillUp Academy",
    goal: "drive course enrollments with an engaging promo that sells a 30-day AI learning path",
    audience: "aspiring AI professionals aged 22-35",
    platform: "youtube",
    style: "casual",
    keyMessage: "From zero to AI-ready in 30 days",
    cta: "Enroll now for early bird pricing",
    targetDurationSeconds: SECONDS_30,
  },
  {
    id: "edu-corporate-training",
    category: "Educational",
    name: "Building Better Teams Through Learning",
    brand: "Corporate Learning Solutions",
    goal: "generate B2B leads for our corporate training platform with a professional sizzle reel",
    audience: "HR Directors and L&D Managers",
    platform: "linkedin",
    style: "professional",
    keyMessage: "Invest in your team's future",
    cta: "Book a demo",
    targetDurationSeconds: SECONDS_60,
  },

  // ---------------------------------------------------------------------
  // 🎨 Creative & Entertainment Campaigns
  // ---------------------------------------------------------------------
  {
    id: "ent-indie-film-trailer",
    category: "Creative & Entertainment",
    name: "Echoes of Tomorrow — Official Trailer",
    brand: "Independent Film 'Echoes of Tomorrow'",
    goal: "drive festival submissions and buzz with a cinematic trailer for an indie film",
    audience: "film enthusiasts aged 18-45",
    platform: "youtube",
    style: "cinematic",
    keyMessage: "What if you could hear tomorrow?",
    cta: "Subscribe for updates",
    targetDurationSeconds: SECONDS_60,
  },
  {
    id: "ent-music-video-teaser",
    category: "Creative & Entertainment",
    name: "Rise — New Single Teaser",
    brand: "Artist 'Nova Wave'",
    goal: "drive streaming and engagement with a moody teaser for a new single",
    audience: "music fans aged 16-30",
    platform: "instagram",
    style: "dramatic",
    keyMessage: "The rise is coming—are you ready?",
    cta: "Pre-save on Spotify",
    targetDurationSeconds: SECONDS_15,
  },
  {
    id: "ent-art-gallery-tour",
    category: "Creative & Entertainment",
    name: "Virtual Exhibition Tour",
    brand: "Modern Art Gallery 'The Canvas'",
    goal: "drive exhibit visits with an evocative virtual tour of a gallery exhibition",
    audience: "art lovers aged 25-55",
    platform: "instagram",
    style: "cinematic",
    keyMessage: "Experience art in a new dimension",
    cta: "Book tickets online",
    targetDurationSeconds: SECONDS_60,
  },

  // ---------------------------------------------------------------------
  // 🏥 Healthcare & Wellness Campaigns
  // ---------------------------------------------------------------------
  {
    id: "health-wellness-app",
    category: "Healthcare & Wellness",
    name: "Find Your Calm",
    brand: "ZenSpace Wellness App",
    goal: "drive app downloads with a soothing promo for a daily mindfulness and wellness app",
    audience: "stress-affected professionals aged 25-45",
    platform: "instagram",
    style: "casual",
    keyMessage: "3 minutes to calm every day",
    cta: "Download free",
    targetDurationSeconds: SECONDS_15,
  },
  {
    id: "health-telehealth",
    category: "Healthcare & Wellness",
    name: "Your Health, Anywhere",
    brand: "HealthConnect Telehealth",
    goal: "drive service awareness for telehealth with a trustworthy, professional explainer",
    audience: "busy professionals aged 30-55",
    platform: "youtube",
    style: "professional",
    keyMessage: "Healthcare should be accessible, anywhere",
    cta: "Book your first consultation",
    targetDurationSeconds: SECONDS_30,
  },

  // ---------------------------------------------------------------------
  // 🏢 Non-Profit & Social Impact Campaigns
  // ---------------------------------------------------------------------
  {
    id: "np-ocean-conservation",
    category: "Non-Profit & Social Impact",
    name: "Save Our Oceans",
    brand: "Ocean Conservation Alliance",
    goal: "drive donations with a powerful, emotional call to action for ocean conservation",
    audience: "environmentally conscious people aged 18-40",
    platform: "youtube",
    style: "dramatic",
    keyMessage: "The ocean is dying. We can save it together.",
    cta: "Donate today",
    targetDurationSeconds: SECONDS_30,
  },
  {
    id: "np-volunteer-recruitment",
    category: "Non-Profit & Social Impact",
    name: "Be the Change",
    brand: "Community Builders",
    goal: "recruit volunteers with an inspiring, action-oriented call to your community",
    audience: "young adults aged 18-30",
    platform: "instagram",
    style: "casual",
    keyMessage: "Your community needs you",
    cta: "Sign up to volunteer",
    targetDurationSeconds: SECONDS_15,
  },

  // ---------------------------------------------------------------------
  // 🎯 Marketing & Branding Campaigns
  // ---------------------------------------------------------------------
  {
    id: "mkt-rebrand",
    category: "Marketing & Branding",
    name: "New Era, Same Legacy",
    brand: "ClassicBrand",
    goal: "reposition the brand with a narrative video that honors the past and builds the future",
    audience: "existing customers plus a new younger market",
    platform: "youtube",
    style: "cinematic",
    keyMessage: "Honoring our past. Building our future.",
    cta: "Explore the new brand",
    targetDurationSeconds: SECONDS_60,
  },
  {
    id: "mkt-testimonial",
    category: "Marketing & Branding",
    name: "Customer Success Stories",
    brand: "SuccessSuite SaaS",
    goal: "build trust and social proof with authentic enterprise customer testimonials",
    audience: "enterprise decision-makers evaluating vendors",
    platform: "linkedin",
    style: "professional",
    keyMessage: "See why enterprises choose us",
    cta: "Watch full testimonials",
    targetDurationSeconds: SECONDS_60,
  },

  // ---------------------------------------------------------------------
  // 📊 Data & Analytics Campaigns
  // ---------------------------------------------------------------------
  {
    id: "data-annual-report",
    category: "Data & Analytics",
    name: "Our Year in Review 2026",
    brand: "GlobalTech Corp",
    goal: "share annual achievements with investors and stakeholders through a data-rich review video",
    audience: "investors and stakeholders",
    platform: "youtube",
    style: "professional",
    keyMessage: "A year of growth and innovation",
    cta: "Read the full report",
    targetDurationSeconds: SECONDS_90,
  },
  {
    id: "data-industry-trends",
    category: "Data & Analytics",
    name: "2026 Industry Trends Report",
    brand: "MarketInsight Research",
    goal: "drive report downloads with an analytical breakdown of the trends defining the industry",
    audience: "business leaders and analysts",
    platform: "linkedin",
    style: "professional",
    keyMessage: "The trends that will define 2027",
    cta: "Download the full report",
    targetDurationSeconds: SECONDS_60,
  },

  // ---------------------------------------------------------------------
  // 🎮 Gaming & Tech Campaigns
  // ---------------------------------------------------------------------
  {
    id: "game-cyberpulse-trailer",
    category: "Gaming & Tech",
    name: "CyberPulse — Announcement Trailer",
    brand: "Indie Game 'CyberPulse'",
    goal: "build hype and wishlists with a cinematic announcement trailer for an indie cyberpunk game",
    audience: "gamers aged 15-35",
    platform: "youtube",
    style: "dramatic",
    keyMessage: "In a world of code, one pulse can change everything",
    cta: "Wishlist on Steam",
    targetDurationSeconds: SECONDS_30,
  },
];

export const CAMPAIGN_CATEGORIES: CampaignCategory[] = [
  "Starter briefs",
  "Social Media",
  "E-Commerce",
  "Educational",
  "Creative & Entertainment",
  "Healthcare & Wellness",
  "Non-Profit & Social Impact",
  "Marketing & Branding",
  "Data & Analytics",
  "Gaming & Tech",
];

export function templatesByCategory(category: CampaignCategory): CampaignTemplate[] {
  return CAMPAIGN_TEMPLATES.filter((t) => t.category === category);
}
