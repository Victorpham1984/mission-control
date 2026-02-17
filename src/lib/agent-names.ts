// Auto-name generator for agents

type AgentIdentity = {
  name: string;
  emoji: string;
  about: string;
  skills: string[];
};

const roleProfiles: Record<string, { names: string[]; emojis: string[]; abouts: string[]; skills: string[][] }> = {
  frontend: {
    names: ["Linh Pixel", "Minh Canvas", "Hoa Spark", "Khoa Prism", "Trang Neon", "Duy Palette", "Mai Render", "Phúc Grid"],
    emojis: ["🎨", "✨", "🌈", "💎", "🖌️", "🎭", "🦋", "🌸"],
    abouts: [
      "Crafts beautiful interfaces with pixel-perfect precision",
      "Turns wireframes into living, breathing experiences",
      "Obsessed with smooth animations and delightful micro-interactions",
    ],
    skills: [
      ["React", "TypeScript", "CSS", "Animation"],
      ["Next.js", "Tailwind", "Figma", "A11y"],
      ["UI/UX", "Components", "Responsive", "Performance"],
    ],
  },
  backend: {
    names: ["Sơn Forge", "Đức Engine", "Hùng Core", "Thắng Vault", "Bảo Shield", "Tuấn Steel", "Quân Anchor", "Toàn Rock"],
    emojis: ["⚙️", "🔧", "🏗️", "🛡️", "⛓️", "🔩", "🦾", "💪"],
    abouts: [
      "Builds rock-solid APIs and scalable architectures",
      "Database whisperer — optimizes queries in sleep",
      "Security-first engineer who never cuts corners",
    ],
    skills: [
      ["Node.js", "PostgreSQL", "APIs", "Docker"],
      ["Python", "Redis", "GraphQL", "AWS"],
      ["Microservices", "Auth", "Caching", "CI/CD"],
    ],
  },
  ba: {
    names: ["Thảo Lens", "Ngọc Insight", "Vy Logic", "Quỳnh Chart", "Lan Scope", "Khánh Matrix", "Phương Signal", "Thy Data"],
    emojis: ["📊", "🔍", "📐", "🧮", "💡", "📈", "🎯", "🗺️"],
    abouts: [
      "Translates chaos into clear requirements and user stories",
      "Finds patterns in data that others miss",
      "Bridges the gap between stakeholders and development team",
    ],
    skills: [
      ["Requirements", "User Stories", "Analytics", "Stakeholders"],
      ["Data Analysis", "Process Mapping", "Jira", "Documentation"],
      ["Research", "Roadmapping", "Metrics", "Prioritization"],
    ],
  },
  qa: {
    names: ["Tâm Hawk", "Đạt Scanner", "Hiếu Probe", "Trí Detect", "Kiên Trace", "Nghĩa Check", "Dũng Guard", "Việt Radar"],
    emojis: ["🔎", "🐛", "🧪", "🕵️", "🦅", "🎯", "🛡️", "⚡"],
    abouts: [
      "No bug escapes — tests with detective-level thoroughness",
      "Automates everything and breaks things so users don't have to",
      "Quality guardian with an eye for edge cases",
    ],
    skills: [
      ["Testing", "Automation", "Cypress", "Edge Cases"],
      ["QA Strategy", "Selenium", "Performance", "Security"],
      ["Bug Hunting", "CI Testing", "API Testing", "Regression"],
    ],
  },
  lead: {
    names: ["Anh Commander", "Trung Captain", "Hoàng Admiral", "Phong General", "Thành Marshal", "Hải Strategos", "Long Chief", "Khang Sentinel"],
    emojis: ["👑", "⚡", "🎖️", "🏆", "🦁", "🚀", "🗡️", "🔱"],
    abouts: [
      "Orchestrates the squad with vision and precision",
      "Keeps everyone aligned and shipping on schedule",
      "Leads by example — codes, reviews, and unblocks",
    ],
    skills: [
      ["Leadership", "Architecture", "Code Review", "Strategy"],
      ["Team Management", "Planning", "Mentoring", "DevOps"],
      ["Decision Making", "Roadmap", "Hiring", "Culture"],
    ],
  },
};

const defaultProfile = roleProfiles.backend;

export function generateAgentName(role: string, existingNames: string[] = []): AgentIdentity {
  const profile = roleProfiles[role.toLowerCase()] || defaultProfile;

  // Find unused name
  const availableNames = profile.names.filter(n => !existingNames.includes(n));
  const namePool = availableNames.length > 0 ? availableNames : profile.names;

  const idx = Math.floor(Math.random() * namePool.length);
  const name = namePool[idx];
  const emoji = profile.emojis[idx % profile.emojis.length];
  const about = profile.abouts[Math.floor(Math.random() * profile.abouts.length)];
  const skills = profile.skills[Math.floor(Math.random() * profile.skills.length)];

  return { name, emoji, about, skills };
}

export function getAllRoles(): string[] {
  return Object.keys(roleProfiles);
}
