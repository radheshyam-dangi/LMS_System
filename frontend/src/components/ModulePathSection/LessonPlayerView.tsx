/**
 * LessonPlayerView.tsx
 *
 * Dedicated, distraction-free LMS lesson player interface for trainees.
 * - Platform-consistent enterprise UI tokens.
 * - Persistent, intuitive Previous and Next navigation.
 * - Completion flow that dynamically enables Next and smoothly transitions
 *   into dependent assignments if one follows.
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Play,
  ExternalLink,
  BookOpen,
  FileText,
  Code,
  Globe,
  Lock,
  ArrowUpRight,
  List,
  X,
  Clock,
  AlertCircle,
  CheckSquare,
} from 'lucide-react';
import DOMPurify from 'dompurify';
import type { CurriculumLessonNode, CurriculumAssignmentNode } from './useCurriculumDependencies';
import './FullscreenLessonPlayer.css';

interface LessonPlayerViewProps {
  lessonNodes: CurriculumLessonNode[];
  standaloneTasks?: CurriculumAssignmentNode[];
  currentLessonIndex: number;
  moduleTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onSelectLessonIndex: (index: number) => void;
  onMarkLessonCompleted: (lessonId: string) => Promise<void>;
  onTriggerAssignment: (task: any) => void;
}

function getEmbedUrl(rawUrl: string): string | null {
  if (!rawUrl) return null;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.hostname.includes('youtube.com')) {
      const v = parsed.searchParams.get('v');
      if (v) return `https://www.youtube.com/embed/${v}`;
      if (parsed.pathname.startsWith('/embed/')) return rawUrl;
    } else if (parsed.hostname.includes('youtu.be')) {
      const id = parsed.pathname.slice(1);
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
  } catch {
    return null;
  }
  return null;
}

function getResourceMeta(url: string, title?: string) {
  const lower = (url + (title || '')).toLowerCase();
  let domain = '';
  try {
    domain = new URL(url).hostname.replace(/^www\./, '');
  } catch {}

  if (lower.endsWith('.pdf') || lower.includes('.pdf') || lower.includes('/pdf')) {
    return {
      icon: <FileText size={17} strokeWidth={2.2} />,
      type: 'PDF Document',
      badgeClass: 'resource-badge--pdf',
      domain: domain || 'PDF Document',
    };
  }
  if (lower.includes('github.com') || lower.includes('gitlab.com') || lower.includes('bitbucket.org')) {
    return {
      icon: <Code size={17} strokeWidth={2.2} />,
      type: 'Code Repository',
      badgeClass: 'resource-badge--code',
      domain: domain || 'Source Code',
    };
  }
  if (lower.includes('docs.google.com') || lower.includes('notion.so') || lower.includes('medium.com')) {
    return {
      icon: <BookOpen size={17} strokeWidth={2.2} />,
      type: 'Reading & Article',
      badgeClass: 'resource-badge--docs',
      domain: domain || 'Reference',
    };
  }
  return {
    icon: <Globe size={17} strokeWidth={2.2} />,
    type: 'External Resource',
    badgeClass: 'resource-badge--web',
    domain: domain || 'Web Resource',
  };
}

export const LessonPlayerView: React.FC<LessonPlayerViewProps> = ({
  lessonNodes,
  standaloneTasks = [],
  currentLessonIndex,
  moduleTitle,
  isOpen,
  onClose,
  onSelectLessonIndex,
  onMarkLessonCompleted,
  onTriggerAssignment,
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMarkingComplete, setIsMarkingComplete] = useState(false);
  const [showEmbed, setShowEmbed] = useState(true);

  const currentNode = lessonNodes[currentLessonIndex];

  // Esc key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !currentNode) return null;

  const { lesson, isCompleted, isLocked, dependentAssignments } = currentNode;

  // Resolve video sources
  const videoList: { url: string; title?: string }[] = [];
  if (lesson.videoUrl) {
    videoList.push({ url: lesson.videoUrl, title: `${lesson.title} - Video Lecture` });
  }
  if (lesson.videos && Array.isArray(lesson.videos)) {
    lesson.videos.forEach((v) => {
      if (v.url && !videoList.some((existing) => existing.url === v.url)) {
        videoList.push(v);
      }
    });
  }

  // Resolve resources
  const combinedResources: any[] = [];
  if (lesson.articleUrl) {
    combinedResources.push({
      id: `article-${lesson.id}`,
      title: `${lesson.title} - Reading Article`,
      url: lesson.articleUrl,
      type: 'Article',
    });
  }
  if (lesson.resources && Array.isArray(lesson.resources)) {
    lesson.resources.forEach((r) => {
      if (r.url && !combinedResources.some((c) => c.url === r.url)) {
        combinedResources.push(r);
      }
    });
  }

  const primaryVideo = videoList[0];
  const embedUrl = primaryVideo ? getEmbedUrl(primaryVideo.url) : null;

  // Next / Previous logic
  const hasPrevious = currentLessonIndex > 0;
  const hasNextLesson = currentLessonIndex < lessonNodes.length - 1;
  const hasDependentAssignment = dependentAssignments && dependentAssignments.length > 0;

  const handleNextProgression = async () => {
    if (isMarkingComplete) return;

    // If lesson is not yet marked completed, mark it first
    if (!isCompleted) {
      setIsMarkingComplete(true);
      try {
        await onMarkLessonCompleted(lesson.id);
      } catch (e) {
        // Continue progression even if network flickers
      } finally {
        setIsMarkingComplete(false);
      }
    }

    // If this lesson has dependent assignments that follow, trigger the first uncompleted one
    if (hasDependentAssignment) {
      const firstUnsubmitted = dependentAssignments.find(
        (a) => a.displayStatus !== 'Approved' && a.displayStatus !== 'Submitted'
      );
      if (firstUnsubmitted) {
        onTriggerAssignment(firstUnsubmitted.task);
        return;
      }
    }

    // Move to next lesson
    if (hasNextLesson) {
      onSelectLessonIndex(currentLessonIndex + 1);
    } else {
      onClose();
    }
  };

  const handleMarkCompleteToggle = async () => {
    if (isMarkingComplete) return;
    setIsMarkingComplete(true);
    try {
      await onMarkLessonCompleted(lesson.id);
    } finally {
      setIsMarkingComplete(false);
    }
  };

  const modalContent = (
    <div
      className="flp-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9998,
        background: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* ── Top Header Navigation Bar ── */}
      <header
        style={{
          height: '60px',
          borderBottom: '1px solid #e2e8f0',
          padding: '0 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#ffffff',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 12px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              color: '#475569',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
          >
            <ArrowLeft size={14} /> Back to Module
          </button>

          <div style={{ height: '18px', width: '1px', background: '#e2e8f0' }} />

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                {moduleTitle}
              </span>
              <span style={{ color: '#cbd5e1' }}>•</span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: isCompleted ? '#166534' : '#4f46e5',
                  background: isCompleted ? '#f0fdf4' : '#eef2ff',
                  padding: '1px 7px',
                  borderRadius: '4px',
                }}
              >
                Lesson {currentLessonIndex + 1} of {lessonNodes.length}
              </span>
            </div>
            <h2
              style={{
                fontSize: '15px',
                fontWeight: 700,
                color: '#0f172a',
                margin: 0,
                lineHeight: 1.25,
              }}
            >
              {lesson.title}
            </h2>
          </div>
        </div>

        {/* Right Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Previous Lesson Button */}
          <button
            type="button"
            disabled={!hasPrevious}
            onClick={() => onSelectLessonIndex(currentLessonIndex - 1)}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              background: hasPrevious ? '#ffffff' : '#f8fafc',
              color: hasPrevious ? '#334155' : '#94a3b8',
              fontSize: '12px',
              fontWeight: 600,
              cursor: hasPrevious ? 'pointer' : 'not-allowed',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <ChevronLeft size={14} /> Previous
          </button>

          {/* Mark Complete Button */}
          <button
            type="button"
            onClick={handleMarkCompleteToggle}
            disabled={isMarkingComplete}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              border: isCompleted ? '1px solid #bbf7d0' : '1px solid #e0e7ff',
              background: isCompleted ? '#f0fdf4' : '#eef2ff',
              color: isCompleted ? '#166534' : '#4f46e5',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            <CheckCircle2 size={14} />
            <span>{isCompleted ? 'Completed' : 'Mark Complete'}</span>
          </button>

          {/* Next / Continue Progression Button */}
          <button
            type="button"
            onClick={handleNextProgression}
            disabled={isMarkingComplete}
            style={{
              padding: '7px 16px',
              borderRadius: '8px',
              border: 'none',
              background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
              color: '#ffffff',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 6px rgba(79, 70, 229, 0.25)',
              transition: 'all 0.15s ease',
            }}
          >
            <span>
              {hasDependentAssignment
                ? 'Continue to Assignment'
                : hasNextLesson
                ? 'Next Lesson'
                : 'Finish Module'}
            </span>
            <ChevronRight size={14} />
          </button>

          {/* Curriculum Index Drawer Toggle */}
          <button
            type="button"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            style={{
              padding: '7px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              background: isSidebarOpen ? '#eef2ff' : '#ffffff',
              color: isSidebarOpen ? '#4f46e5' : '#64748b',
              cursor: 'pointer',
            }}
            title="Curriculum Lessons Index"
          >
            <List size={16} />
          </button>
        </div>
      </header>

      {/* ── Main Player Body Layout ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Main Content Area */}
        <main
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '28px 36px',
            background: '#ffffff',
            maxWidth: '1100px',
            margin: '0 auto',
            width: '100%',
          }}
        >
          {/* Lesson Title Banner */}
          <div style={{ marginBottom: '24px' }}>
            <h1
              style={{
                fontSize: '24px',
                fontWeight: 800,
                color: '#0f172a',
                margin: '0 0 10px 0',
                letterSpacing: '-0.02em',
              }}
            >
              {lesson.title}
            </h1>

            {/* Description & Takeaways */}
            {lesson.description && (
              <div
                style={{
                  fontSize: '14.5px',
                  lineHeight: 1.65,
                  color: '#334155',
                  marginBottom: '16px',
                }}
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(lesson.description),
                }}
              />
            )}

            {lesson.keyPoints && lesson.keyPoints.length > 0 && (
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '14px 18px',
                  marginTop: '12px',
                }}
              >
                <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#4f46e5', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Key Takeaways
                </div>
                <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {lesson.keyPoints.map((pt, pIdx) => (
                    <li key={pIdx} style={{ fontSize: '13px', color: '#334155', lineHeight: 1.5 }}>
                      <span dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(pt) }} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* ── Core Video Showcase ── */}
          {videoList.length > 0 && (
            <section style={{ marginBottom: '28px' }}>
              <div
                style={{
                  fontSize: '11.5px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#64748b',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Play size={12} fill="currentColor" /> Core Video Lecture
              </div>

              {/* Embedded Player */}
              {embedUrl && showEmbed ? (
                <div
                  style={{
                    position: 'relative',
                    paddingBottom: '56.25%',
                    height: 0,
                    overflow: 'hidden',
                    borderRadius: '12px',
                    background: '#000000',
                    border: '1px solid #1e293b',
                    boxShadow: '0 8px 24px -4px rgba(15, 23, 42, 0.25)',
                  }}
                >
                  <iframe
                    src={embedUrl}
                    title={lesson.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
                  />
                </div>
              ) : (
                <div
                  style={{
                    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                    borderRadius: '12px',
                    padding: '16px 20px',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Play size={16} fill="currentColor" />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>{lesson.title} - Video</h4>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>Core Curriculum Media</span>
                    </div>
                  </div>
                  <a
                    href={primaryVideo.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      background: '#ffffff',
                      color: '#0f172a',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      fontWeight: 700,
                      fontSize: '12px',
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    Open Video <ExternalLink size={12} />
                  </a>
                </div>
              )}
            </section>
          )}

          {/* ── Core Reading & Resources ── */}
          {combinedResources.length > 0 && (
            <section style={{ marginBottom: '32px' }}>
              <div
                style={{
                  fontSize: '11.5px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#64748b',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <BookOpen size={12} /> Core Reading & Study Resources ({combinedResources.length})
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                {combinedResources.map((res, rIdx) => {
                  const meta = getResourceMeta(res.url, res.title);
                  return (
                    <a
                      key={res.id || rIdx}
                      href={res.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        padding: '12px 16px',
                        background: '#ffffff',
                        border: '1.5px solid #e2e8f0',
                        borderRadius: '12px',
                        textDecoration: 'none',
                        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#818cf8';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#e2e8f0';
                        e.currentTarget.style.transform = 'none';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                        <div
                          className={meta.badgeClass}
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {meta.icon}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <span
                            style={{
                              fontSize: '13px',
                              fontWeight: 700,
                              color: '#0f172a',
                              display: 'block',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {res.title || 'Learning Resource'}
                          </span>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>
                            {meta.type} · {meta.domain}
                          </span>
                        </div>
                      </div>

                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: '#4f46e5',
                          background: '#f5f3ff',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          flexShrink: 0,
                        }}
                      >
                        Open <ArrowUpRight size={11} />
                      </span>
                    </a>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── Dependent Assignments Notice Banner ── */}
          {hasDependentAssignment && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                marginBottom: '36px',
              }}
            >
              {dependentAssignments.map((dep) => (
                <div
                  key={dep.task.id}
                  style={{
                    padding: '16px 20px',
                    background: '#faf5ff',
                    border: '1.5px solid #d8b4fe',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '15px',
                      fontWeight: 700,
                      color: '#581c87',
                      lineHeight: 1.4,
                    }}
                  >
                    {dep.task.title}
                  </span>

                  <button
                    type="button"
                    onClick={() => onTriggerAssignment(dep.task)}
                    style={{
                      padding: '8px 18px',
                      borderRadius: '8px',
                      background: '#7e22ce',
                      color: '#ffffff',
                      border: 'none',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'background 0.2s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#6b21a8')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '#7e22ce')}
                  >
                    Start Assessment →
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* ── Persistent Bottom Navigation Controls ── */}
          <div
            style={{
              paddingTop: '20px',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '40px',
            }}
          >
            <button
              type="button"
              disabled={!hasPrevious}
              onClick={() => onSelectLessonIndex(currentLessonIndex - 1)}
              style={{
                padding: '9px 18px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                background: hasPrevious ? '#ffffff' : '#f8fafc',
                color: hasPrevious ? '#334155' : '#94a3b8',
                fontSize: '13px',
                fontWeight: 600,
                cursor: hasPrevious ? 'pointer' : 'not-allowed',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <ChevronLeft size={16} /> Previous Lesson
            </button>

            <button
              type="button"
              onClick={handleNextProgression}
              disabled={isMarkingComplete}
              style={{
                padding: '10px 22px',
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 8px rgba(79, 70, 229, 0.25)',
              }}
            >
              <span>
                {hasDependentAssignment
                  ? 'Continue to Assignment'
                  : hasNextLesson
                  ? 'Next Lesson'
                  : 'Complete Module'}
              </span>
              <ChevronRight size={16} />
            </button>
          </div>
        </main>

        {/* ── Collapsible Curriculum Hierarchy Sidebar ── */}
        {isSidebarOpen && (
          <aside
            style={{
              width: '360px',
              borderLeft: '1px solid #e2e8f0',
              background: '#f8fafc',
              display: 'flex',
              flexDirection: 'column',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#ffffff',
              }}
            >
              <div>
                <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: 700, color: '#0f172a' }}>
                  Curriculum Hierarchy
                </h4>
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                  Lessons & Dependent Assessments
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsSidebarOpen(false)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#64748b',
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.15s',
                }}
                title="Close Curriculum Index"
              >
                <X size={15} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 12px' }}>
              {lessonNodes.map((node, lIdx) => {
                const isActive = lIdx === currentLessonIndex;
                const isLessonLocked = node.isLocked;

                return (
                  <div key={node.lesson.id} style={{ marginBottom: '10px' }}>
                    {/* Lesson Item */}
                    <button
                      type="button"
                      disabled={isLessonLocked}
                      onClick={() => onSelectLessonIndex(lIdx)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        background: isActive ? '#eef2ff' : '#ffffff',
                        border: `1.5px solid ${isActive ? '#6366f1' : '#e2e8f0'}`,
                        cursor: isLessonLocked ? 'not-allowed' : 'pointer',
                        opacity: isLessonLocked ? 0.6 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        transition: 'all 0.15s ease',
                        boxShadow: isActive ? '0 2px 8px rgba(99, 102, 241, 0.15)' : '0 1px 2px rgba(15, 23, 42, 0.03)',
                      }}
                    >
                      <div
                        style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '7px',
                          background: node.isCompleted ? '#dcfce7' : isActive ? '#6366f1' : '#f1f5f9',
                          color: node.isCompleted ? '#166534' : isActive ? '#ffffff' : isLessonLocked ? '#94a3b8' : '#475569',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '11px',
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {node.isCompleted ? (
                          <CheckCircle2 size={15} />
                        ) : isLessonLocked ? (
                          <Lock size={12} />
                        ) : (
                          lIdx + 1
                        )}
                      </div>

                      <div style={{ minWidth: 0, flex: 1 }}>
                        <span
                          style={{
                            fontSize: '12.5px',
                            fontWeight: isActive ? 700 : 600,
                            color: isActive ? '#312e81' : isLessonLocked ? '#64748b' : '#0f172a',
                            display: 'block',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Lesson {lIdx + 1}: {node.lesson.title}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                          {isLessonLocked ? (
                            <span style={{ fontSize: '10.5px', color: '#b45309', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 500 }}>
                              <Lock size={10} /> {node.lockReason || 'Locked (complete previous)'}
                            </span>
                          ) : isActive ? (
                            <span style={{ fontSize: '10.5px', color: '#4f46e5', fontWeight: 600 }}>
                              Currently Playing
                            </span>
                          ) : node.isCompleted ? (
                            <span style={{ fontSize: '10.5px', color: '#16a34a', fontWeight: 600 }}>
                              Completed
                            </span>
                          ) : (
                            <span style={{ fontSize: '10.5px', color: '#64748b' }}>
                              Available
                            </span>
                          )}
                        </div>
                      </div>
                    </button>

                    {/* Single-Instance Dependent Assignments for this Lesson */}
                    {node.dependentAssignments && node.dependentAssignments.length > 0 && (
                      <div
                        style={{
                          marginLeft: '20px',
                          paddingLeft: '14px',
                          borderLeft: '2px dashed #c7d2fe',
                          marginTop: '6px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                        }}
                      >
                        {node.dependentAssignments.map((aNode) => {
                          const isAssLocked = Boolean(aNode.isLocked);
                          const rawStatus = (aNode.submission?.status || aNode.displayStatus || 'Available').trim().toLowerCase();
                          const isApproved = rawStatus === 'approved' || aNode.displayStatus === 'Approved';
                          const isSubmitted = rawStatus === 'submitted' || aNode.displayStatus === 'Submitted';
                          const isNeedsImprovement = aNode.displayStatus === 'Need Improvement' || aNode.displayStatus === 'Needs Improvement' || rawStatus === 'rejected';

                          let badge = { label: 'Start', bg: '#eef2ff', color: '#4f46e5', border: '#c7d2fe', icon: <Play size={10} /> };
                          if (isAssLocked) {
                            badge = { label: 'Locked', bg: '#f1f5f9', color: '#94a3b8', border: '#e2e8f0', icon: <Lock size={10} /> };
                          } else if (isApproved) {
                            badge = { label: 'Approved', bg: '#dcfce7', color: '#166534', border: '#bbf7d0', icon: <CheckCircle2 size={10} /> };
                          } else if (isSubmitted) {
                            badge = { label: 'Submitted', bg: '#fef3c7', color: '#b45309', border: '#fde68a', icon: <Clock size={10} /> };
                          } else if (isNeedsImprovement) {
                            badge = { label: 'Re-submit', bg: '#ffedd5', color: '#c2410c', border: '#fed7aa', icon: <AlertCircle size={10} /> };
                          }

                          return (
                            <button
                              key={aNode.task.id}
                              type="button"
                              disabled={isAssLocked}
                              onClick={!isAssLocked ? () => onTriggerAssignment(aNode.task) : undefined}
                              style={{
                                width: '100%',
                                textAlign: 'left',
                                padding: '8px 10px',
                                borderRadius: '8px',
                                background: isAssLocked ? '#f8fafc' : '#ffffff',
                                border: `1px solid ${isAssLocked ? '#e2e8f0' : '#cbd5e1'}`,
                                cursor: isAssLocked ? 'not-allowed' : 'pointer',
                                opacity: isAssLocked ? 0.65 : 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '8px',
                                transition: 'all 0.15s ease',
                                boxShadow: isAssLocked ? 'none' : '0 1px 2px rgba(15, 23, 42, 0.04)',
                              }}
                              title={isAssLocked ? aNode.lockReason || 'Locked until prerequisite lesson is complete' : `Open ${aNode.task.title}`}
                              onMouseEnter={(e) => {
                                if (!isAssLocked) {
                                  e.currentTarget.style.borderColor = '#818cf8';
                                  e.currentTarget.style.background = '#faf5ff';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!isAssLocked) {
                                  e.currentTarget.style.borderColor = '#cbd5e1';
                                  e.currentTarget.style.background = '#ffffff';
                                }
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                                <div
                                  style={{
                                    width: '22px',
                                    height: '22px',
                                    borderRadius: '6px',
                                    background: isAssLocked ? '#f1f5f9' : '#f5f3ff',
                                    color: isAssLocked ? '#94a3b8' : '#6366f1',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                  }}
                                >
                                  {isAssLocked ? <Lock size={11} /> : <FileText size={12} />}
                                </div>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <span
                                    style={{
                                      fontSize: '11.5px',
                                      fontWeight: 600,
                                      color: isAssLocked ? '#64748b' : '#0f172a',
                                      display: 'block',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {aNode.task.title}
                                  </span>
                                  <span style={{ fontSize: '10px', color: '#64748b' }}>
                                    {aNode.task.assignmentType || 'Subjective'} · {aNode.task.maxScore || 10} pts
                                  </span>
                                </div>
                              </div>

                              <span
                                style={{
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  padding: '2px 7px',
                                  borderRadius: '999px',
                                  background: badge.bg,
                                  color: badge.color,
                                  border: `1px solid ${badge.border}`,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  flexShrink: 0,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {badge.icon}
                                <span>{badge.label}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Standalone Module Tasks (if any) */}
              {standaloneTasks && standaloneTasks.length > 0 && (
                <div style={{ marginTop: '16px', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
                    Module Assessments ({standaloneTasks.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {standaloneTasks.map((aNode) => {
                      const isAssLocked = Boolean(aNode.isLocked);
                      const rawStatus = (aNode.submission?.status || aNode.displayStatus || 'Available').trim().toLowerCase();
                      const isApproved = rawStatus === 'approved' || aNode.displayStatus === 'Approved';
                      const isSubmitted = rawStatus === 'submitted' || aNode.displayStatus === 'Submitted';
                      const isNeedsImprovement = aNode.displayStatus === 'Need Improvement' || aNode.displayStatus === 'Needs Improvement' || rawStatus === 'rejected';

                      let badge = { label: 'Start', bg: '#eef2ff', color: '#4f46e5', border: '#c7d2fe', icon: <Play size={10} /> };
                      if (isAssLocked) {
                        badge = { label: 'Locked', bg: '#f1f5f9', color: '#94a3b8', border: '#e2e8f0', icon: <Lock size={10} /> };
                      } else if (isApproved) {
                        badge = { label: 'Approved', bg: '#dcfce7', color: '#166534', border: '#bbf7d0', icon: <CheckCircle2 size={10} /> };
                      } else if (isSubmitted) {
                        badge = { label: 'Submitted', bg: '#fef3c7', color: '#b45309', border: '#fde68a', icon: <Clock size={10} /> };
                      } else if (isNeedsImprovement) {
                        badge = { label: 'Re-submit', bg: '#ffedd5', color: '#c2410c', border: '#fed7aa', icon: <AlertCircle size={10} /> };
                      }

                      return (
                        <button
                          key={aNode.task.id}
                          type="button"
                          disabled={isAssLocked}
                          onClick={!isAssLocked ? () => onTriggerAssignment(aNode.task) : undefined}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            padding: '8px 10px',
                            borderRadius: '8px',
                            background: isAssLocked ? '#f8fafc' : '#ffffff',
                            border: `1px solid ${isAssLocked ? '#e2e8f0' : '#cbd5e1'}`,
                            cursor: isAssLocked ? 'not-allowed' : 'pointer',
                            opacity: isAssLocked ? 0.65 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '8px',
                            transition: 'all 0.15s ease',
                          }}
                          title={isAssLocked ? aNode.lockReason || 'Locked task' : `Open ${aNode.task.title}`}
                          onMouseEnter={(e) => {
                            if (!isAssLocked) {
                              e.currentTarget.style.borderColor = '#818cf8';
                              e.currentTarget.style.background = '#faf5ff';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isAssLocked) {
                              e.currentTarget.style.borderColor = '#cbd5e1';
                              e.currentTarget.style.background = '#ffffff';
                            }
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                            <div
                              style={{
                                width: '22px',
                                height: '22px',
                                borderRadius: '6px',
                                background: isAssLocked ? '#f1f5f9' : '#f5f3ff',
                                color: isAssLocked ? '#94a3b8' : '#6366f1',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              {isAssLocked ? <Lock size={11} /> : <FileText size={12} />}
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <span
                                style={{
                                  fontSize: '11.5px',
                                  fontWeight: 600,
                                  color: isAssLocked ? '#64748b' : '#0f172a',
                                  display: 'block',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {aNode.task.title}
                              </span>
                              <span style={{ fontSize: '10px', color: '#64748b' }}>
                                {aNode.task.assignmentType || 'Subjective'} · {aNode.task.maxScore || 10} pts
                              </span>
                            </div>
                          </div>

                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '2px 7px',
                              borderRadius: '999px',
                              background: badge.bg,
                              color: badge.color,
                              border: `1px solid ${badge.border}`,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              flexShrink: 0,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {badge.icon}
                            <span>{badge.label}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
