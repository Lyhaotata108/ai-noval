/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, 
  Users, 
  Compass, 
  Sparkles, 
  FileText, 
  Trash2, 
  Plus, 
  ArrowRight, 
  ChevronRight, 
  Download, 
  Save, 
  RefreshCw, 
  AlertTriangle, 
  Eye, 
  CheckCircle, 
  Clock, 
  HelpCircle,
  FileDown,
  Edit3,
  Feather,
  Wand2,
  Trash,
  X,
  Target,
  ArrowLeft,
  Scale,
  History
} from 'lucide-react';
import { Novel, StoryBible, Character, OutlineItem, Chapter, Foreshadow, Memory, ProjectData } from './types';
import RelationshipGraph from './components/RelationshipGraph';

// Theme Presets and Genre Options
const GENRES = [
  { value: '仙侠玄幻', label: '仙侠玄幻 (神魔、飞升、大道)', desc: '气吞苍穹，仙路漫漫。强调力量境界体系与宿命对决。' },
  { value: '科幻未来', label: '科幻传奇 (赛博、星际、AI)', desc: '机械心智，宇宙低吟。探索科技发展与人性的宏大终局。' },
  { value: '都市高武', label: '都市高武 (隐秘、神豪、逆袭)', desc: '隐于凡世，逆天改命。爽快打脸、强者归来、商业帝国。' },
  { value: '悬疑推理', label: '悬疑惊悚 (神探、诡计、惊悚)', desc: '迷雾笼罩，细微见着。抽丝剥茧探寻隐秘真相。' },
  { value: '历史厚重', label: '历史演义 (争霸、谋略、权臣)', desc: '大浪淘沙，社稷社稷。重回风云乱世，运筹帷幄执掌天下。' },
  { value: '言情治愈', label: '言情治愈 (都市、救赎、奇幻)', desc: '红尘羁绊，唯美治愈。经历两世纠葛，执子之手白头偕老。' }
];

const STYLES = ['爽文', '热血', '轻松幽默', '严谨推理', '虐心悬念', '幕后黑手', '群像视角', '暗黑克苏鲁', '慢热细腻'];

