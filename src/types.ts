/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Novel {
  id: string;
  title: string;
  description: string;
  genre: string; // 都市/仙侠/玄幻/科幻/历史等
  style: string[]; // 类似 ["爽文", "热血", "轻松"]
  target_words: number;
  current_words: number;
  status: 'draft' | 'generating' | 'completed';
  model: string;
  language: string;
  reference?: string;
  created_at: string;
  updated_at: string;
}

export interface StoryBible {
  theme: string;
  tone: string;
  summary: string;
  world_view: string;
  rules: string;
  power_system: string;
  factions: { name: string; description: string; stance: string }[];
  locations: { name: string; description: string }[];
  items: { name: string; description: string; owner?: string }[];
  ending: string;
}

export interface Character {
  id: string;
  name: string;
  alias?: string[];
  role: 'protagonist' | 'antagonist' | 'supporting';
  gender: string;
  age: string;
  appearance: string;
  personality: string;
  goal: string;
  secret: string;
  growth_arc: string;
  catchphrase: string;
  background: string;
  current_status: string; // alive, injured, etc.
  relationships: Record<string, string>; // name -> relationship desc
}

export interface OutlineItem {
  chapter_num: number;
  title: string;
  goal: string;
  conflict: string;
  climax: string;
  hook: string;
  characters: string[];
  location: string;
  status: 'pending' | 'generating' | 'completed';
}

export interface ChapterSnapshot {
  id: string;
  timestamp: string;
  content: string;
  word_count: number;
  summary?: string;
  trigger_type: 'manual' | 'ai' | 'auto';
}

export interface Chapter {
  id: string;
  novel_id: string;
  chapter_num: number;
  title: string;
  content: string;
  word_count: number;
  status: 'pending' | 'generating' | 'done' | 'reviewing' | 'approved';
  summary?: string; // Chapter dynamic summary stored as text
  created_at: string;
  snapshots?: ChapterSnapshot[];
}

export interface Foreshadow {
  id: string;
  title: string;
  description: string;
  planted_chapter: number;
  resolve_chapter: number;
  status: 'open' | 'resolved';
  resolved_at?: number;
}

export interface Memory {
  id: string;
  type: 'character' | 'story' | 'world' | 'style';
  key: string;
  content: string;
  chapter_ref?: number;
}

export interface ProjectData {
  novel: Novel;
  storyBible: StoryBible;
  characters: Character[];
  outline: OutlineItem[];
  chapters: Chapter[];
  foreshadows: Foreshadow[];
  memories: Memory[];
}
