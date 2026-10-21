import React, { useState } from 'react';
import { 
  Lock, CheckCircle2, Play, ExternalLink, FileText, 
  Headphones, ChevronDown, ChevronUp, BookOpen,
  Globe, Code, ArrowUpRight, X
} from 'lucide-react';
import DOMPurify from 'dompurify';
import './LessonCard.css';

export interface LessonResource {
  id?: string;
  title?: string;
  url: string;
  type?: string;
}

export interface LessonContext {
  id: string;
  title: string;
  durationMinutes?: number;
  videoUrl?: string;
  articleUrl?: string;
  videos?: { url: string; title?: string }[];
  audios?: { url: string; title?: string }[];
  description?: string;
  keyPoints?: string[];
  resources?: LessonResource[];
  isLocked?: boolean;
  lockReason?: string;
}

interface Props {
  lesson: LessonContext;
  isDone: boolean;
  isLocked?: boolean;
  lockReason?: string;
  isTrainee: boolean;
  onMarkWatched?: (id: string) => void;
  onStartLesson?: (lesson: LessonContext) => void;
  onClickLocked?: () => void;
  resources?: any[];
  onVisitResource?: (res: any) => void;
}

/**
 * Extracts a YouTube embed URL if the URL is from YouTube.
 */
function getEmbedUrl(rawUrl: string): string | null {
  if (!rawUrl) return null;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.hostname.includes('youtube.com')) {
      const v = parsed.searchParams.get('v');
      if (v) return `https://www.youtube.com/embed/${v}`;
      if (parsed.pathname.startsWith('/embed/')) return rawUrl;
    } else if (parsed.hostname.includes('youtu.be')) {
      const id = parsed.pathname.slice(1).split('?')[0];
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Extracts a high quality YouTube thumbnail URL.
 */
function getYouTubeThumbnail(rawUrl: string): string | null {
  if (!rawUrl) return null;
  try {
    const parsed = new URL(rawUrl);
    let id: string | null = null;
    if (parsed.hostname.includes('youtube.com')) {
      id = parsed.searchParams.get('v');
      if (!id && parsed.pathname.startsWith('/embed/')) {
        id = parsed.pathname.split('/')[2];
      }
    } else if (parsed.hostname.includes('youtu.be')) {
      id = parsed.pathname.slice(1).split('?')[0];
    }
    if (id) {
      return `https://img.youtube.com/vi/${id}/mqdefault.jpg`;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Extracts a clean hostname domain for resource pills.
 */
function getDomainFromUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Returns a human-friendly resource icon, type label, and badge class based on URL extension / type.
 */
function getResourceMeta(url: string, title?: string) {
  const lower = (url + (title || '')).toLowerCase();
  const domain = getDomainFromUrl(url);

  if (lower.endsWith('.pdf') || lower.includes('.pdf') || lower.includes('/pdf')) {
    return {
      icon: <FileText size={17} strokeWidth={2.2} />,
      type: 'PDF Document',
      badgeClass: 'resource-badge--pdf',
      domain: domain || 'PDF Document',
    };
  }
  if (
    lower.includes('github.com') ||
    lower.includes('gitlab.com') ||
    lower.includes('bitbucket.org') ||
    lower.endsWith('.zip') ||
    lower.endsWith('.tar')
  ) {
    return {
      icon: <Code size={17} strokeWidth={2.2} />,
      type: 'Code Repository',
      badgeClass: 'resource-badge--code',
      domain: domain || 'Source Code',
    };
  }
  if (
    lower.includes('docs.google.com') ||
    lower.includes('notion.so') ||
    lower.includes('medium.com') ||
    lower.includes('wikipedia.org') ||
    lower.includes('article') ||
    lower.includes('guide')
  ) {
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

export const LessonCard: React.FC<Props> = ({
  lesson,
  isDone,
  isLocked = false,
  lockReason,
  isTrainee,
  onMarkWatched,
  onStartLesson,
  onClickLocked,
  resources = [],
  onVisitResource,
}) => {
  const [showEmbed, setShowEmbed] = useState(false);
  const [isDescExpanded, setIsDescExpanded] = useState(false);

  // Combine video sources
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

  // Combine resource items
  const combinedResources: LessonResource[] = [];
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
  if (resources && Array.isArray(resources)) {
    resources.forEach((r) => {
      if (r.url && !combinedResources.some((c) => c.url === r.url)) {
        combinedResources.push(r);
      }
    });
  }

  const primaryVideo = videoList[0];
  const embedUrl = primaryVideo ? getEmbedUrl(primaryVideo.url) : null;

  // Determine if description is long enough to show "Show more" toggle
  const rawDescText = (lesson.description || '').replace(/<[^>]*>/g, '').trim();
  const isLongDescription = rawDescText.length > 160 || (lesson.keyPoints && lesson.keyPoints.length > 2);

  const handleCardClick = () => {
    if (isLocked && onClickLocked) {
      onClickLocked();
    }
  };

  return (
    <div
      className={`modern-lesson-card ${isDone ? 'modern-lesson-card--completed' : ''} ${
        isLocked ? 'modern-lesson-card--locked' : ''
      }`}
      onClick={handleCardClick}
    >
      {/* ── Top Header Row ─────────────────────────────────────────── */}
      <div className="lesson-card-header">
        <div className="lesson-card-left">
          {/* Status icon button */}
          <button
            type="button"
            className={`lesson-status-icon-btn ${
              isLocked
                ? 'lesson-status-icon-btn--locked'
                : isDone
                ? 'lesson-status-icon-btn--completed'
                : isTrainee
                ? 'lesson-status-icon-btn--clickable'
                : ''
            }`}
            onClick={(e) => {
              if (isTrainee && !isLocked) {
                e.stopPropagation();
                if (onStartLesson) {
                  onStartLesson(lesson);
                } else if (!isDone && onMarkWatched) {
                  onMarkWatched(lesson.id);
                }
              }
            }}
            title={
              isLocked
                ? lockReason || 'Lesson is locked'
                : isDone
                ? 'Lesson Completed'
                : isTrainee
                ? 'Click to mark as watched'
                : 'Lesson status'
            }
            disabled={isLocked || (isDone && !isTrainee)}
          >
            {isLocked ? (
              <Lock size={14} />
            ) : isDone ? (
              <CheckCircle2 size={16} />
            ) : (
              <Play size={13} style={{ marginLeft: 2 }} fill="currentColor" />
            )}
          </button>

          <div className="lesson-meta-wrap">
            <h4
              className={`lesson-title-text ${
                isDone ? 'lesson-title-text--completed' : ''
              }`}
            >
              {lesson.title}
            </h4>

            {/* Subtitle row - Video count and Resource count (Duration removed per request) */}
            <div className="lesson-subtitle-row">
              {videoList.length > 0 && (
                <span className="lesson-count-badge lesson-count-badge--video">
                  <Play size={10} fill="currentColor" />
                  {videoList.length} {videoList.length === 1 ? 'Video' : 'Videos'}
                </span>
              )}

              {combinedResources.length > 0 && (
                <span className="lesson-count-badge lesson-count-badge--resource">
                  <BookOpen size={10} />
                  {combinedResources.length} {combinedResources.length === 1 ? 'Resource' : 'Resources'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right header actions */}
        <div className="lesson-card-header-actions" onClick={(e) => e.stopPropagation()}>
          {isLocked ? (
            <span className="lesson-locked-badge">
              <Lock size={12} />
              Locked
            </span>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {isDone && (
                <span className="lesson-completion-badge">
                  <CheckCircle2 size={13} />
                  Completed
                </span>
              )}
              {isTrainee && (
                <button
                  type="button"
                  className="lesson-start-btn"
                  onClick={() => onStartLesson ? onStartLesson(lesson) : (onMarkWatched && onMarkWatched(lesson.id))}
                  title={isDone ? 'Review lesson in full-screen player' : 'Start interactive lesson'}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 14px',
                    borderRadius: 999,
                    background: isDone ? '#f1f5f9' : 'linear-gradient(135deg, #6366f1, #4f46e5)',
                    color: isDone ? '#475569' : '#ffffff',
                    border: isDone ? '1px solid #e2e8f0' : 'none',
                    fontWeight: 700,
                    fontSize: 12.5,
                    cursor: 'pointer',
                    boxShadow: isDone ? 'none' : '0 2px 8px rgba(99, 102, 241, 0.25)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Play size={12} fill="currentColor" /> {isDone ? 'Review Lesson' : 'Start Lesson'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Lock Reason Banner ─────────────────────────────────────── */}
      {isLocked && (
        <div className="lesson-lock-notice">
          <Lock size={14} color="#64748b" />
          <span>{lockReason || 'Complete the preceding lesson to unlock this lesson and its materials.'}</span>
        </div>
      )}

      {/* ── Description & Key Takeaways with Show More/Less ───────── */}
      {(lesson.description || (lesson.keyPoints && lesson.keyPoints.length > 0)) && (
        <div className="lesson-description-box" style={{ pointerEvents: isLocked ? 'none' : 'auto' }}>
          <div className={`lesson-description-content ${isLongDescription && !isDescExpanded ? 'lesson-description-content--clamped' : ''}`}>
            {lesson.description && (
              <div
                className="lesson-description-html"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(lesson.description) }}
              />
            )}

            {lesson.keyPoints && lesson.keyPoints.length > 0 && (
              <ul className="lesson-keypoints-list">
                {lesson.keyPoints.map((point, idx) => (
                  <li key={idx} className="lesson-keypoint-item">
                    <span className="lesson-keypoint-bullet">•</span>
                    <span dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(point) }} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          {isLongDescription && (
            <button
              type="button"
              className="lesson-desc-toggle-btn"
              onClick={(e) => {
                e.stopPropagation();
                setIsDescExpanded(!isDescExpanded);
              }}
              title={isDescExpanded ? 'Show less content' : 'Show more content'}
            >
              <span>{isDescExpanded ? 'Show less' : 'Show more'}</span>
              {isDescExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          )}
        </div>
      )}

      {/* ── CORE VIDEO LESSON SHOWCASE (Video-like Media Card) ──── */}
      {videoList.length > 0 && (
        <div className="lesson-core-media-section" style={{ pointerEvents: isLocked ? 'none' : 'auto' }}>
          <div className="lesson-section-label">
            <Play size={12} fill="currentColor" /> Core Video Lecture
          </div>

          {videoList.map((video, vIdx) => {
            const thumbUrl = getYouTubeThumbnail(video.url);
            const isYt = video.url.includes('youtube') || video.url.includes('youtu.be');
            return (
              <div key={vIdx} className="lesson-video-card-container">
                <div
                  className="lesson-video-card"
                  onClick={() => {
                    if (embedUrl) {
                      setShowEmbed(!showEmbed);
                    } else {
                      window.open(video.url, '_blank', 'noreferrer');
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      if (embedUrl) setShowEmbed(!showEmbed);
                      else window.open(video.url, '_blank', 'noreferrer');
                    }
                  }}
                >
                  {/* Left: Video Thumbnail Preview with Play Glass Badge */}
                  <div className="lesson-video-thumbnail-box">
                    {thumbUrl ? (
                      <img
                        src={thumbUrl}
                        alt="Video thumbnail preview"
                        className="lesson-video-thumbnail-img"
                        loading="lazy"
                      />
                    ) : (
                      <div className="lesson-video-thumbnail-fallback">
                        <Play size={20} fill="currentColor" />
                      </div>
                    )}
                    <div className="lesson-video-thumbnail-overlay">
                      <div className="lesson-video-play-glass-btn">
                        <Play size={15} fill="currentColor" style={{ marginLeft: 2 }} />
                      </div>
                    </div>
                    <span className="lesson-video-duration-pill">
                      {isYt ? 'YouTube' : 'HD Video'}
                    </span>
                  </div>

                  {/* Middle: Video Information */}
                  <div className="lesson-video-info">
                    <div className="lesson-video-tag-row">
                      <span className="lesson-video-pill">
                        {isYt ? 'YouTube Lecture' : 'Video Lecture'}
                      </span>
                      <span className="lesson-video-subtitle">Core Curriculum Media</span>
                    </div>
                    <h5 className="lesson-video-title">
                      {video.title || `${lesson.title} - Video Lecture`}
                    </h5>
                    <p className="lesson-video-caption">
                      Interactive video lesson · Click to watch inline or launch full player.
                    </p>
                  </div>

                  {/* Right: Actions */}
                  <div className="lesson-video-action-group" onClick={(e) => e.stopPropagation()}>
                    {embedUrl && (
                      <button
                        type="button"
                        className={`lesson-video-inline-toggle ${showEmbed ? 'is-active' : ''}`}
                        onClick={() => setShowEmbed(!showEmbed)}
                        title={showEmbed ? 'Hide embedded player' : 'Watch inline'}
                      >
                        <Play size={12} fill={showEmbed ? 'none' : 'currentColor'} />
                        <span>{showEmbed ? 'Close Player' : 'Watch Inline'}</span>
                        {showEmbed ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>
                    )}
                    <a
                      href={video.url}
                      target="_blank"
                      rel="noreferrer"
                      className="lesson-video-action-btn"
                      title="Open video in a new tab"
                    >
                      <ExternalLink size={13} />
                      <span>Open Video</span>
                    </a>
                  </div>
                </div>

                {/* Inline Embed Player */}
                {showEmbed && embedUrl && !isLocked && (
                  <div className="lesson-video-embed-container">
                    <div className="lesson-video-embed-header">
                      <div className="lesson-video-embed-header-left">
                        <Play size={13} fill="currentColor" />
                        <span>Now Playing: {video.title || `${lesson.title} - Video Lecture`}</span>
                      </div>
                      <button
                        type="button"
                        className="lesson-video-embed-close-btn"
                        onClick={() => setShowEmbed(false)}
                        title="Close player"
                      >
                        <X size={14} />
                        <span>Close Player</span>
                      </button>
                    </div>
                    <div className="lesson-video-iframe-wrap">
                      <iframe
                        src={embedUrl}
                        title={lesson.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Audio Elements (if present) ────────────────────────────── */}
      {lesson.audios && lesson.audios.length > 0 && (
        <div className="lesson-core-media-section" style={{ pointerEvents: isLocked ? 'none' : 'auto' }}>
          <div className="lesson-section-label">
            <Headphones size={12} /> Audio Lecture & Podcasts
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {lesson.audios.map((aud, aIdx) => (
              <div
                key={aIdx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: '#faf5ff',
                  border: '1px solid #e9d5ff',
                  borderRadius: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#6b21a8' }}>
                    {aud.title || 'Audio Lecture'}
                  </span>
                </div>
                <audio controls src={aud.url} style={{ height: 32, maxWidth: 280 }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── CORE RESOURCES & READING SECTION ───────────────────────── */}
      {combinedResources.length > 0 && (
        <div className="lesson-core-media-section" style={{ pointerEvents: isLocked ? 'none' : 'auto' }}>
          <div className="lesson-section-label">
            <BookOpen size={12} /> Core Reading & Study Resources
          </div>

          <div className="lesson-resources-grid">
            {combinedResources.map((res, rIdx) => {
              const meta = getResourceMeta(res.url, res.title);
              return (
                <a
                  key={res.id || rIdx}
                  href={res.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => onVisitResource && onVisitResource(res)}
                  className="lesson-resource-card"
                  title={`Open ${res.title || 'Resource'}`}
                >
                  <div className="lesson-resource-card-left">
                    <div className={`lesson-resource-icon-badge ${meta.badgeClass}`}>
                      {meta.icon}
                    </div>
                    <div className="lesson-resource-text">
                      <span className="lesson-resource-title" title={res.title || 'Learning Resource'}>
                        {res.title || 'Learning Resource'}
                      </span>
                      <div className="lesson-resource-meta-row">
                        <span className="lesson-resource-type-tag">{meta.type}</span>
                        {meta.domain && (
                          <>
                            <span className="lesson-resource-dot">•</span>
                            <span className="lesson-resource-domain">{meta.domain}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="lesson-resource-action">
                    <span className="lesson-resource-open-btn">
                      Open <ArrowUpRight size={13} />
                    </span>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export const LessonCardSkeleton: React.FC = () => {
  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '14px',
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)',
      }}
      aria-busy="true"
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.5s infinite',
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div
              style={{
                width: 180,
                height: 18,
                borderRadius: 4,
                background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s infinite',
              }}
            />
            <div
              style={{
                width: 110,
                height: 12,
                borderRadius: 4,
                background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s infinite',
              }}
            />
          </div>
        </div>
        <div
          style={{
            width: 100,
            height: 32,
            borderRadius: 8,
            background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite',
          }}
        />
      </div>

      <div
        style={{
          width: '100%',
          height: 74,
          borderRadius: 12,
          background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.5s infinite',
        }}
      />
    </div>
  );
};