export default function App() {
  // Navigation states
  const [currentView, setCurrentView] = useState<'dashboard' | 'create' | 'workspace'>('dashboard');
  const [novelsList, setNovelsList] = useState<Novel[]>([]);
  const [selectedNovelId, setSelectedNovelId] = useState<string | null>(null);
  
  // Loaded novel project package
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  
  // API connection health state
  const [hasApiKey, setHasApiKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');

  // Intake Form states
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newGenre, setNewGenre] = useState('仙侠玄幻');
  const [selectedStyles, setSelectedStyles] = useState<string[]>(['爽文', '热血']);
  const [newTargetWords, setNewTargetWords] = useState(500000);
  const [newReference, setNewReference] = useState('');
  const [newLang, setNewLang] = useState('zh');
  const [newModel, setNewModel] = useState('gemini-3.5-flash');

  // Workspace sub-tabs: bible, characters, outline, chapters, foreshadow
  const [activeTab, setActiveTab] = useState<'bible' | 'characters' | 'outline' | 'chapters' | 'foreshadow'>('bible');
  const [characterSubView, setCharacterSubView] = useState<'cards' | 'map'>('cards');

  // Dynamic Workspace Edit status
  const [activeChapterNum, setActiveChapterNum] = useState<number>(1);
  const [draftContent, setDraftContent] = useState<string>('');
  const [draftTitle, setDraftTitle] = useState<string>('');

  // New features states block
  const [activeEditorTab, setActiveEditorTab] = useState<'polish' | 'foreshadow' | 'history'>('polish');
  const [selectedForeshadowIds, setSelectedForeshadowIds] = useState<string[]>([]);
  const [customForeshadowInstruction, setCustomForeshadowInstruction] = useState<string>('');
  const [logicCheckingChapter, setLogicCheckingChapter] = useState<number | null>(null);
  const [logicAuditResults, setLogicAuditResults] = useState<Record<number, { consistency_score: number; conflicts: string[]; suggestions: string[] }>>({});
  const [showLogicResultForChapter, setShowLogicResultForChapter] = useState<number | null>(null);

  const lastSavedLengthRef = useRef<number>(0);
  const lastSavedTimeRef = useRef<number>(0);

  // SSE Stream generator console
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamLog, setStreamLog] = useState<{ step: string; message: string; type: 'info' | 'success' | 'warn' | 'chunk' }[]>([]);
  const streamEndRef = useRef<HTMLDivElement>(null);

  // AI Polish Workshop states
  const [polishMode, setPolishMode] = useState<'eliminate_ai' | 'expand' | 'shrink' | 'continue'>('eliminate_ai');
  const [polishInstruction, setPolishInstruction] = useState('');
  const [polishLoading, setPolishLoading] = useState(false);
  const [selectedTextForPolish, setSelectedTextForPolish] = useState('');

  // Character Creator manual trigger
  const [showManualCharDialog, setShowManualCharDialog] = useState(false);
  const [newCharName, setNewCharName] = useState('');
  const [newCharRole, setNewCharRole] = useState<'protagonist' | 'antagonist' | 'supporting'>('supporting');
  const [newCharGender, setNewCharGender] = useState('男');
  const [newCharAge, setNewCharAge] = useState('22');
  const [newCharPersonality, setNewCharPersonality] = useState('');
  const [newCharAppearance, setNewCharAppearance] = useState('');
  const [newCharGoal, setNewCharGoal] = useState('');
  const [newCharSecret, setNewCharSecret] = useState('');

  // Foreshadow Manual trigger
  const [showManualForeDialog, setShowManualForeDialog] = useState(false);
  const [customForeTitle, setCustomForeTitle] = useState('');
  const [customForeDesc, setCustomForeDesc] = useState('');
  const [customForePlanted, setCustomForePlanted] = useState(1);
  const [customForeExpected, setCustomForeExpected] = useState(10);

  // AI Novel creation recommendations state
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [recLoading, setRecLoading] = useState(false);
  const [recKeywords, setRecKeywords] = useState('');
  const [polishingTitle, setPolishingTitle] = useState(false);
  const [polishingDesc, setPolishingDesc] = useState(false);

  const handleFetchRecommendations = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setRecLoading(true);
    try {
      const response = await fetch('/api/ai/recommend-novels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          genre: newGenre,
          keywords: recKeywords
        })
      });
      if (!response.ok) {
        throw new Error('无法生成AI脑洞，可能由于网关超时或网络未连接。');
      }
      const data = await response.json();
      setRecommendations(data || []);
    } catch (err: any) {
      alert(err.message || '生成点子脑洞时发生错误');
    } finally {
      setRecLoading(false);
    }
  };

  const handlePolishText = async (type: 'title' | 'description') => {
    const textToPolish = type === 'title' ? newTitle : newDescription;
    if (typeof textToPolish !== 'string' || !textToPolish.trim()) {
      alert(`请先在输入框中输入部分您的${type === 'title' ? '拟定书名' : '创意简介/灵感点子'}！`);
      return;
    }

    if (type === 'title') setPolishingTitle(true);
    else setPolishingDesc(true);

    try {
      const response = await fetch('/api/ai/polish-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          text: textToPolish,
          genre: newGenre
        })
      });
      if (!response.ok) {
        throw new Error('润色服务暂时不可用，请稍后再试。');
      }
      const data = await response.json();
      if (data && data.polished) {
        if (type === 'title') {
          setNewTitle(data.polished || '');
        } else {
          setNewDescription(data.polished || '');
        }
      }
    } catch (err: any) {
      alert(err.message || '润色文本发生错误');
    } finally {
      if (type === 'title') setPolishingTitle(false);
      else setPolishingDesc(false);
    }
  };

  const applyRecommendation = (rec: { title: string; description: string; genre?: string }) => {
    setNewTitle(rec.title || '');
    setNewDescription(rec.description || '');
    
    // Auto map genre
    if (rec.genre) {
      const matchedGenre = GENRES.find(g => g.value === rec.genre || g.label.includes(rec.genre!) || rec.genre!.includes(g.value));
      if (matchedGenre) {
        setNewGenre(matchedGenre.value);
      } else {
        if (rec.genre.includes('科幻')) setNewGenre('硬核科幻');
        else if (rec.genre.includes('玄幻') || rec.genre.includes('仙') || rec.genre.includes('侠')) setNewGenre('仙侠玄幻');
        else if (rec.genre.includes('悬疑') || rec.genre.includes('惊') || rec.genre.includes('恐')) setNewGenre('悬疑惊悚');
        else if (rec.genre.includes('都市') || rec.genre.includes('异') || rec.genre.includes('能')) setNewGenre('都市奇能');
      }
    }
  };

  // Auto-save debounce ref
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load Novels and check API health on startup
  useEffect(() => {
    fetchNovels();
    checkHealth();
  }, []);

  // Update editor draft when active chapter changes or outline name changes
  useEffect(() => {
    if (projectData) {
      const activeCh = projectData.chapters.find(c => c.chapter_num === activeChapterNum);
      const activeOut = projectData.outline.find(o => o.chapter_num === activeChapterNum);
      setDraftContent(activeCh ? activeCh.content : '');
      setDraftTitle(activeCh ? activeCh.title : (activeOut ? activeOut.title : `第${activeChapterNum}章`));
    }
  }, [activeChapterNum, projectData]);

  // Scroll stream logs to bottom
  useEffect(() => {
    if (streamEndRef.current) {
      streamEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [streamLog]);

  const checkHealth = async () => {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setHasApiKey(data.hasApiKey);
      }
    } catch (err) {
      console.error('Failed to get health status', err);
    }
  };

  const fetchNovels = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/novels');
      if (res.ok) {
        const list = await res.json();
        setNovelsList(list);
      }
    } catch (err) {
      console.error('Error loading novels:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectProject = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/novels/${id}`);
      if (res.ok) {
        const data = await res.json();
        setProjectData(data);
        setSelectedNovelId(id);
        setCurrentView('workspace');
        // Preset first chapter available or default to 1
        if (data.outline && data.outline.length > 0) {
          setActiveChapterNum(data.outline[0].chapter_num);
        } else {
          setActiveChapterNum(1);
        }
      }
    } catch (err) {
      console.error('Error loading project details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNovel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDescription.trim()) {
      alert('请填写小说名称和创意简介！');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/novels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          description: newDescription,
          genre: newGenre,
          style: selectedStyles,
          target_words: newTargetWords,
          reference: newReference,
          model: newModel,
          language: newLang,
        }),
      });

      if (res.ok) {
        const newProj = await res.json();
        setNovelsList([newProj.novel, ...novelsList]);
        // Reset inputs
        setNewTitle('');
        setNewDescription('');
        setNewReference('');
        setSelectedStyles(['爽文', '热血']);
        // Directly enter workspace
        setProjectData(newProj);
        setSelectedNovelId(newProj.novel.id);
        setCurrentView('workspace');
        setActiveTab('bible');
      } else {
        const err = await res.json();
        alert('创建小说失败: ' + (err.error || '服务器未知错误'));
      }
    } catch (err) {
      console.error('Create novel failed', err);
      alert('网络连接错误，创建小说失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteNovel = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('确定要删除这部小说吗？所有章节、大纲及设定均会被永久清除且不可恢复！')) {
      return;
    }

    try {
      const res = await fetch(`/api/novels/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setNovelsList(novelsList.filter(n => n.id !== id));
        if (selectedNovelId === id) {
          setProjectData(null);
          setSelectedNovelId(null);
          setCurrentView('dashboard');
        }
      } else {
        alert('删除失败');
      }
    } catch (err) {
      console.error('Delete error', err);
    }
  };

  // Sync edits in Workspace with backend
  const triggerSync = (updatedProject: ProjectData) => {
    setProjectData(updatedProject);
    setSaveStatus('saving');

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/novels/${updatedProject.novel.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedProject),
        });

        if (res.ok) {
          setSaveStatus('saved');
        } else {
          setSaveStatus('error');
        }
      } catch (err) {
        console.error('Save sync failed:', err);
        setSaveStatus('error');
      }
    }, 1500); // Debounce saves with 1.5s
  };

  // ----------------------------------------
  // AI STRUCTURAL WORKFLOWS
  // ----------------------------------------

  // Generate complete Story Bible from description basic info
  const handleGenerateBible = async () => {
    if (!projectData) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/novels/${projectData.novel.id}/generate-bible`, {
        method: 'POST',
      });
      if (res.ok) {
        const updatedPackage = await res.json();
        setProjectData(updatedPackage);
        alert('✨ 恭喜！全书小说圣经(Story Bible)已生成。包含主题、地理风俗、力量规则和结局思路，快去查看吧！');
      } else {
        const err = await res.json();
        alert('圣经生成异常: ' + (err.error || '请稍后再试'));
      }
    } catch (err) {
      console.error('Bible gen failed:', err);
      alert('连接超时，请检查后再次触发生成。');
    } finally {
      setLoading(false);
    }
  };

  // Generate 4 Character profiles
  const handleGenerateCharacters = async () => {
    if (!projectData) return;
    // Check if Bible has been initialized
    if (!projectData.storyBible.rules && !projectData.storyBible.theme) {
      alert('请先一键创作【小说圣经】以铺奠叙事世界的基础！');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/novels/${projectData.novel.id}/generate-characters`, {
        method: 'POST',
      });
      if (res.ok) {
        const updatedPackage = await res.json();
        setProjectData(updatedPackage);
        alert('✨ 名宿班底生成完毕！主角、反打、两位黄金配角的设计全副武装，已加入名单。');
      } else {
        const err = await res.json();
        alert('角色生成错误: ' + (err.error || '服务器繁忙'));
      }
    } catch (err) {
      console.error('Char gen failed:', err);
    } finally {
      setLoading(false);
    }
  };

  // Generate multi-chapter Outline
  const handleGenerateOutline = async (chapterCount: number) => {
    if (!projectData) return;
    if (projectData.characters.length === 0) {
      alert('小说人物库为空，请先【一键生成四主角】或者手动添加一些角色，大纲才知道谁会上演冲突！');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/novels/${projectData.novel.id}/generate-outline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chaptersCount: chapterCount }),
      });
      if (res.ok) {
        const updatedPackage = await res.json();
        setProjectData(updatedPackage);
        if (updatedPackage.outline && updatedPackage.outline.length > 0) {
          setActiveChapterNum(updatedPackage.outline[0].chapter_num);
        }
        alert(`✨ ${chapterCount}章 经典三幕式长篇小说大纲骨架打造成功！快去左下侧“分章大纲”浏览。`);
      } else {
        const err = await res.json();
        alert('大纲策划失败: ' + (err.error || '系统超时'));
      }
    } catch (err) {
      console.error('Outline failed:', err);
    } finally {
      setLoading(false);
    }
  };

  // Dynamically launch Stream Writer with SSE
  const handleStreamChapters = async () => {
    if (!projectData) return;
    const activeOutline = projectData.outline.find(o => o.chapter_num === activeChapterNum);
    if (!activeOutline) {
      alert('请先在【剧情大纲】板块中一键生成大纲或手动添加第' + activeChapterNum + '章大纲，以便让AI知道本章的情敌冲突和高潮爆发点！');
      return;
    }

    setIsGenerating(true);
    setStreamLog([]);

    // Gather selected foreshadowing cues to feed to SSE
    const selectedForeshadows = projectData.foreshadows.filter(f => selectedForeshadowIds.includes(f.id));
    let customInstructions = "";
    if (selectedForeshadows.length > 0) {
      customInstructions = "【本章特别指定呼应回收以下伏笔线索，请务必在剧情正文中具体设计对应的情景回应！】:\n" +
        selectedForeshadows.map(f => `- 伏笔大意：${f.title} (设于第${f.planted_chapter}章)：${f.description}`).join("\n");
    }
    if (customForeshadowInstruction.trim()) {
      customInstructions += (customInstructions ? "\n\n" : "") + `【作者特定额外写作指导】：\n${customForeshadowInstruction.trim()}`;
    }

    try {
      // Create connection
      const sseUrl = `/api/novels/${projectData.novel.id}/chapters/generate-stream?chapter_num=${activeChapterNum}&custom_instructions=${encodeURIComponent(customInstructions)}`;
      const response = await fetch(sseUrl);
      if (!response.ok) {
        throw new Error('无法连接生成服务器，请检查 API Key。');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let activeText = '';

      if (!reader) {
        throw new Error('流读取器初始化失败。');
      }

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        // Retain last unfinished segment inside buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue;
          
          try {
            const dataStr = line.replace(/^data:\s*/, '');
            const payload = JSON.parse(dataStr);

            if (payload.type === 'progress') {
              setStreamLog(prev => [
                ...prev, 
                { step: payload.step, message: payload.message, type: 'info' }
              ]);
            } else if (payload.type === 'chunk') {
              activeText += payload.content;
              setDraftContent(activeText); // Realtime typewriter rendering in preview
            } else if (payload.type === 'done') {
              setStreamLog(prev => [
                ...prev,
                { step: 'completed', message: `🎉 生成圆满成功！整章正文共: ${payload.word_count} 字。核心剧情摘要、未解新伏笔已自动关联更新！`, type: 'success' }
              ]);
              setIsGenerating(false);
              // Reload fully updated novel package state in local memory to sync counters and statuses
              setTimeout(() => selectProject(projectData.novel.id), 1200);
            } else if (payload.type === 'error') {
              setStreamLog(prev => [
                ...prev,
                { step: 'error', message: `❌ 生成失败: ${payload.message}`, type: 'warn' }
              ]);
              setIsGenerating(false);
            }
          } catch (e) {
            console.error('SSE Line parser failed:', e);
          }
        }
      }
    } catch (err: any) {
      console.error('Stream reader error', err);
      setStreamLog(prev => [...prev, { step: 'error', message: `❌ 连接错误: ${err.message || '连接异常中断'}`, type: 'warn' }]);
      setIsGenerating(false);
    }
  };

  // AI Polish panel actions (Condense, Expand, Eliminate AI, Continue rewriting)
  const handleAIPolishSelection = async (mode: 'eliminate_ai' | 'expand' | 'shrink' | 'continue') => {
    if (!projectData) return;
    
    // Choose what content to process: selected text or full chapter
    const textToProcess = selectedTextForPolish.trim() || draftContent.trim();
    if (!textToProcess) {
      alert('请在文本框中输入/选中一些需要操作的小说段落，再选择抛光模式！');
      return;
    }

    setPolishLoading(true);
    try {
      const res = await fetch(`/api/novels/${projectData.novel.id}/chapters/polish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: textToProcess,
          mode: mode,
          instructions: polishInstruction
        }),
      });

      if (res.ok) {
        const result = await res.json();
        
        if (selectedTextForPolish.trim()) {
          // Replace selected segment only
          const replaced = draftContent.replace(selectedTextForPolish, result.polishedText);
          handleUpdateChapterContent(replaced);
          alert('✨ 局部抛光磨练完成！已完成原文替换。');
        } else {
          // Replace full story
          handleUpdateChapterContent(result.polishedText);
          alert('✨ 整段消重打磨/增色创作完毕！已同步修改。');
        }
        setPolishInstruction('');
        setSelectedTextForPolish('');
      } else {
        const err = await res.json();
        alert('打磨处理遭遇卡顿: ' + (err.error || '请联系后台。'));
      }
    } catch (err) {
      console.error('Polish error', err);
    } finally {
      setPolishLoading(false);
    }
  };

  // Save specific chapter content snapshot to prevent data losses
  const saveSnapToMetadata = (chapterNum: number, content: string, triggerType: 'manual' | 'ai' | 'auto') => {
    if (!projectData) return;
    const updatedChaps = [...projectData.chapters];
    const idx = updatedChaps.findIndex(c => c.chapter_num === chapterNum);
    if (idx === -1) return;

    const currentCh = updatedChaps[idx];
    const snapshots = currentCh.snapshots || [];

    // Avoid duplicate snapshot of identical content
    if (snapshots.length > 0 && snapshots[snapshots.length - 1].content === content) return;

    const newSnap = {
      id: 'snap_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
      content,
      word_count: content.length,
      trigger_type: triggerType
    };

    const updatedSnaps = [...snapshots, newSnap];
    // Keep max 25 snapshots to avoid exceeding standard storage
    if (updatedSnaps.length > 25) {
      updatedSnaps.shift();
    }

    updatedChaps[idx] = {
      ...currentCh,
      snapshots: updatedSnaps
    };

    const latestPackage = {
      ...projectData,
      chapters: updatedChaps
    };
    triggerSync(latestPackage);
  };

  // Helper to change local chapter state & auto sync
  const handleUpdateChapterContent = (newContent: string) => {
    if (!projectData) return;
    setDraftContent(newContent);
    
    const updatedChaps = [...projectData.chapters];
    const index = updatedChaps.findIndex(c => c.chapter_num === activeChapterNum);
    
    if (index > -1) {
      updatedChaps[index] = {
        ...updatedChaps[index],
        content: newContent,
        word_count: newContent.length
      };
    } else {
      updatedChaps.push({
        id: 'chap_' + Date.now(),
        novel_id: projectData.novel.id,
        chapter_num: activeChapterNum,
        title: draftTitle,
        content: newContent,
        word_count: newContent.length,
        status: 'approved',
        created_at: new Date().toISOString()
      });
    }

    const latestPackage: ProjectData = {
      ...projectData,
      chapters: updatedChaps,
    };
    // Sync words counter
    latestPackage.novel.current_words = updatedChaps.reduce((sum, ch) => sum + (ch.word_count || 0), 0);
    triggerSync(latestPackage);

    // Initial check values
    if (lastSavedLengthRef.current === 0) {
      lastSavedLengthRef.current = newContent.length;
      lastSavedTimeRef.current = Date.now();
    }

    // Auto-save logic: if difference is > 150 characters, OR if more than 3 minutes have passed since last save
    const now = Date.now();
    const lenDiff = Math.abs(newContent.length - lastSavedLengthRef.current);
    const timeDiff = now - lastSavedTimeRef.current;
    if (lenDiff > 150 || (timeDiff > 180000 && lenDiff > 15)) {
      saveSnapToMetadata(activeChapterNum, newContent, 'auto');
      lastSavedLengthRef.current = newContent.length;
      lastSavedTimeRef.current = now;
    }
  };

  // Trigger Gemini Logical conflict analyzer
  const handleCheckLogic = async (chapterNum: number) => {
    if (!projectData) return;
    setLogicCheckingChapter(chapterNum);
    try {
      const response = await fetch(`/api/novels/${projectData.novel.id}/check-logic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapter_num: chapterNum })
      });
      if (response.ok) {
        const result = await response.json();
        setLogicAuditResults(prev => ({
          ...prev,
          [chapterNum]: result
        }));
        setShowLogicResultForChapter(chapterNum);
      } else {
        const err = await response.json();
        alert('逻辑审计服务升级保养中: ' + (err.error || '无法完成审计。'));
      }
    } catch (err: any) {
      console.error('Logic audit error', err);
      alert('连接异常，审计引擎遇到错误。');
    } finally {
      setLogicCheckingChapter(null);
    }
  };

  // Live narrative beat chronological bubble generator
  const getNarrativeBeats = (content: string) => {
    if (!content) return [];
    // Split content by single/double line returns to identify paragraphs
    const paragraphs = content.split(/\n+/).map(p => p.trim()).filter(p => p.length > 20);
    
    return paragraphs.map((para, idx) => {
      // Pick dynamic visual badge matching the narrative tone
      let icon = "💡";
      if (/剑|刀|斩|杀|死|轰|拳|战|血|爆|斗|攻|指|力|元/.test(para)) {
        icon = "⚔️";
      } else if (/笑|道|说|呵|喊|叹|语|咬/.test(para)) {
        icon = "💬";
      } else if (/走|步|入|殿|阁|城|山|林|空|踏|见/.test(para)) {
        icon = "🗺️";
      } else if (/经|法|魔|灵|盘|盾|气|转|级|诀/.test(para)) {
        icon = "✨";
      }

      // Sentence separator: periods, exclamation marks, or quest markers
      const sentences = para.split(/[。！？]/);
      let title = sentences[0]?.trim() || para.substring(0, 30);
      if (title.length > 42) {
        title = title.substring(0, 42) + "...";
      }
      
      const beatLabels = ["落墨开局", "起步蓄势", "阻力浮面", "激辩交锋", "破晓而出", "石破天惊", "悬念钩尾"];
      const beatTag = beatLabels[idx] || "剧情推演";

      return {
        id: idx,
        beatName: `${beatTag} #${idx + 1}`,
        icon,
        summary: title,
        contentLen: para.length
      };
    });
  };

  const handleUpdateChapterTitle = (newChTitle: string) => {
    setDraftTitle(newChTitle);
    if (!projectData) return;
    
    // Update Chapter document
    const updatedChaps = [...projectData.chapters];
    const idx = updatedChaps.findIndex(c => c.chapter_num === activeChapterNum);
    if (idx > -1) {
      updatedChaps[idx].title = newChTitle;
    }

    // Update corresponding Outline item if present
    const updatedOutline = [...projectData.outline];
    const outIdx = updatedOutline.findIndex(o => o.chapter_num === activeChapterNum);
    if (outIdx > -1) {
      updatedOutline[outIdx].title = newChTitle;
    }

    triggerSync({
      ...projectData,
      chapters: updatedChaps,
      outline: updatedOutline
    });
  };

  const handleBibleFieldChange = (field: keyof StoryBible, value: any) => {
    if (!projectData) return;
    const updatedBible = {
      ...projectData.storyBible,
      [field]: value
    };
    triggerSync({
      ...projectData,
      storyBible: updatedBible
    });
  };

  const handleAddFactions = () => {
    if (!projectData) return;
    const updatedFactions = [...projectData.storyBible.factions, { name: '新势力', description: '介绍和目的', stance: '中立' }];
    handleBibleFieldChange('factions', updatedFactions);
  };

  const handleRemoveFaction = (idx: number) => {
    if (!projectData) return;
    const updatedFactions = projectData.storyBible.factions.filter((_, i) => i !== idx);
    handleBibleFieldChange('factions', updatedFactions);
  };

  const handleFactionChange = (idx: number, key: string, value: string) => {
    if (!projectData) return;
    const updated = projectData.storyBible.factions.map((f, i) => {
      if (i === idx) return { ...f, [key]: value };
      return f;
    });
    handleBibleFieldChange('factions', updated);
  };

  const handleAddLocation = () => {
    if (!projectData) return;
    const updatedL = [...projectData.storyBible.locations, { name: '要地名', description: '地点环境描写' }];
    handleBibleFieldChange('locations', updatedL);
  };

  const handleLocationChange = (idx: number, key: string, value: string) => {
    if (!projectData) return;
    const updated = projectData.storyBible.locations.map((loc, i) => {
      if (i === idx) return { ...loc, [key]: value };
      return loc;
    });
    handleBibleFieldChange('locations', updated);
  };

  const handleAddManualCharacter = () => {
    if (!projectData || !newCharName.trim()) return;

    const newChar: Character = {
      id: 'char_' + Date.now(),
      name: newCharName,
      role: newCharRole,
      gender: newCharGender,
      age: newCharAge,
      appearance: newCharAppearance || '端详不凡，英姿飒飒。',
      personality: newCharPersonality || '行事沉稳，内心有重重挂虑。',
      goal: newCharGoal || '追逐大道本源，解救昔日爱人。',
      secret: newCharSecret || '背负神魔残骸之诅咒。',
      growth_arc: '心智逐渐成熟，明白责任与牺牲。',
      catchphrase: '“乾坤未定，你我皆是黑马。”',
      background: '出生在一个平凡宗门，后来离经叛道。',
      current_status: '活跃',
      relationships: {}
    };

    const updatedChars = [...projectData.characters, newChar];
    triggerSync({
      ...projectData,
      characters: updatedChars
    });

    // Reset Character Inputs
    setNewCharName('');
    setNewCharPersonality('');
    setNewCharAppearance('');
    setNewCharGoal('');
    setNewCharSecret('');
    setShowManualCharDialog(false);
  };

  const handleRemoveCharacter = (id: string) => {
    if (!projectData) return;
    if (!confirm('确定要删除这名角色卡吗？')) return;
    const updated = projectData.characters.filter(c => c.id !== id);
    triggerSync({ ...projectData, characters: updated });
  };

  const handleUpdateCharacterDetails = (idx: number, field: keyof Character, value: any) => {
    if (!projectData) return;
    const updatedChars = projectData.characters.map((c, i) => {
      if (idx === i) {
        return { ...c, [field]: value };
      }
      return c;
    });
    triggerSync({
      ...projectData,
      characters: updatedChars
    });
  };

  const handleUpdateCharactersList = (updatedChars: Character[]) => {
    if (!projectData) return;
    triggerSync({
      ...projectData,
      characters: updatedChars
    });
  };

  // Outline direct modifications
  const handleOutlineCellChange = (chapterNum: number, field: keyof OutlineItem, value: any) => {
    if (!projectData) return;
    const updated = projectData.outline.map(o => {
      if (o.chapter_num === chapterNum) {
        if (field === 'characters') {
          // split by comma or space
          const cleanValue = typeof value === 'string' ? value.split(/[,，\s]+/).filter(Boolean) : value;
          return { ...o, [field]: cleanValue };
        }
        return { ...o, [field]: value };
      }
      return o;
    });
    triggerSync({ ...projectData, outline: updated });
  };

  const handleAddManualOutlineRow = () => {
    if (!projectData) return;
    const nextNum = projectData.outline.reduce((max, r) => Math.max(max, r.chapter_num), 0) + 1;
    const newRow: OutlineItem = {
      chapter_num: nextNum,
      title: `第${nextNum}章 崭新起航`,
      goal: '推动故事进入一阶段冲突中心。',
      conflict: '主角遭遇宗门长老或凡俗敌视势力伏击。',
      climax: '亮出前章获取绝密王牌并将其一举挫败。',
      hook: '伏击者临死前吐露出有关天机城被包围之噩耗，逼迫主角上马奔袭支援。',
      characters: projectData.characters.length > 0 ? [projectData.characters[0].name] : ['张小凡'],
      location: '荒芜落叶林',
      status: 'pending'
    };

    triggerSync({
      ...projectData,
      outline: [...projectData.outline, newRow]
    });
  };

  const handleAddManualForeshadow = () => {
    if (!projectData || !customForeTitle.trim() || !customForeDesc.trim()) return;
    
    const newFore: Foreshadow = {
      id: 'fore_' + Date.now(),
      title: customForeTitle,
      description: customForeDesc,
      planted_chapter: Number(customForePlanted) || 1,
      resolve_chapter: Number(customForeExpected) || 10,
      status: 'open'
    };

    triggerSync({
      ...projectData,
      foreshadows: [...projectData.foreshadows, newFore]
    });

    setCustomForeTitle('');
    setCustomForeDesc('');
    setShowManualForeDialog(false);
  };

  const handleToggleForeshadowStatus = (fid: string) => {
    if (!projectData) return;
    const updated = projectData.foreshadows.map(f => {
      if (f.id === fid) {
        const nextStatus = f.status === 'open' ? 'resolved' : 'open';
        return { 
          ...f, 
          status: nextStatus,
          resolved_at: nextStatus === 'resolved' ? activeChapterNum : undefined
        };
      }
      return f;
    });
    triggerSync({ ...projectData, foreshadows: updated });
  };

  const handleTextareaSelection = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement;
    const selected = target.value.substring(target.selectionStart, target.selectionEnd);
    if (selected.length > 3) {
      setSelectedTextForPolish(selected);
    } else {
      setSelectedTextForPolish('');
    }
  };

  // Calculate generic progress
  const getProgressPercentage = (novel: Novel) => {
    if (!novel.target_words) return 0;
    const percent = Math.round((novel.current_words / novel.target_words) * 100);
    return Math.min(percent, 100);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans flex flex-col antialiased selection:bg-amber-500 selection:text-slate-900">
      
      {/* GLOBAL NAVBAR HEADER */}
      <header className="border-b border-slate-800 bg-slate-950 px-6 py-4 flex items-center justify-between sticky top-0 z-50 shadow-md">
        <div className="flex items-center gap-3">
          <div className="bg-amber-500 text-slate-950 p-2 rounded-lg font-bold flex items-center justify-center shadow-lg">
            <Feather size={20} className="stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wide bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-500 bg-clip-text text-transparent">
              AI Novel Studio
            </h1>
            <p className="text-xs text-slate-400 tracking-wider">AI·长篇小说骨架大纲与连贯章节生成工坊</p>
          </div>
        </div>

        {/* Global actions */}
        <div className="flex items-center gap-4">
          {/* Health badge */}
          {hasApiKey ? (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              Gemini AI 已启用
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <span className="h-2 w-2 rounded-full bg-rose-400" />
              未配置 API 密钥
            </span>
          )}

          {currentView === 'workspace' && projectData && (
            <div className="flex items-center gap-2">
              {/* Auto saving status badge */}
              <span className={`text-xs px-2 py-1 rounded transition-colors ${
                saveStatus === 'saving' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                saveStatus === 'error' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                'bg-slate-800 text-slate-400 border border-slate-700/60'
              }`}>
                {saveStatus === 'saving' ? '💾 正在同步...' : saveStatus === 'error' ? '🔺 同步异常' : '✓ 设定已保存'}
              </span>

              <button 
                onClick={() => setCurrentView('dashboard')}
                className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border border-slate-700"
              >
                <ArrowLeft size={14} /> 返回总览
              </button>
            </div>
          )}
        </div>
      </header>

      {/* RENDER VIEW: 1. DASHBOARD */}
      {currentView === 'dashboard' && (
        <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8 space-y-8">
          
          {/* API SECRET ERROR NOTICE */}
          {!hasApiKey && (
            <div className="bg-rose-950/40 border border-rose-500/30 text-rose-200 rounded-xl p-5 flex items-start gap-4 shadow-xl">
              <AlertTriangle className="text-rose-400 flex-shrink-0 mt-0.5" size={24} />
              <div className="space-y-1">
                <h4 className="font-semibold text-rose-300">💡 监测到您的 Gemini API Key 未设置</h4>
                <p className="text-sm text-rose-400/90 leading-relaxed">
                  请访问 AI Studio 右上角的 <strong>Secrets Panel</strong> 配置名称为 <strong>GEMINI_API_KEY</strong> 的个人密钥，刷新本页面加载。这将激活后端极速分章大纲和 SSE 流式文字创作等全部 AI 大模型引擎。
                </p>
              </div>
            </div>
          )}

          {/* WELCOME BANNER & STATS */}
          <section className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 rounded-2xl p-6 md:p-8 border border-slate-850 shadow-2xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <span className="px-3 py-1 bg-amber-500/10 text-amber-400 rounded-full text-xs font-semibold tracking-wider uppercase border border-amber-500/20">
                AI Novelist Workshop
              </span>
              <h2 className="text-2xl md:text-3.5xl font-extrabold tracking-tight text-white font-serif">
                创作真正连贯的长篇叙事
              </h2>
              <p className="text-slate-400 text-sm md:text-base leading-relaxed">
                彻底告别断章、设定冲突和拼凑感。通过小说圣经奠置一贯规则，分章细化冲突高潮，并辅以伏笔暗线追踪。AI 与创作者协同打磨百余章的小说流水线。
              </p>
            </div>
            
            <button 
              onClick={() => setCurrentView('create')}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 px-6 py-4 rounded-xl font-bold shadow-lg shadow-amber-500/10 hover:shadow-amber-500/20 transform hover:-translate-y-0.5 transition-all text-sm self-start md:self-center"
            >
              <Plus size={18} className="stroke-[3]" /> 策划一部新长篇
            </button>
          </section>

          {/* PROJECT LIST */}
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold font-serif flex items-center gap-2">
                <BookOpen size={18} className="text-amber-500" />
                我的小说项目库 ({novelsList.length})
              </h3>
              <p className="text-xs text-slate-500">所有修改即时本地存储存盘</p>
            </div>

            {loading ? (
              <div className="py-20 text-center space-y-3">
                <RefreshCw size={36} className="animate-spin text-amber-500 mx-auto" />
                <p className="text-slate-400 text-sm">正在加载书架中的精雕原稿...</p>
              </div>
            ) : novelsList.length === 0 ? (
              <div className="border border-dashed border-slate-800 rounded-2xl p-12 text-center max-w-xl mx-auto space-y-4">
                <div className="bg-slate-950 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto text-slate-600">
                  <Feather size={28} />
                </div>
                <div className="space-y-1">
                  <h4 className="font-semibold text-slate-200">书架空空如也</h4>
                  <p className="text-xs text-slate-400">目前还没有任何连载大纲小说。点击右侧或下方创建首部恢弘大作。</p>
                </div>
                <button 
                  onClick={() => setCurrentView('create')}
                  className="bg-slate-800 text-amber-400 hover:bg-slate-700 border border-amber-500/10 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                >
                  立即策划第一部书
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {novelsList.map((novel) => {
                  const progress = getProgressPercentage(novel);
                  return (
                    <div 
                      key={novel.id}
                      onClick={() => selectProject(novel.id)}
                      className="group bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/30 rounded-xl p-5 flex flex-col justify-between gap-5 cursor-pointer shadow-lg hover:shadow-xl transition-all relative overflow-hidden"
                    >
                      {/* Gradient hover highlight corner */}
                      <span className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-tr-xl" />

                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <span className="px-2.5 py-0.5 bg-slate-800 text-amber-400 border border-slate-700 rounded text-xs">
                            {novel.genre}
                          </span>
                          <button 
                            onClick={(e) => handleDeleteNovel(novel.id, e)}
                            className="text-slate-600 hover:text-rose-400 p-1 rounded-md hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100"
                            title="废弃该项目"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>

                        <div>
                          <h4 className="text-lg font-bold text-white group-hover:text-amber-400 font-serif leading-snug transition-colors line-clamp-1">
                            {novel.title}
                          </h4>
                          <p className="text-xs text-slate-400 line-clamp-2 mt-1 min-h-[2rem]">
                            {novel.description}
                          </p>
                        </div>
                      </div>

                      {/* Word progress indicator */}
                      <div className="space-y-2 pt-3 border-t border-slate-850">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400 flex items-center gap-1">
                            <Clock size={12} className="text-amber-500/70" />
                            已成: <strong className="text-slate-200">{(novel.current_words / 1000).toFixed(1)}k</strong> / {(novel.target_words / 10000).toFixed(0)}万字
                          </span>
                          <span className="text-amber-400 font-semibold">{progress}%</span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-gradient-to-r from-amber-500 to-yellow-400 h-1.5 rounded-full transition-all duration-500" 
                            style={{ width: `${progress}%` }} 
                          />
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 truncate pr-2">
                          <span className="truncate w-32" title={novel.model}>{novel.model}</span>
                          <span className="flex items-center gap-0.5 font-medium group-hover:text-amber-400 transition-colors shrink-0">
                            进入创作大厅 <ChevronRight size={12} />
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </main>
      )}

      {/* RENDER VIEW: 2. INTAKE FORM (CREATE NOVEL) */}
      {currentView === 'create' && (
        <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8">
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="space-y-1">
                <h3 className="text-xl font-bold font-serif text-white">新小说项目筹划大王</h3>
                <p className="text-xs text-slate-400">我们将基于这套基本信息通过大模型为您构筑独一无二的世界圣经底谱</p>
              </div>
              <button 
                onClick={() => setCurrentView('dashboard')}
                className="text-slate-400 hover:text-white flex items-center gap-1 text-xs"
              >
                <ArrowLeft size={14} /> 取消返回
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* LEFT COLUMN: Main Intake Form */}
              <div className="lg:col-span-7 space-y-6">
                <form onSubmit={handleCreateNovel} className="space-y-6">
                  {/* TITLE */}
                  <div className="bg-slate-950 p-6 rounded-xl border border-slate-850 space-y-3">
                    <div className="flex justify-between items-center flex-wrap gap-2">
                      <label className="block text-sm font-semibold text-slate-200">
                        设定小说名称 <span className="text-rose-400">*</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            if (recLoading) return;
                            setRecLoading(true);
                            try {
                              const res = await fetch('/api/ai/recommend-novels', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ genre: newGenre || "仙侠玄幻", keywords: "热血商业爆款" })
                              });
                              if (!res.ok) throw new Error();
                              const list = await res.json();
                              if (list && list.length > 0) {
                                const choice = list[Math.floor(Math.random() * list.length)];
                                setNewTitle(choice.title.replace(/《|》/g, ''));
                                alert(`💡 AI 推荐爆款书名成功已为您自动设定：\n\n${choice.title}\n\n点子卖点：${choice.highlight}`);
                              }
                            } catch (e) {
                              alert("AI推荐书名超时，请稍后重试");
                            } finally {
                              setRecLoading(false);
                            }
                          }}
                          disabled={recLoading}
                          className="px-2.5 py-1 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 rounded text-xs font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          title="AI 自动推荐一个适合该流派、充满商业戏剧张力的吸引人书名"
                        >
                          <Sparkles size={11} />
                          AI 爆款书名推荐
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePolishText('title')}
                          disabled={polishingTitle || !newTitle.trim()}
                          className={`px-3 py-1 rounded text-xs font-bold transition-all flex items-center gap-1 border ${
                            newTitle.trim()
                              ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/20 cursor-pointer'
                              : 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed'
                          }`}
                          title="输入草拟书名，AI为您深度打磨具有商业悬念的新高度书名"
                        >
                          {polishingTitle ? (
                            <>
                              <RefreshCw size={11} className="animate-spin text-amber-500" />
                              重构润色中...
                            </>
                          ) : (
                            <>
                              <Sparkles size={11} />
                              智能名号重塑
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">不要使用过于夸张、非人性的标签。起一个有逼格和张力的名字。</p>
                    <input 
                      type="text" 
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="例如：《天尊归来：从零点开始斩神》、《赛博纪：终末之手》"
                      className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-lg px-4 py-3 text-sm text-slate-200 focus:outline-none"
                      required
                    />
                  </div>

                  {/* INTRO STORY SEED */}
                  <div className="bg-slate-950 p-6 rounded-xl border border-slate-850 space-y-3">
                    <div className="flex justify-between items-center flex-wrap gap-2">
                      <label className="block text-sm font-semibold text-slate-200">
                        创意简介 / 故事金点子种子 <span className="text-rose-400">*</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            if (recLoading) return;
                            setRecLoading(true);
                            try {
                              const res = await fetch('/api/ai/recommend-novels', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ genre: newGenre || "仙侠玄幻", keywords: "高能爽爆新奇金点子" })
                              });
                              if (!res.ok) throw new Error();
                              const list = await res.json();
                              if (list && list.length > 0) {
                                const choice = list[Math.floor(Math.random() * list.length)];
                                setNewDescription(choice.description);
                                if (!newTitle) {
                                  setNewTitle(choice.title.replace(/《|》/g, ''));
                                }
                                alert(`💡 AI 故事金点子推荐成功！\n\n推荐设定配名：${choice.title}\n\n主角动机与大纲设定：\n${choice.description}\n\n核心冲突：${choice.core_conflict}\n\n读者吸睛爽点：${choice.highlight}`);
                              }
                            } catch (e) {
                              alert("AI推荐点子种子超时，请稍后重试");
                            } finally {
                              setRecLoading(false);
                            }
                          }}
                          disabled={recLoading}
                          className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded text-xs font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          title="根据所选细分流派题材，AI 自动调控最新畅销脑洞种子与爽文机制"
                        >
                          <Sparkles size={11} />
                          AI 金点子推荐
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePolishText('description')}
                          disabled={polishingDesc || !newDescription.trim()}
                          className={`px-3 py-1 rounded text-xs font-bold transition-all flex items-center gap-1 border ${
                            newDescription.trim()
                              ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/20 cursor-pointer'
                              : 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed'
                          }`}
                          title="输入少许背景或一句话，AI将智能扩写、填充细节爽点，提炼核心设定"
                        >
                          {polishingDesc ? (
                            <>
                              <RefreshCw size={11} className="animate-spin text-amber-500" />
                              大纲拓荒中...
                            </>
                          ) : (
                            <>
                              <Sparkles size={11} />
                              AI 大纲扩写升华
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">极力建议输入 50-200 字的故事简介、核心冲突点，例如主角的金手指能力、宿命危机、仇人或所处门派。字数越多世界观生成越传神！</p>
                    <textarea 
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      rows={4}
                      placeholder="例如：陈默本是天机城落魄世家之子，因意外激活太古魔种被全族排挤。他的神海中复苏了一枚可以复制诸天万界神魔秘术的‘天魔灵镜’。现在神魔教主即将在10年内复苏，他必须在大危机来临前，踩着世家和邪教白骨修炼到极致。"
                      className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-lg px-4 py-3 text-sm text-slate-200 focus:outline-none resize-y"
                      required
                    />
                  </div>

                  {/* GENRE GRID & SETTINGS */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* GENRE SELECTOR */}
                    <div className="bg-slate-950 p-6 rounded-xl border border-slate-850 space-y-3">
                      <label className="block text-sm font-semibold text-slate-200">主选小说题材</label>
                      <div className="space-y-2">
                        {GENRES.map((g) => (
                          <label 
                            key={g.value} 
                            className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-all ${
                              newGenre === g.value 
                                ? 'bg-amber-500/10 border-amber-500/30' 
                                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <input 
                              type="radio" 
                              name="genre" 
                              checked={newGenre === g.value}
                              onChange={() => setNewGenre(g.value)}
                              className="mt-1 accent-amber-500"
                            />
                            <div>
                              <div className={`text-xs font-bold ${newGenre === g.value ? 'text-amber-400' : 'text-slate-300'}`}>
                                {g.label}
                              </div>
                              <div className="text-[10px] text-slate-500 mt-0.5 leading-snug">{g.desc}</div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* WRITING STYLE PRESETS */}
                    <div className="space-y-6">
                      <div className="bg-slate-950 p-6 rounded-xl border border-slate-850 space-y-3">
                        <label className="block text-sm font-semibold text-slate-200">行风、调性标签设定 (多选)</label>
                        <div className="flex flex-wrap gap-2">
                          {STYLES.map((style) => {
                            const isSelected = selectedStyles.includes(style);
                            return (
                              <button
                                type="button"
                                key={style}
                                onClick={() => {
                                  if (isSelected) {
                                    setSelectedStyles(selectedStyles.filter(s => s !== style));
                                  } else {
                                    setSelectedStyles([...selectedStyles, style]);
                                  }
                                }}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                                  isSelected 
                                    ? 'bg-amber-500 text-slate-950 border-amber-500' 
                                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-705'
                                }`}
                              >
                                {style}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* WORDS & MODEL CONFIG */}
                      <div className="bg-slate-950 p-6 rounded-xl border border-slate-850 space-y-4">
                        <div>
                          <label className="block text-sm font-semibold text-slate-200 mb-1">目标总字数</label>
                          <select 
                            value={newTargetWords}
                            onChange={(e) => setNewTargetWords(Number(e.target.value))}
                            className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none"
                          >
                            <option value={100000}>10万字 (精致新锐文)</option>
                            <option value={300000}>30万字 (充沛长篇构)</option>
                            <option value={500000}>50万字 (宏大连载书)</option>
                            <option value={1000000}>100万字 (百万浩然史诗)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-slate-200 mb-1">AI 引擎模型</label>
                          <input 
                            type="text"
                            value={newModel}
                            onChange={(e) => setNewModel(e.target.value)}
                            placeholder="gemini-3.5-flash / claude-3-5-haiku-20241022"
                            className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none"
                          />
                          <p className="text-[11px] text-slate-500 mt-1">支持任何自定义模型名。如果是中转站API，还需要在右上角设置 Base URL 和 API Key。</p>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-slate-200 mb-1">参考文风/风格模仿作品 (选填)</label>
                          <input 
                            type="text"
                            value={newReference}
                            onChange={(e) => setNewReference(e.target.value)}
                            placeholder="例如：《神墓》、《诡秘之主》、《全职高手》"
                            className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none"
                          />
                        </div>
                      </div>

                    </div>

                  </div>

                  {/* ACTION BTN */}
                  <div className="pt-4 flex items-center gap-4">
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-lg cursor-pointer transform duration-150 disabled:opacity-50 text-sm"
                    >
                      {loading ? (
                        <>
                          <RefreshCw size={16} className="animate-spin" />
                          创建数据库实体中...
                        </>
                      ) : (
                        <>
                          <Sparkles size={16} />
                          开始规划并生成全套小说设定
                        </>
                      )}
                    </button>
                  </div>

                </form>
              </div>

              {/* RIGHT COLUMN: AI Golden Sparks Pool */}
              <div className="lg:col-span-5 bg-slate-950/80 p-6 rounded-xl border border-slate-850 space-y-5 lg:sticky lg:top-6">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-amber-500">
                    <Sparkles size={18} />
                    <h4 className="text-sm font-bold text-slate-200">AI 爆款小说灵感库</h4>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    如果没想好书名或核心点子，提供灵感词，AI 立即为您构思 3 套商业爆款提案。
                  </p>
                </div>

                <form onSubmit={handleFetchRecommendations} className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-400 block">灵感关键词 / 特定机制 (选填)</label>
                    <input 
                      type="text"
                      value={recKeywords}
                      onChange={(e) => setRecKeywords(e.target.value)}
                      placeholder="例如：长生法、系统、宗门掠夺、吞噬升级"
                      className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none"
                    />
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {['暗黑仙侠', '万界天盾', '宿命吞噬', '长生苟道', '反套路剧透'].map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setRecKeywords(tag)}
                        className={`px-2 py-0.5 rounded text-[10px] border transition-all cursor-pointer ${
                          recKeywords === tag
                            ? 'bg-amber-500/25 border-amber-500/40 text-amber-400'
                            : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-300'
                        }`}
                      >
                        #{tag}
                      </button>
                    ))}
                  </div>

                  <button
                    type="submit"
                    disabled={recLoading}
                    className="w-full bg-slate-900 hover:bg-slate-850 text-amber-500 hover:text-amber-400 border border-amber-500/20 hover:border-amber-500/40 rounded-lg py-2.5 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {recLoading ? (
                      <>
                        <RefreshCw size={12} className="animate-spin text-amber-500" />
                        爆款灵感酝酿中...
                      </>
                    ) : (
                      <>
                        <Sparkles size={12} />
                        一键爆款提案推荐 (生成 3 套)
                      </>
                    )}
                  </button>
                </form>

                <div className="border-t border-slate-900/60 pt-4">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-900">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">点子脑洞库提案</span>
                    {recommendations.length > 0 && (
                      <span className="text-[10px] text-amber-400/80 font-semibold">生成 3 组推荐方案</span>
                    )}
                  </div>

                  {(!Array.isArray(recommendations) || recommendations.length === 0) ? (
                    <div className="text-center py-10 px-4 bg-slate-900/40 rounded-xl border border-slate-850 space-y-3">
                      <div className="text-slate-600 flex justify-center"><BookOpen size={28} className="animate-pulse" /></div>
                      <div className="space-y-1">
                        <h5 className="text-xs font-bold text-slate-400">目前提案库空空如也</h5>
                        <p className="text-[10px] text-slate-500 leading-relaxed max-w-xs mx-auto">
                          在上方输入标签/灵感关键词并生成。AI 将根据当前的网文爽点为您量身定做！
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-[460px] overflow-y-auto pr-1">
                      {recommendations.map((rec, idx) => (
                        <div 
                          key={idx} 
                          className="bg-slate-900/80 border border-slate-850 hover:border-amber-500/20 p-4 rounded-xl space-y-2.5 transition-all relative group shadow-sm"
                        >
                          <div className="flex justify-between items-center">
                            <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded text-[9px] font-bold">
                              {rec.genre}
                            </span>
                            <span className="text-[10px] text-slate-600 font-mono">提案 #{idx + 1}</span>
                          </div>

                          <div>
                            <h4 className="text-sm font-bold text-amber-400 font-serif leading-snug">
                              {rec.title}
                            </h4>
                            <p className="text-[11px] text-slate-400 leading-relaxed mt-1 line-clamp-4">
                              {rec.description}
                            </p>
                          </div>

                          <div className="space-y-1 pt-2 border-t border-slate-850 text-[10px]">
                            <div className="flex items-start gap-1">
                              <span className="text-amber-500/70 shrink-0">⚔️</span>
                              <span className="text-slate-400"><strong className="text-slate-300">核心对峙:</strong> {rec.core_conflict}</span>
                            </div>
                            <div className="flex items-start gap-1">
                              <span className="text-amber-500/70 shrink-0">✨</span>
                              <span className="text-slate-400"><strong className="text-slate-300">吸睛卖点:</strong> {rec.highlight}</span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => applyRecommendation(rec)}
                            className="w-full bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 rounded-lg py-1.5 text-xs font-bold transition-all flex items-center justify-center gap-1 mt-2 shadow cursor-pointer"
                          >
                            采用本提案 (一键装载书名与简介)
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </main>
      )}

      {/* RENDER VIEW: 3. MASTER WRITING WORKSPACE */}
      {currentView === 'workspace' && projectData && (
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          
          {/* SIDEBAR TABS SELECTOR */}
          <aside className="w-full md:w-56 bg-slate-950 border-r border-slate-850 flex flex-row md:flex-col justify-start md:justify-between shrink-0 p-2 md:p-3 space-x-1 md:space-x-0 md:space-y-1.5 overflow-x-auto md:overflow-x-visible">
            
            <div className="flex flex-row md:flex-col space-x-1 md:space-x-0 md:space-y-1">
              {/* Novel Meta tag overview */}
              <div className="hidden md:block p-3 bg-slate-900/50 rounded-lg border border-slate-800/60 mb-2">
                <h5 className="font-serif font-bold text-slate-200 text-sm truncate">{projectData.novel.title}</h5>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                  <span>{projectData.novel.genre}</span>
                  <span>{Math.round(projectData.novel.current_words / 1000)}k字 / 已存档</span>
                </div>
              </div>

              {/* TABS */}
              <button
                onClick={() => setActiveTab('bible')}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-colors shrink-0 ${
                  activeTab === 'bible' 
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/5' 
                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'
                }`}
              >
                <BookOpen size={14} />
                <span>📖 小说圣经</span>
              </button>

              <button
                onClick={() => setActiveTab('characters')}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-colors shrink-0 ${
                  activeTab === 'characters' 
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/5' 
                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'
                }`}
              >
                <Users size={14} />
                <span>👤 角色塑相</span>
              </button>

              <button
                onClick={() => setActiveTab('outline')}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-colors shrink-0 ${
                  activeTab === 'outline' 
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/5' 
                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'
                }`}
              >
                <Compass size={14} />
                <span>📋 剧情大纲</span>
              </button>

              <button
                onClick={() => setActiveTab('chapters')}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-colors shrink-0 ${
                  activeTab === 'chapters' 
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/5' 
                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'
                }`}
              >
                <Edit3 size={14} />
                <span>📝 章节撰写</span>
              </button>

              <button
                onClick={() => setActiveTab('foreshadow')}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-colors shrink-0 ${
                  activeTab === 'foreshadow' 
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/5' 
                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'
                }`}
              >
                <Target size={14} />
                <span>🔍 线索伏笔 <span className="text-[10px] bg-slate-800 text-slate-400 px-1 rounded-full">{projectData.foreshadows.filter(f => f.status==='open').length}</span></span>
              </button>
            </div>

            {/* Quick Export tools built directly into bottom sidebar */}
            <div className="hidden md:flex flex-col gap-2 pt-4 border-t border-slate-850 mt-auto">
              <a 
                href={`/api/novels/${projectData.novel.id}/export?format=markdown`}
                download
                className="flex items-center gap-2 justify-center bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-800 text-xs py-2 px-3 rounded-lg hover:text-amber-400 transition-colors"
                title="导出为 Markdown 文本包"
              >
                <Download size={13} />
                导出 Markdown
              </a>
              <a 
                href={`/api/novels/${projectData.novel.id}/export?format=json`}
                download
                className="flex items-center gap-2 justify-center bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-800 text-xs py-2 px-3 rounded-lg hover:text-amber-400 transition-colors"
                title="导出为全整 JSON 包"
              >
                <FileDown size={13} />
                导出全套 JSON
              </a>
            </div>
          </aside>

          {/* MAIN COLUMN CONTAINER */}
          <div className="flex-1 flex flex-col min-h-0 bg-slate-900 p-4 md:p-6 overflow-y-auto">
            
            {/* SUBTAB: 1. STORY BIBLE */}
            {activeTab === 'bible' && (
              <section className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-xl font-bold font-serif text-white">📖 世界大纲圣经 (Story Bible)</h3>
                    <p className="text-xs text-slate-400">小说宏观规则架构设定。大模型在章节生成、打磨、润色中将时刻检索并恪守这套法则约束。</p>
                  </div>
                  
                  {(!projectData.storyBible.rules && !projectData.storyBible.theme) && (
                    <button 
                      onClick={handleGenerateBible}
                      disabled={loading}
                      className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/5"
                    >
                      <Sparkles size={13} /> 一键设计小说圣经
                    </button>
                  )}
                </div>

                {(!projectData.storyBible.rules && !projectData.storyBible.theme) ? (
                  <div className="text-center py-16 bg-slate-950 rounded-xl border border-slate-850 space-y-4">
                    <div className="text-amber-500 flex justify-center"><Compass size={40} className="animate-pulse" /></div>
                    <div className="space-y-2 max-w-lg mx-auto">
                      <h4 className="font-bold text-slate-200">圣经处于草稿期</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        要生成逻辑一致、细节充实的 10-100 万字小说，必须首先构建核心设定框架（包括小说主题、硬性世界规则、势力版图等）。
                      </p>
                    </div>
                    <button
                      onClick={handleGenerateBible}
                      disabled={loading}
                      className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 px-5 py-3 rounded-xl text-xs font-bold shadow-lg"
                    >
                      ✨ AI 觉醒：一键构筑太古大纲圣经
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Theme & Tone */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-slate-950 p-5 rounded-xl border border-slate-850 space-y-2">
                        <label className="text-xs text-amber-400 font-bold uppercase tracking-wider">全书核心主题</label>
                        <textarea 
                          value={projectData.storyBible.theme}
                          onChange={(e) => handleBibleFieldChange('theme', e.target.value)}
                          rows={3}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div className="bg-slate-950 p-5 rounded-xl border border-slate-850 space-y-2">
                        <label className="text-xs text-amber-400 font-bold uppercase tracking-wider">行文基调风调</label>
                        <textarea 
                          value={projectData.storyBible.tone}
                          onChange={(e) => handleBibleFieldChange('tone', e.target.value)}
                          rows={3}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>

                    {/* Geopolitics & World view details */}
                    <div className="bg-slate-950 p-5 rounded-xl border border-slate-850 space-y-2">
                      <label className="text-xs text-amber-400 font-bold uppercase tracking-wider">世界地理、时代背景框架描述</label>
                      <textarea 
                        value={projectData.storyBible.world_view}
                        onChange={(e) => handleBibleFieldChange('world_view', e.target.value)}
                        rows={5}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    {/* Hard rules & Power level dynamics */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-slate-950 p-5 rounded-xl border border-slate-850 space-y-2">
                        <label className="text-xs text-amber-400 font-bold uppercase tracking-wider">底层硬规则机制 (物理/法理绝对限制-杜绝逻辑降智)</label>
                        <textarea 
                          value={projectData.storyBible.rules}
                          onChange={(e) => handleBibleFieldChange('rules', e.target.value)}
                          rows={4}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-250 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div className="bg-slate-950 p-5 rounded-xl border border-slate-850 space-y-2">
                        <label className="text-xs text-amber-400 font-bold uppercase tracking-wider">主角与诸天修行/特殊力量成长阶位说明</label>
                        <textarea 
                          value={projectData.storyBible.power_system}
                          onChange={(e) => handleBibleFieldChange('power_system', e.target.value)}
                          rows={4}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>

                    {/* FACTIONS */}
                    <div className="bg-slate-950 p-5 rounded-xl border border-slate-850 space-y-4">
                      <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                        <label className="text-xs text-amber-400 font-bold uppercase tracking-wider">势力版图谱</label>
                        <button 
                          onClick={handleAddFactions}
                          className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-white"
                        >
                          <Plus size={12} /> 添加宿命势力
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {projectData.storyBible.factions?.map((fac, idx) => (
                          <div key={idx} className="bg-slate-900 p-3.5 rounded-lg border border-slate-800 relative space-y-2">
                            <button
                              onClick={() => handleRemoveFaction(idx)}
                              className="absolute top-2 right-2 text-slate-500 hover:text-rose-400 p-1"
                            >
                              <X size={12} />
                            </button>
                            <input 
                              type="text" 
                              value={fac.name}
                              onChange={(e) => handleFactionChange(idx, 'name', e.target.value)}
                              className="bg-transparent text-sm font-bold text-slate-255 border-b border-slate-800 focus:border-amber-500 focus:outline-none pb-0.5"
                            />
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-[10px] text-slate-500">立场/倾向</span>
                                <input 
                                  type="text" 
                                  value={fac.stance}
                                  onChange={(e) => handleFactionChange(idx, 'stance', e.target.value)}
                                  className="w-full bg-slate-950 border border-slate-800 text-xs px-1.5 py-1 rounded text-amber-300 mt-1 focus:outline-none"
                                />
                              </div>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500">势力介绍</span>
                              <textarea 
                                value={fac.description}
                                onChange={(e) => handleFactionChange(idx, 'description', e.target.value)}
                                rows={2}
                                className="w-full bg-slate-950 border border-slate-800 text-xs px-2 py-1 rounded text-slate-300 mt-1 focus:outline-none focus:border-amber-500 resize-none"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* LOCATIONS & WEAPONS (ITEMS) GRID */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-950 p-5 rounded-xl border border-slate-855">
                      {/* Locations list */}
                      <div className="space-y-3">
                        <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                          <label className="text-xs text-amber-400 font-bold uppercase tracking-wider">地理地点明录</label>
                          <button onClick={handleAddLocation} className="text-[10px] text-amber-400 hover:text-white flex items-center gap-0.5">
                            <Plus size={11} /> 加要塞
                          </button>
                        </div>
                        <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                          {projectData.storyBible.locations?.map((loc, idx) => (
                            <div key={idx} className="bg-slate-900 p-2.5 rounded border border-slate-800/80 space-y-1">
                              <input 
                                type="text" 
                                value={loc.name}
                                onChange={(e) => handleLocationChange(idx, 'name', e.target.value)}
                                className="bg-transparent font-semibold text-xs text-slate-200 border-b border-transparent hover:border-slate-800 focus:border-amber-500 focus:outline-none"
                              />
                              <textarea 
                                value={loc.description}
                                onChange={(e) => handleLocationChange(idx, 'description', e.target.value)}
                                rows={1}
                                className="w-full bg-slate-950 border border-slate-850 text-[11px] px-1.5 py-0.5 rounded text-slate-400 focus:outline-none focus:border-amber-500"
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Ending planning */}
                      <div className="space-y-3">
                        <label className="text-xs text-amber-400 font-bold uppercase tracking-wider border-b border-slate-850 pb-2 block">终局结局走向预想</label>
                        <textarea 
                          value={projectData.storyBible.ending}
                          onChange={(e) => handleBibleFieldChange('ending', e.target.value)}
                          rows={6}
                          placeholder="主角最终击败终极反派，魔镜归于沉寂，天下飞升道重塑..."
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>

                  </div>
                )}
              </section>
            )}

            {/* SUBTAB: 2. CHARACTERS BIBLE */}
            {activeTab === 'characters' && (
              <section className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-xl font-bold font-serif text-white">👤 名家班底角色库</h3>
                    <p className="text-xs text-slate-400">登场角色设计卡。支持AI全自动演绎或自主手工润色，并自动绑定情感纽带和执念走向。</p>
                  </div>

                  <div className="flex gap-2">
                    <button 
                      onClick={() => setShowManualCharDialog(true)}
                      className="bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/10 px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 font-medium transition-colors"
                    >
                      <Plus size={13} /> 招纳新武将
                    </button>
                    {projectData.characters.length === 0 && (
                      <button 
                        onClick={handleGenerateCharacters}
                        disabled={loading}
                        className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 shadow-lg"
                      >
                        <Sparkles size={13} /> 一键设计四神设定
                      </button>
                    )}
                  </div>
                </div>

                {/* Manual Char Dialog */}
                {showManualCharDialog && (
                  <div className="bg-slate-950 p-5 rounded-xl border border-amber-500/20 max-w-lg space-y-4">
                    <h4 className="font-bold font-serif text-amber-400 text-sm">手工招纳并激活一位新角色设定</h4>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-slate-400">姓名</span>
                        <input type="text" value={newCharName} onChange={(e) => setNewCharName(e.target.value)} className="w-full bg-slate-900 rounded border border-slate-800 px-2 py-1.5 mt-1 focus:outline-none text-slate-200" placeholder="例如：李长青" />
                      </div>
                      <div>
                        <span className="text-slate-400">角色类型</span>
                        <select value={newCharRole} onChange={(e) => setNewCharRole(e.target.value as any)} className="w-full bg-slate-900 rounded border border-slate-100/10 px-2 py-1.5 mt-1 text-slate-200">
                          <option value="protagonist">主角 (Protagonist)</option>
                          <option value="antagonist">主角对手 (Antagonist)</option>
                          <option value="supporting">黄金备胎/配角 (Supporting)</option>
                        </select>
                      </div>
                      <div>
                        <span className="text-slate-400">性别</span>
                        <input type="text" value={newCharGender} onChange={(e) => setNewCharGender(e.target.value)} className="w-full bg-slate-900 rounded border border-slate-800 px-2 mt-1 focus:outline-none text-slate-200" />
                      </div>
                      <div>
                        <span className="text-slate-400">骨龄AGE</span>
                        <input type="text" value={newCharAge} onChange={(e) => setNewCharAge(e.target.value)} className="w-full bg-slate-900 rounded border border-slate-800 px-2 mt-1 focus:outline-none text-slate-200" />
                      </div>
                    </div>
                    <div className="space-y-3 text-xs">
                      <div>
                        <span className="text-slate-400">外貌神韵衣着</span>
                        <input type="text" value={newCharAppearance} onChange={(e) => setNewCharAppearance(e.target.value)} className="w-full bg-slate-900 rounded border border-slate-800 px-2 py-1 mt-1 focus:outline-none" placeholder="紫衣飘飘，腰悬三尺青锋。" />
                      </div>
                      <div>
                        <span className="text-slate-400">骨子里的性格特质</span>
                        <input type="text" value={newCharPersonality} onChange={(e) => setNewCharPersonality(e.target.value)} className="w-full bg-slate-900 rounded border border-slate-800 px-2 py-1 mt-1 focus:outline-none" placeholder="表面玩世不恭，内心极其护短。" />
                      </div>
                      <div>
                        <span className="text-slate-400">最终欲望/心向</span>
                        <input type="text" value={newCharGoal} onChange={(e) => setNewCharGoal(e.target.value)} className="w-full bg-slate-900 rounded border border-slate-800 px-2 py-1 mt-1 focus:outline-none" placeholder="寻找失联的师傅，光大门庭。" />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end pt-2 text-xs">
                      <button onClick={() => setShowManualCharDialog(false)} className="text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded hover:text-white">取消</button>
                      <button onClick={handleAddManualCharacter} className="bg-amber-500 text-slate-950 font-bold px-4 py-1.5 rounded hover:bg-amber-600 transition-colors">确认入朝</button>
                    </div>
                  </div>
                )}

                {/* Sub View Toggle Selector */}
                {projectData.characters.length > 0 && (
                  <div className="flex gap-2 bg-slate-950 p-1 rounded-lg border border-slate-800 self-start max-w-sm">
                    <button
                      onClick={() => setCharacterSubView('cards')}
                      className={`flex-1 text-center py-1.5 px-3 rounded-md text-xs font-bold transition-all ${
                        characterSubView === 'cards'
                          ? 'bg-amber-500 text-slate-950 shadow-md'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      👤 角色档案卡片 ({projectData.characters.length})
                    </button>
                    <button
                      onClick={() => setCharacterSubView('map')}
                      className={`flex-1 text-center py-1.5 px-3 rounded-md text-xs font-bold transition-all ${
                        characterSubView === 'map'
                          ? 'bg-amber-500 text-slate-950 shadow-md'
                          : 'text-slate-400 hover:text-slate-205'
                      }`}
                    >
                      🕸 人物关系动态网络图
                    </button>
                  </div>
                )}

                {projectData.characters.length === 0 ? (
                  <div className="text-center py-20 bg-slate-950 rounded-xl border border-slate-850 space-y-4">
                    <div className="text-amber-500/85 flex justify-center"><Users size={44} /></div>
                    <div className="space-y-1.5 max-w-md mx-auto">
                      <h4 className="font-bold text-slate-200">招贤贤能尚未入阁</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        长篇故事必须由具有成长弧线并有着宿命羁绊的角色支撑。点击上方“一键设计四神”，我们将通过小说圣经一气炼化配角、宿敌与王牌。
                      </p>
                    </div>
                    <button 
                      onClick={handleGenerateCharacters}
                      disabled={loading}
                      className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs transition-colors shadow-lg"
                    >
                      ✨ 降临：一键唤醒小说主角群
                    </button>
                  </div>
                ) : characterSubView === 'map' ? (
                  <RelationshipGraph 
                    projectData={projectData} 
                    onUpdateCharacters={handleUpdateCharactersList} 
                  />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {projectData.characters.map((char, idx) => (
                      <div key={char.id} className="bg-slate-950 rounded-xl border border-slate-850 p-5 space-y-4 hover:border-amber-500/20 transition-all relative">
                        {/* Role tag badge */}
                        <div className="flex items-center justify-between">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            char.role === 'protagonist' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                            char.role === 'antagonist' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                            'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }`}>
                            {char.role === 'protagonist' ? '主角 Protagonist' : char.role === 'antagonist' ? '宿敌 Antagonist' : '配角 Supporting'}
                          </span>
                          <button 
                            onClick={() => handleRemoveCharacter(char.id)}
                            className="text-slate-600 hover:text-rose-400 p-1"
                          >
                            <Trash size={12} />
                          </button>
                        </div>

                        {/* Name meta line */}
                        <div className="flex items-center gap-3">
                          <input 
                            type="text" 
                            value={char.name}
                            onChange={(e) => handleUpdateCharacterDetails(idx, 'name', e.target.value)}
                            className="bg-transparent font-serif text-lg font-bold text-slate-100 border-b border-transparent hover:border-slate-800 focus:border-amber-500 focus:outline-none pb-0.5"
                          />
                          <span className="text-xs text-slate-500">({char.gender}, {char.age}岁)</span>
                        </div>

                        {/* Profiles settings */}
                        <div className="space-y-2 text-xs">
                          <div>
                            <span className="text-[10px] text-amber-500/70 uppercase font-semibold">神韵外貌装束</span>
                            <textarea 
                              value={char.appearance}
                              onChange={(e) => handleUpdateCharacterDetails(idx, 'appearance', e.target.value)}
                              rows={2}
                              className="w-full bg-slate-900 border border-slate-800/80 rounded px-2 py-1 text-slate-350 mt-1 focus:outline-none focus:border-amber-500 resize-none"
                            />
                          </div>

                          <div>
                            <span className="text-[10px] text-amber-500/70 uppercase font-semibold">核心脾气/矛盾性格</span>
                            <textarea 
                              value={char.personality}
                              onChange={(e) => handleUpdateCharacterDetails(idx, 'personality', e.target.value)}
                              rows={2}
                              className="w-full bg-slate-900 border border-slate-800/80 rounded px-2 py-1 text-slate-300 mt-1 focus:outline-none focus:border-amber-500 resize-none"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="text-[10px] text-amber-500/70 uppercase font-semibold">明面欲念 / 挣扎执念</span>
                              <textarea 
                                value={char.goal}
                                onChange={(e) => handleUpdateCharacterDetails(idx, 'goal', e.target.value)}
                                rows={2}
                                className="w-full bg-slate-900 border border-slate-800/80 rounded px-2 py-1 text-slate-300 mt-1 focus:outline-none focus:border-amber-500 resize-none text-[11px]"
                              />
                            </div>
                            <div>
                              <span className="text-[10px] text-amber-500/70 uppercase font-semibold">不可告人的暗疾秘密</span>
                              <textarea 
                                value={char.secret}
                                onChange={(e) => handleUpdateCharacterDetails(idx, 'secret', e.target.value)}
                                rows={2}
                                className="w-full bg-slate-900 border border-slate-800/80 rounded px-2 py-1 text-slate-300 mt-1 focus:outline-none focus:border-amber-500 resize-none text-[11px]"
                              />
                            </div>
                          </div>

                          <div className="pt-1.5 border-t border-slate-850/60 flex items-center justify-between text-[11px] text-slate-400">
                            <span>金句口头禅：<strong className="text-amber-400">“{char.catchphrase || '未设定'}”</strong></span>
                          </div>
                        </div>

                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* SUBTAB: 3. MULTI-CHAPTER OUTLINE */}
            {activeTab === 'outline' && (
              <section className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-xl font-bold font-serif text-white">📋 起承转合三幕式剧情大纲</h3>
                    <p className="text-xs text-slate-400">规划全书的发展轴线。大模型写每章内容时均以此大纲矛盾为主攻方向，确保前因后果极度连贯。</p>
                  </div>

                  <div className="flex gap-2">
                    <button 
                      onClick={handleAddManualOutlineRow}
                      className="bg-slate-850 hover:bg-slate-800 text-slate-200 border border-slate-700/80 px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 font-medium hover:text-amber-400 transition-colors"
                    >
                      <Plus size={13} /> 附加一章手动规划
                    </button>
                    {projectData.outline.length === 0 && (
                      <button 
                        onClick={() => handleGenerateOutline(12)}
                        disabled={loading}
                        className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-lg"
                      >
                        <Sparkles size={13} /> AI 黄金12章智能大纲
                      </button>
                    )}
                  </div>
                </div>

                {projectData.outline.length === 0 ? (
                  <div className="text-center py-20 bg-slate-950 rounded-xl border border-slate-850 space-y-4">
                    <div className="text-amber-500/85 flex justify-center"><Compass size={40} className="animate-spin" style={{ animationDuration: '6s' }} /></div>
                    <div className="space-y-1.5 max-w-md mx-auto">
                      <h4 className="font-bold text-slate-200">大纲骨图处于蛮荒期</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        长篇连载的最根本支撑就是稳固的时间线和错落的高潮。我们为你定制了经典的“起承转合”三幕式法则，一键策划 12 章的核心网文爆发线。
                      </p>
                    </div>
                    <button 
                      onClick={() => handleGenerateOutline(12)}
                      disabled={loading}
                      className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-4 py-3 rounded-xl text-xs transition-all shadow-lg"
                    >
                      ✨ 启航：一键自动生成起承转合黄金12章大纲
                    </button>
                  </div>
                ) : (
                  <div className="bg-slate-950 rounded-xl border border-slate-850 overflow-hidden shadow-2xl">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 text-xs font-semibold">
                            <th className="py-3.5 px-4 w-16 text-center">章节</th>
                            <th className="py-3.5 px-4 w-44">本章标题 (可直接编辑)</th>
                            <th className="py-3.5 px-4 w-44">登场角色/地点</th>
                            <th className="py-3.5 px-4">核心冲突 / 本章主线任务</th>
                            <th className="py-3.5 px-4 w-36">高潮最高点细节</th>
                            <th className="py-3.5 px-4 w-40">章末留悬念(抓人死神钩)</th>
                            <th className="py-3.5 px-4 w-28 text-center text-purple-400">AI逻辑审计</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-850 text-xs">
                          {projectData.outline.map((item) => (
                            <tr key={item.chapter_num} className="hover:bg-slate-900/50 transition-colors">
                              <td className="py-3 px-4 font-mono font-bold text-center text-amber-500 text-sm">
                                {item.chapter_num}
                              </td>
                              <td className="py-3 px-4">
                                <input 
                                  type="text" 
                                  value={item.title}
                                  onChange={(e) => handleOutlineCellChange(item.chapter_num, 'title', e.target.value)}
                                  className="w-full bg-slate-900 border border-slate-800 hover:border-slate-700 focus:border-amber-500 rounded px-2 py-1 text-slate-200 focus:outline-none"
                                />
                              </td>
                              <td className="py-3 px-4 space-y-2">
                                <div>
                                  <span className="text-[9px] text-slate-500">🗺 场景地点</span>
                                  <input 
                                    type="text" 
                                    value={item.location}
                                    onChange={(e) => handleOutlineCellChange(item.chapter_num, 'location', e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-slate-350 focus:outline-none mt-0.5"
                                  />
                                </div>
                                <div>
                                  <span className="text-[9px] text-slate-500">👤 出演嘉宾 (逗号隔开)</span>
                                  <input 
                                    type="text" 
                                    value={item.characters.join(', ')}
                                    onChange={(e) => handleOutlineCellChange(item.chapter_num, 'characters', e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-slate-350 focus:outline-none mt-0.5 text-[10px]"
                                  />
                                </div>
                              </td>
                              <td className="py-3 px-4 space-y-2">
                                <div>
                                  <span className="text-[9px] text-slate-500">🎯 会见意图：</span>
                                  <textarea 
                                    value={item.goal}
                                    onChange={(e) => handleOutlineCellChange(item.chapter_num, 'goal', e.target.value)}
                                    rows={1}
                                    className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-slate-350 focus:outline-none mt-0.5 text-[11px] resize-none"
                                  />
                                </div>
                                <div>
                                  <span className="text-[9px] text-slate-500">⚡ 激烈冲突：</span>
                                  <textarea 
                                    value={item.conflict}
                                    onChange={(e) => handleOutlineCellChange(item.chapter_num, 'conflict', e.target.value)}
                                    rows={2}
                                    className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-slate-300 focus:outline-none mt-0.5 text-[11px] resize-y"
                                  />
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <textarea 
                                  value={item.climax}
                                  onChange={(e) => handleOutlineCellChange(item.chapter_num, 'climax', e.target.value)}
                                  rows={3}
                                  className="w-full bg-slate-900 border border-slate-800 hover:border-slate-700 focus:border-amber-500 rounded px-2 py-1 text-slate-300 focus:outline-none resize-none text-[11px]"
                                />
                              </td>
                              <td className="py-3 px-4">
                                <textarea 
                                  value={item.hook}
                                  onChange={(e) => handleOutlineCellChange(item.chapter_num, 'hook', e.target.value)}
                                  rows={3}
                                  className="w-full bg-slate-900 border border-slate-800 hover:border-slate-700 focus:border-amber-500 rounded px-2 py-1 text-slate-350 focus:outline-none resize-none text-[11px]"
                                />
                              </td>
                              <td className="py-3 px-4 text-center border-l border-slate-900/60">
                                <div className="space-y-1.5 py-1">
                                  <button
                                    onClick={() => handleCheckLogic(item.chapter_num)}
                                    disabled={logicCheckingChapter === item.chapter_num}
                                    className="w-full bg-purple-950/45 border border-purple-500/30 hover:bg-purple-900 hover:text-purple-300 text-purple-400 font-bold px-2 py-1 rounded text-[10px] flex items-center justify-center gap-1 transition-all shadow"
                                  >
                                    {logicCheckingChapter === item.chapter_num ? (
                                      <>
                                        <RefreshCw size={10} className="animate-spin" />
                                        <span>审计中..</span>
                                      </>
                                    ) : (
                                      <>
                                        <Scale size={10} />
                                        <span>逻辑检查</span>
                                      </>
                                    )}
                                  </button>
                                  
                                  {logicAuditResults[item.chapter_num] && (
                                    <button
                                      onClick={() => setShowLogicResultForChapter(item.chapter_num)}
                                      className="text-[9px] text-amber-400 hover:underline flex items-center justify-center gap-0.5 mx-auto mt-1"
                                    >
                                      <span>契合度 {logicAuditResults[item.chapter_num].consistency_score}%</span>
                                      <span className="text-[8px] bg-amber-500/10 px-1 rounded hover:bg-amber-500/20">报告</span>
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Chapter Logic Audit Report Modal overlay */}
                {showLogicResultForChapter !== null && logicAuditResults[showLogicResultForChapter] && (
                  <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full max-h-[85vh] overflow-y-auto p-6 space-y-4 shadow-2xl relative animate-in fade-in zoom-in duration-200">
                      <button 
                        onClick={() => setShowLogicResultForChapter(null)}
                        className="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-750 p-1.5 rounded-lg transition-colors"
                      >
                        <X size={16} />
                      </button>
                      
                      <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                        <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
                          <Scale size={20} />
                        </div>
                        <div>
                          <h4 className="text-base font-bold text-white font-serif">第 {showLogicResultForChapter} 章 · 逻辑安全审计报告</h4>
                          <p className="text-[11px] text-slate-500">检测小说设定逻辑，防止“吃书”漏洞与剧情方向偏离</p>
                        </div>
                      </div>

                      {/* Dial Score meter */}
                      {(() => {
                        const res = logicAuditResults[showLogicResultForChapter];
                        return (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center bg-slate-950/50 p-4 rounded-xl border border-slate-850">
                            <div className="text-center md:border-r border-slate-850 py-1.5">
                              <span className="text-[10px] text-slate-500 uppercase tracking-widest block font-bold">设定契合度</span>
                              <span className={`text-4xl font-extrabold font-mono ${
                                res.consistency_score >= 88 ? 'text-emerald-400' :
                                res.consistency_score >= 70 ? 'text-amber-400' : 'text-rose-500'
                              }`}>
                                {res.consistency_score}%
                              </span>
                              <span className="text-[9px] text-slate-500 block mt-1">
                                {res.consistency_score >= 88 ? '✅ 设定严丝合缝' :
                                 res.consistency_score >= 70 ? '⚠️ 存轻微冲突风险' : '🚨 吃书指数极高'}
                              </span>
                            </div>
                            <div className="md:col-span-2 space-y-2 pl-2">
                              <h5 className="font-bold text-[11px] text-slate-350 flex items-center gap-1">
                                <Sparkles size={11} className="text-purple-400" />
                                <span>审计结论：</span>
                              </h5>
                              <p className="text-[11px] text-slate-400 leading-relaxed">
                                {res.consistency_score >= 88 
                                  ? "恭喜！本章物理细节、流派世界观、角色心理惯性、以及特定阵营立场非常考究，完全符合圣经法则。"
                                  : "检测到部分故事细节或角色背景行为与原先注册在【小说圣经】中的铁律、派系地理或角色心理账本不符，建议采纳下方调整建议。"}
                              </p>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Conflict sections */}
                      <div className="space-y-2">
                        <span className="text-[11px] text-rose-400 font-bold block flex items-center gap-1">
                          <AlertTriangle size={12} />
                          逻辑冲突隐患与「吃书漏洞」({logicAuditResults[showLogicResultForChapter].conflicts.length})
                        </span>
                        <div className="bg-rose-950/20 border border-rose-500/10 rounded-xl p-3 space-y-2 text-xs">
                          {logicAuditResults[showLogicResultForChapter].conflicts.length === 0 ? (
                            <p className="text-emerald-400 text-[11px] flex items-center gap-1 py-1">
                              <span>✨ 本章大纲完美契合小说圣经！未检出任何设定冲突。</span>
                            </p>
                          ) : (
                            logicAuditResults[showLogicResultForChapter].conflicts.map((conf, ci) => (
                              <div key={ci} className="text-slate-350 pl-3.5 relative text-[11.5px] leading-relaxed">
                                <span className="absolute left-1 top-1.5 h-1.5 w-1.5 bg-rose-500 rounded-full" />
                                {conf}
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Suggestions block */}
                      <div className="space-y-2">
                        <span className="text-[11px] text-emerald-400 font-bold block flex items-center gap-1">
                          <CheckCircle size={12} />
                          逻辑修补与黄金圆场方案推荐
                        </span>
                        <div className="bg-slate-950/60 border border-slate-850 rounded-xl p-3.5 space-y-2 text-xs">
                          {logicAuditResults[showLogicResultForChapter].suggestions.map((sug, si) => (
                            <div key={si} className="text-slate-350 pl-4 relative text-[11.5px] leading-relaxed flex items-start gap-1">
                              <span className="text-emerald-500 font-mono text-[10px] absolute left-1 top-0.5">#{si+1}</span>
                              <span>{sug}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex justify-end pt-2 border-t border-slate-850">
                        <button
                          onClick={() => setShowLogicResultForChapter(null)}
                          className="bg-purple-650 hover:bg-purple-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition-colors"
                        >
                          我知道了，立即去改大纲
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* SUBTAB: 4. TEXT CORER WRITING WORKSHOP */}
            {activeTab === 'chapters' && (
              <div className="flex-1 flex flex-col md:flex-row gap-6 min-h-[500px]">
                
                {/* Secondary side-column chapter item lists */}
                <div className="w-full md:w-48 bg-slate-950 rounded-xl border border-slate-850 p-2 shrink-0 max-h-[550px] overflow-y-auto">
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider px-2.5 py-1.5 border-b border-slate-850/60 mb-2">
                    书架连载章节
                  </div>
                  <div className="space-y-1">
                    {projectData.outline.map((o) => {
                      const chapDoc = projectData.chapters.find(c => c.chapter_num === o.chapter_num);
                      const isSelected = activeChapterNum === o.chapter_num;
                      return (
                        <button
                          key={o.chapter_num}
                          onClick={() => {
                            if (!isGenerating) {
                              setActiveChapterNum(o.chapter_num);
                            } else {
                              alert('正处于高能流式生成期，暂时无法闪回他章！');
                            }
                          }}
                          className={`w-full text-left px-2.5 py-2 rounded-lg flex items-center justify-between text-xs transition-all ${
                            isSelected 
                              ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/10' 
                              : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                          }`}
                        >
                          <span className="truncate pr-1">
                            第{o.chapter_num}章 {chapDoc ? o.title : '未着墨'}
                          </span>
                          
                          {chapDoc ? (
                            <span className={`text-[9px] px-1 rounded shrink-0 font-mono ${isSelected ? 'bg-slate-950/20 text-slate-950' : 'bg-emerald-500/10 text-emerald-400'}`}>
                              {Math.round(chapDoc.word_count / 100) / 10}k字
                            </span>
                          ) : (
                            <span className="text-[9px] bg-slate-900 text-slate-500 px-1 rounded shrink-0">待写</span>
                          )}
                        </button>
                      );
                    })}

                    {projectData.outline.length === 0 && (
                      <p className="text-[11px] text-slate-500 p-3 text-center">暂无大纲，请先去【剧情大纲】一键铺垫大骨架大纲。</p>
                    )}
                  </div>
                </div>

                {/* Main Corer rich textarea editor panel */}
                <div className="flex-1 flex flex-col space-y-4">
                  
                  {/* Editor Toolbars */}
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 flex flex-wrap items-center justify-between gap-3 shadow">
                    
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="bg-slate-900 border border-slate-800 text-amber-500 font-mono text-xs px-2 py-1 rounded font-bold">
                        第 {activeChapterNum} 章
                      </span>
                      <input 
                        type="text" 
                        value={draftTitle}
                        onChange={(e) => handleUpdateChapterTitle(e.target.value)}
                        placeholder="请输入章节标题"
                        className="bg-transparent border-b border-transparent hover:border-slate-800 focus:border-amber-500 font-bold text-sm text-slate-100 focus:outline-none p-1 shrink"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleStreamChapters}
                        disabled={isGenerating || loading}
                        className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-amber-500/10 hover:shadow-amber-500/20"
                      >
                        <Sparkles size={13} className="stroke-[2.5]" />
                        {isGenerating ? '流式写作中...' : '✨ 一键流式撰写本章'}
                      </button>
                    </div>

                  </div>

                  {/* ACTIVE OUTLINE REMINDER */}
                  {projectData.outline.find(o => o.chapter_num === activeChapterNum) && (
                    <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-850/60 text-xs">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-amber-500/80">本章主线意图：</span>
                        <span className="text-slate-350">{projectData.outline.find(o => o.chapter_num === activeChapterNum)?.goal}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-semibold text-rose-400/80">核心矛盾要冲：</span>
                        <p className="text-slate-400 leading-snug">{projectData.outline.find(o => o.chapter_num === activeChapterNum)?.conflict}</p>
                      </div>
                    </div>
                  )}

                  {/* AI 剧情要点即时推演气泡流 (NARRATIVE BEATS BUBBLE STREAM TIMELINE) */}
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-3 shadow">
                    <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                      <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                        <span className="relative flex h-2 w-2">
                          <span className={`${isGenerating ? 'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-emerald-400' : ''}`}></span>
                          <span className={`relative inline-flex rounded-full h-2 w-2 ${isGenerating ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                        </span>
                        🫧 AI 剧情发展时空调色盘（要点气泡推演流）
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">根据本章段落自动勾勒剧情起伏 timeline</span>
                    </div>

                    {getNarrativeBeats(draftContent).length === 0 ? (
                      <div className="text-center py-6 text-[11px] text-slate-500 bg-slate-900/40 rounded-lg border border-dashed border-slate-850">
                        {isGenerating ? (
                          <div className="flex items-center justify-center gap-1.5 text-emerald-400 animate-pulse text-xs font-bold">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
                            <span>AI正在流式推演核心剧情脉络，正文长出第1个段落时即刻触发推演气泡...</span>
                          </div>
                        ) : (
                          <span>✏️ 这里将展示本章情节起承转合的要点气泡。在下方文本框中书写正文或点击「一键流式撰写本章」即时开始推演。</span>
                        )}
                      </div>
                    ) : (
                      <div className="flex gap-3 overflow-x-auto pb-1.5 pt-0.5 scrollbar-thin scrollbar-thumb-slate-800">
                        {getNarrativeBeats(draftContent).map((beat, bidx, bArr) => (
                          <div key={beat.id} className="flex items-center gap-2 shrink-0 max-w-[200px]">
                            <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-xl p-2.5 space-y-1 w-44 hover:border-amber-500/20 hover:from-slate-850/80 transition-all select-none">
                              <div className="flex items-center justify-between">
                                <span className="text-[9.5px] text-amber-400 font-extrabold px-1.5 py-0.5 bg-amber-400/5 rounded border border-amber-500/10 font-mono">
                                  {beat.beatName}
                                </span>
                                <span className="text-sm">{beat.icon}</span>
                              </div>
                              <p className="text-[10.5px] text-slate-200 font-serif leading-relaxed line-clamp-2">
                                {beat.summary}
                              </p>
                              <div className="text-[8.5px] text-slate-500 text-right font-mono">
                                {beat.contentLen} 字
                              </div>
                            </div>
                            {bidx < bArr.length - 1 && (
                              <div className="text-slate-750 font-mono text-sm tracking-tighter select-none px-0.5">
                                ────➔
                              </div>
                            )}
                          </div>
                        ))}
                        {isGenerating && (
                          <div className="flex items-center pl-2 shrink-0">
                            <div className="h-10 w-10 rounded-full border border-dashed border-emerald-500/40 bg-emerald-500/5 flex items-center justify-center text-emerald-400 animate-pulse">
                              <RefreshCw size={14} className="animate-spin" />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* STREAM CONSOLE DIALOG OUTLINE */}
                  {streamLog.length > 0 && (
                    <div className="bg-slate-950 border border-amber-500/20 rounded-xl p-4 space-y-2.5 max-h-48 overflow-y-auto font-mono text-[11px] shadow-2xl relative">
                      <div className="flex justify-between items-center border-b border-slate-850 pb-1.5">
                        <span className="text-amber-400 font-bold flex items-center gap-1">
                          <Wand2 size={12} className="animate-pulse" />
                          AI 原创灵感笔头流水线
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                          <span className="text-[10px] text-slate-500">Live API</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        {streamLog.map((log, i) => (
                          <div 
                            key={i} 
                            className={`flex justify-between ${
                              log.type === 'success' ? 'text-emerald-400 font-semibold' : 
                              log.type === 'warn' ? 'text-rose-450 font-bold' : 'text-slate-350'
                            }`}
                          >
                            <span>{log.message}</span>
                          </div>
                        ))}
                      </div>
                      <div ref={streamEndRef} />
                    </div>
                  )}

                  {/* EDITOR AREA + POLISH SPLIT */}
                  <div className="flex-1 flex flex-col md:flex-row gap-5 min-h-[350px]">
                    
                    {/* Rich text scroll wrapper */}
                    <div className="flex-1 bg-slate-950 rounded-xl border border-slate-850 p-4 md:p-6 flex flex-col relative focus-within:border-amber-500/30 transition-colors">
                      <textarea
                        value={draftContent}
                        onChange={(e) => handleUpdateChapterContent(e.target.value)}
                        onMouseUp={handleTextareaSelection}
                        onKeyUp={handleTextareaSelection}
                        disabled={isGenerating}
                        className="flex-1 bg-transparent w-full resize-none focus:outline-none text-slate-200 font-serif text-[15px] leading-relaxed select-text placeholder-slate-700 whitespace-pre-wrap outline-none"
                        placeholder="第 01 章 骨气天成......&#10;&#10;（点击右上角“一键流式撰写本章”按钮，AI 将调用小说大纲，辅以宿怨在几分钟内流式推笔生成完美的底稿！&#10;你也可以随时在此文本框中直接挥笔编辑，或选中文本启动右侧的 AI 极客抛光加工厂。）"
                      />

                      {/* Floating metadata detail footer */}
                      <div className="pt-3 border-t border-slate-900 mt-2 flex items-center justify-between text-[11px] text-slate-500 font-mono shrink-0">
                        <span>
                          字数统计: <strong className="text-slate-300">{draftContent.length}</strong> 字
                        </span>
                        <span>
                          💡 提示：选中特定文本段落，可开启右侧“AI 极客磨皮加工”
                        </span>
                      </div>
                    </div>

                    {/* MULTI-TABBED AI WORKSHOP AND VERSIONING SIDEBAR */}
                    <div className="w-full md:w-64 bg-slate-950 p-4 rounded-xl border border-slate-850 flex flex-col shrink-0 shadow-lg gap-4 justify-between">
                      <div className="space-y-4 flex-1 flex flex-col min-h-0">
                        {/* Tabs Navigation */}
                        <div className="grid grid-cols-3 bg-slate-900 p-0.5 rounded-lg border border-slate-850 shrink-0">
                          <button
                            onClick={() => setActiveEditorTab('polish')}
                            className={`py-1 text-[10px] font-bold rounded-md transition-colors ${
                              activeEditorTab === 'polish' 
                                ? 'bg-amber-500 text-slate-950 shadow' 
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            AI打磨
                          </button>
                          <button
                            onClick={() => setActiveEditorTab('foreshadow')}
                            className={`py-1 text-[10px] font-bold rounded-md transition-colors relative ${
                              activeEditorTab === 'foreshadow' 
                                ? 'bg-amber-500 text-slate-950 shadow' 
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            伏笔回收
                            {projectData?.foreshadows?.filter(f => f.status === 'open' && f.planted_chapter < activeChapterNum).length > 0 && (
                              <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                            )}
                          </button>
                          <button
                            onClick={() => setActiveEditorTab('history')}
                            className={`py-1 text-[10px] font-bold rounded-md transition-colors ${
                              activeEditorTab === 'history' 
                                ? 'bg-amber-500 text-slate-950 shadow' 
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            版本
                          </button>
                        </div>

                        {/* TAB 1: AI POLISH */}
                        {activeEditorTab === 'polish' && (
                          <div className="space-y-4 animate-in fade-in duration-150">
                            <div className="border-b border-slate-850 pb-2">
                              <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                                <Wand2 size={13} />
                                AI 黄金打磨工坊
                              </span>
                              <p className="text-[10px] text-slate-500 mt-0.5">针对当前编辑器中的内容或您选中的话段启动微调美化。</p>
                            </div>

                            {/* Selected text view notice */}
                            {selectedTextForPolish && (
                              <div className="bg-slate-900 border border-amber-500/20 p-2.5 rounded text-[10px] space-y-1">
                                <span className="text-amber-500/80 font-semibold block">已锚定锚点局部文本 ({selectedTextForPolish.length}字)：</span>
                                <p className="text-slate-400 truncate">“{selectedTextForPolish}”</p>
                                <button onClick={() => setSelectedTextForPolish('')} className="text-[9px] text-rose-450 hover:underline">释放并全局进行</button>
                              </div>
                            )}

                            {/* Modes */}
                            <div className="space-y-1.5 text-xs">
                              <label className="text-[10px] text-slate-500 uppercase font-semibold">选择抛光操作</label>
                              
                              <button
                                onClick={() => handleAIPolishSelection('eliminate_ai')}
                                disabled={polishLoading}
                                className="w-full bg-slate-900 hover:bg-slate-850 text-slate-200 border border-slate-800 text-left px-2.5 py-1.5 rounded flex items-center gap-1.5 hover:text-amber-400 transition-colors"
                              >
                                <Sparkles size={11} className="text-amber-500" />
                                <span>一键消除AI呆板味</span>
                              </button>

                              <button
                                onClick={() => handleAIPolishSelection('expand')}
                                disabled={polishLoading}
                                className="w-full bg-slate-900 hover:bg-slate-850 text-slate-200 border border-slate-800 text-left px-2.5 py-1.5 rounded flex items-center gap-1.5 hover:text-amber-400 transition-colors"
                              >
                                <Plus size={11} className="text-emerald-400" />
                                <span>扩写环境与微表情</span>
                              </button>

                              <button
                                onClick={() => handleAIPolishSelection('shrink')}
                                disabled={polishLoading}
                                className="w-full bg-slate-905 hover:bg-slate-850 text-slate-200 border border-slate-800 text-left px-2.5 py-1.5 rounded flex items-center gap-1.5 hover:text-amber-400 transition-colors"
                              >
                                <X size={11} className="text-purple-400" />
                                <span>大幅精简文章废话</span>
                              </button>

                              <button
                                onClick={() => handleAIPolishSelection('continue')}
                                disabled={polishLoading}
                                className="w-full bg-slate-900 hover:bg-slate-850 text-slate-200 border border-slate-800 text-left px-2.5 py-1.5 rounded flex items-center gap-1.5 hover:text-amber-400 transition-colors"
                              >
                                <ArrowRight size={11} className="text-amber-500" />
                                <span>基于此句顺承续写</span>
                              </button>
                            </div>

                            {/* Custom instructions box */}
                            <div className="space-y-1.5">
                              <label className="text-[10px] text-slate-500 uppercase font-semibold">附加意图批注 (选填):</label>
                              <textarea
                                placeholder="例如: 增加主角心中的寂凉，或让对手说两句挑衅台词..."
                                value={polishInstruction}
                                onChange={(e) => setPolishInstruction(e.target.value)}
                                rows={2}
                                className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-amber-500 resize-none font-sans"
                              />
                            </div>

                            {polishLoading && (
                              <div className="text-center text-[10px] text-amber-500 flex items-center justify-center gap-1 animate-pulse">
                                <RefreshCw size={11} className="animate-spin" />
                                大模型全力微调中...
                              </div>
                            )}
                          </div>
                        )}

                        {/* TAB 2: FORESHADOW REMINDER */}
                        {activeEditorTab === 'foreshadow' && (
                          <div className="space-y-3 flex-1 flex flex-col min-h-0 min-w-0 animate-in fade-in duration-150">
                            <div className="border-b border-slate-850 pb-2">
                              <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                                <Target size={13} />
                                伏笔呼应与暗线回收
                              </span>
                              <p className="text-[10px] text-slate-500 mt-0.5">勾选欲在此章穿插交代的暗线伏笔，写稿时AI自动进行剧情穿引配合。</p>
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs max-h-[220px]">
                              {(() => {
                                const list = projectData?.foreshadows?.filter(f => f.status === 'open' && f.planted_chapter < activeChapterNum) || [];
                                if (list.length === 0) {
                                  return (
                                    <div className="text-center py-8 text-slate-600 text-[10px] space-y-1.5">
                                      <p>暂无可供回收的伏笔</p>
                                      <p className="text-[9px] text-slate-700">您可以在「线索伏笔」板块埋下新暗线</p>
                                    </div>
                                  );
                                }
                                return list.map(f => {
                                  const isIntended = f.resolve_chapter === activeChapterNum;
                                  const isChecked = selectedForeshadowIds.includes(f.id);
                                  return (
                                    <div 
                                      key={f.id} 
                                      className={`p-2 rounded-lg border transition-all ${
                                        isIntended 
                                          ? 'bg-rose-500/10 border-rose-500/30' 
                                          : isChecked 
                                            ? 'bg-amber-500/5 border-amber-500/25'
                                            : 'bg-slate-900 border-slate-850'
                                      }`}
                                    >
                                      <div className="flex items-start gap-1.5">
                                        <input 
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => {
                                            setSelectedForeshadowIds(prev => 
                                              prev.includes(f.id) ? prev.filter(id => id !== f.id) : [...prev, f.id]
                                            );
                                          }}
                                          className="mt-0.5 accent-amber-500"
                                        />
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center justify-between gap-1">
                                            <span className="font-bold text-slate-200 truncate block text-[10.5px]">{f.title}</span>
                                            {isIntended && (
                                              <span className="text-[8px] bg-rose-500/20 text-rose-400 px-1 rounded font-mono shrink-0">契合</span>
                                            )}
                                          </div>
                                          <p className="text-[9.5px] text-slate-400 mt-0.5 line-clamp-2 leading-tight">{f.description}</p>
                                          <div className="flex items-center justify-between mt-1 text-[8px] text-slate-500 font-mono">
                                            <span>源自第{f.planted_chapter}章</span>
                                            <button 
                                              onClick={() => handleToggleForeshadowStatus(f.id)}
                                              className="text-amber-500 hover:underline flex items-center gap-0.5 font-bold"
                                            >
                                              完成回收
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                });
                              })()}
                            </div>

                            <div className="space-y-1 pt-1.5 border-t border-slate-900 shrink-0">
                              <label className="text-[9px] text-slate-500 uppercase font-semibold">连结笔调呼应词 (选填):</label>
                              <textarea
                                placeholder="如：特别侧重刻画玉佩上的刻纹..."
                                value={customForeshadowInstruction}
                                onChange={(e) => setCustomForeshadowInstruction(e.target.value)}
                                rows={2}
                                className="w-full bg-slate-900 border border-slate-850 rounded px-2 py-1 text-[10px] text-slate-300 focus:outline-none focus:border-amber-500 resize-none font-sans"
                              />
                            </div>
                          </div>
                        )}

                        {/* TAB 3: SNAPSHOT HISTORY */}
                        {activeEditorTab === 'history' && (
                          <div className="space-y-3 flex-1 flex flex-col min-h-0 min-w-0 animate-in fade-in duration-150">
                            <div className="border-b border-slate-850 pb-2 flex items-center justify-between shrink-0">
                              <div>
                                <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                                  <History size={13} />
                                  快照沙盒历史
                                </span>
                                <p className="text-[10px] text-slate-500 mt-0.5">大幅撰写及微调后在此回溯。</p>
                              </div>
                              <button
                                onClick={() => {
                                  if (!draftContent) return;
                                  saveSnapToMetadata(activeChapterNum, draftContent, 'manual');
                                  alert('手动保存本章文本剪影快照成功！');
                                }}
                                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-1.5 py-0.5 rounded text-[9px]"
                              >
                                存瞬时挡
                              </button>
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs max-h-[300px]">
                              {(() => {
                                const activeCh = projectData?.chapters?.find(c => c.chapter_num === activeChapterNum);
                                const snaps = activeCh?.snapshots || [];
                                if (snaps.length === 0) {
                                  return (
                                    <div className="text-center py-10 text-slate-600 text-[10px] leading-relaxed">
                                      暂无本章的历史版本记录。<br/>在编辑器输入、AI 润色、顺承续笔后，系统将自动留存档案。
                                    </div>
                                  );
                                }
                                return [...snaps].reverse().map((snap) => {
                                  const dt = new Date(snap.timestamp);
                                  const timeStr = `${dt.getMonth() + 1}/${dt.getDate()} ${dt.getHours().toString().padStart(2, '0')}:${dt.getMinutes().toString().padStart(2, '0')}`;
                                  return (
                                    <div key={snap.id} className="bg-slate-900 border border-slate-850/60 p-2 rounded-lg flex flex-col gap-1">
                                      <div className="flex items-center justify-between">
                                        <span className="font-mono text-[9px] font-semibold text-slate-400">{timeStr}</span>
                                        <span className={`text-[8px] px-1 rounded font-mono ${
                                          snap.trigger_type === 'ai' 
                                            ? 'bg-purple-500/10 text-purple-400' 
                                            : snap.trigger_type === 'manual'
                                              ? 'bg-amber-550/15 text-amber-500'
                                              : 'bg-slate-800 text-slate-400'
                                        }`}>
                                          {snap.trigger_type === 'ai' ? 'AI生成' : snap.trigger_type === 'manual' ? '手动' : '自存'}
                                        </span>
                                      </div>
                                      <div className="text-[9.5px] text-slate-500 flex justify-between font-mono">
                                        <span>正文字数: {snap.word_count}字</span>
                                      </div>
                                      <div className="grid grid-cols-2 gap-1.5 mt-1">
                                        <button
                                          onClick={() => {
                                            alert(`【版本快照内容预览】：\n\n${snap.content.substring(0, 500)}${snap.content.length > 500 ? '\n\n...[以下内容由于篇幅省略预览]...' : ''}`);
                                          }}
                                          className="bg-slate-800 hover:bg-slate-750 text-slate-350 text-[9px] py-0.5 rounded text-center transition-colors"
                                        >
                                          🔍 预览
                                        </button>
                                        <button
                                          onClick={() => {
                                            if (window.confirm('重磅提示：这将永久覆盖当前编辑器内的正文，并还原为该历史版本！是否继续回滚？')) {
                                              handleUpdateChapterContent(snap.content);
                                              alert('已成功将编辑器数据恢复至该历史版本副本！');
                                            }
                                          }}
                                          className="bg-rose-950/40 hover:bg-rose-900/50 border border-rose-500/15 text-rose-450 text-[9px] py-0.5 rounded text-center font-bold transition-colors"
                                        >
                                          ⏪ 恢复
                                        </button>
                                      </div>
                                    </div>
                                  );
                                });
                              })()}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                  </div>

                </div>

              </div>
            )}

            {/* SUBTAB: 5. FORESHADOW TRACKER LEDGER */}
            {activeTab === 'foreshadow' && (
              <section className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-xl font-bold font-serif text-white">🔍 全剧奇珍、线索与伏笔追踪账本</h3>
                    <p className="text-xs text-slate-400">为了防止长篇网络连载“挖坑不填”或者后期失序崩溃，AI 在解析和生成章节时将自动注册、盘点并引导在特定章节前后回收这些伏笔明线。</p>
                  </div>
                  
                  <button 
                    onClick={() => setShowManualForeDialog(true)}
                    className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 shadow-lg font-medium"
                  >
                    <Plus size={13} /> 埋下一个新伏笔(挖新坑)
                  </button>
                </div>

                {/* Manual foreshadow input drawer */}
                {showManualForeDialog && (
                  <div className="bg-slate-950 p-5 rounded-xl border border-amber-500/20 max-w-lg space-y-4">
                    <h4 className="font-bold text-amber-400 text-sm font-serif">记录剧情中一段极其宿命的关键暗线</h4>
                    <div className="space-y-3 text-xs">
                      <div>
                        <span>线索简称 / 绰号</span>
                        <input type="text" value={customForeTitle} onChange={(e) => setCustomForeTitle(e.target.value)} placeholder="例如：太古血玉中的残缺阵盘" className="w-full bg-slate-900 rounded border border-slate-800 px-2 py-1.5 mt-1 focus:outline-none text-slate-205" />
                      </div>
                      <div>
                        <span>伏笔暗示的终极密谋/意图</span>
                        <textarea value={customForeDesc} onChange={(e) => setCustomForeDesc(e.target.value)} rows={2} placeholder="例如：主角在第2章拿到的血玉里有暗星盘，实际上这是反派血刀盟寻找了百年的开启太虚秘境之钥匙钥匙。" className="w-full bg-slate-900 rounded border border-slate-800 px-2 py-1 mt-1 focus:outline-none resize-none" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <span>种下伏笔的章节</span>
                          <input type="number" value={customForePlanted} onChange={(e) => setCustomForePlanted(Number(e.target.value))} className="w-full bg-slate-900 rounded border border-slate-800 px-2 py-1 mt-1 focus:outline-none text-slate-230" />
                        </div>
                        <div>
                          <span>预定回收解答章节</span>
                          <input type="number" value={customForeExpected} onChange={(e) => setCustomForeExpected(Number(e.target.value))} className="w-full bg-slate-900 rounded border border-slate-800 px-2 py-1 mt-1 focus:outline-none text-slate-230" />
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end pt-2 text-xs">
                      <button onClick={() => setShowManualForeDialog(false)} className="text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded select-none">取消</button>
                      <button onClick={handleAddManualForeshadow} className="bg-amber-500 text-slate-950 font-bold px-4 py-1.5 rounded hover:bg-amber-600 transition-colors">确认落款</button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {projectData.foreshadows.length === 0 ? (
                    <div className="col-span-full text-center py-20 bg-slate-950 rounded-xl border border-slate-850 space-y-3">
                      <Target className="text-slate-650 mx-auto" size={36} />
                      <div className="space-y-1 max-w-xs mx-auto">
                        <h4 className="font-semibold text-slate-350">目前无活动暗线伏笔</h4>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          小说中挖坑填坑是网络小说的艺术。我们的大模型在完成章节撰写和精简后，会自动识别并收纳伏笔到本板。
                        </p>
                      </div>
                    </div>
                  ) : (
                    projectData.foreshadows.map((fore) => (
                      <div 
                        key={fore.id} 
                        className={`p-4 rounded-xl border flex flex-col justify-between gap-4 transition-colors ${
                          fore.status === 'open' 
                            ? 'bg-slate-955 border-slate-800 hover:border-amber-500/25' 
                            : 'bg-slate-950/40 border-slate-900 text-slate-400'
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                              fore.status === 'open' ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'
                            }`}>
                              {fore.status === 'open' ? '🕳 暂未填(未回收面线)' : '✅ 已回收解套'}
                            </span>
                          </div>

                          <h4 className={`font-bold font-serif text-sm ${fore.status === 'open' ? 'text-slate-200' : 'text-slate-500 line-through'}`}>
                            {fore.title}
                          </h4>
                          <p className="text-xs text-slate-400 leading-relaxed">
                            {fore.description}
                          </p>
                        </div>

                        <div className="pt-3 border-t border-slate-850/60 flex items-center justify-between text-[11px] text-slate-500">
                          <span>埋入章数: <strong className="text-slate-300">第 {fore.planted_chapter} 章</strong></span>
                          {fore.status === 'open' ? (
                            <span>预计填坑: <strong className="text-amber-500">第 {fore.resolve_chapter} 章</strong></span>
                          ) : (
                            <span className="text-emerald-400">解答章数: 第 {fore.resolved_at} 章</span>
                          )}

                          <button
                            onClick={() => handleToggleForeshadowStatus(fore.id)}
                            className="text-[10px] text-amber-400 hover:text-white hover:underline shrink-0"
                          >
                            {fore.status === 'open' ? '标记已圆满' : '撤销圆满'}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            )}

          </div>

        </div>
      )}

      {/* FOOTER METRICS AND METRIC MARGINS */}
      <footer className="border-t border-slate-850 bg-slate-950 py-3.5 px-6 text-center text-xs text-slate-500/90 tracking-wide mt-auto shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div>
          Copyright &copy; 2026 <strong>AI Novel Studio</strong> inc. 极致长篇小说高连贯性原创底片生成大师。
        </div>
        <div className="flex items-center gap-4 text-[11px]">
          <span>本地存盘系统: <strong className="text-emerald-400">连接正常</strong></span>
          <span>当前驱动核心: <strong className="text-amber-400">Gemini 3.5 Flash</strong></span>
        </div>
      </footer>

    </div>
  );
}
