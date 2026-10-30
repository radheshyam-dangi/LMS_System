import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { TiptapLPEditor } from '../components/TiptapLPEditor/TiptapLPEditor';
import { learningPathService } from '../services/learningPathService';
import { convertLpToTiptap } from '../components/TiptapLPEditor/convertLpToTiptap';
import { TrainerAiAssistantDrawer } from '../features/trainer-ai-assistant/TrainerAiAssistantDrawer';
import { useToast } from '../context/ToastContext';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import './LPEditorPage.css';

export default function LPEditorPage() {
  const { pathId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [initialData, setInitialData] = useState<any>(null);
  const [pathTitle, setPathTitle] = useState<string>('');
  const [lpStatus, setLpStatus] = useState<string>('Active');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAiAssistant, setShowAiAssistant] = useState<boolean>(false);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [isOwner, setIsOwner] = useState<boolean>(true);

  const focusAction = location.state?.action;
  const targetId = location.state?.targetId;
  const token = localStorage.getItem('skillforge_token') || '';

  const fetchLp = useCallback(async (targetIdOverride?: string) => {
    const effectivePathId = targetIdOverride || pathId;
    if (!effectivePathId) {
      setInitialData(null);
      setPathTitle('');
      setLpStatus('Active');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      if (!token) throw new Error('Not authenticated');
      const lp = await learningPathService.fetchPathById(effectivePathId, token);
      setPathTitle(lp.title || lp.name || '');
      setLpStatus(lp.status || 'Active');
      const tiptapJson = convertLpToTiptap(lp);
      setInitialData(tiptapJson);
      setRefreshKey((k) => k + 1);

      // Verify ownership: only the creator or an Admin has CRUD editing rights
      const userStr = localStorage.getItem('skillforge_user');
      let currentUserId: string | null = null;
      let isAdmin = false;
      if (userStr) {
        try {
          const u = JSON.parse(userStr);
          currentUserId = u.id || u.sub || u.userId;
          const roles = [
            u.role,
            u.primaryRole,
            u.activeRole,
            ...(Array.isArray(u.roles) ? u.roles : [])
          ].filter(Boolean).map((r: any) => (typeof r === 'string' ? r : r?.name || '').toLowerCase());
          isAdmin = roles.includes('admin');
        } catch {}
      }
      const creatorId = lp.createdBy?.id || lp.createdById;
      const ownerMatched = Boolean(currentUserId && creatorId && String(currentUserId).toLowerCase() === String(creatorId).toLowerCase()) || isAdmin;
      setIsOwner(ownerMatched);
    } catch (err: any) {
      setError(err.message || 'Failed to load learning path');
    } finally {
      setLoading(false);
    }
  }, [pathId, token]);

  useEffect(() => {
    fetchLp();
  }, [fetchLp]);

  // Synchronize when preview is requested from Trainer AI Assistant drawer
  useEffect(() => {
    const handlePreviewRequested = (e: Event) => {
      const customEvent = e as CustomEvent<{ lpId: string }>;
      const targetLpId = customEvent.detail?.lpId;
      if (targetLpId) {
        if (targetLpId === pathId) {
          fetchLp(targetLpId);
        } else {
          navigate(`/learning-paths/${targetLpId}/edit`);
        }
      }
    };

    window.addEventListener('lp_preview_requested', handlePreviewRequested);
    return () => {
      window.removeEventListener('lp_preview_requested', handlePreviewRequested);
    };
  }, [pathId, fetchLp, navigate]);

  const handleToggleAiAssistant = useCallback(() => {
    if (!isOwner) {
      toast.error('Access Restricted: Only the owner of this Learning Path or an Admin can open the AI Assistant to perform CRUD operations.');
      return;
    }
    setShowAiAssistant((prev) => !prev);
  }, [isOwner, toast]);

  const handleRefreshLp = useCallback(async () => {
    if (!pathId || !token) return;
    try {
      setLoading(true);
      const lp = await learningPathService.fetchPathById(pathId, token);
      setPathTitle(lp.title || lp.name || '');
      setLpStatus(lp.status || 'Active');
      const tiptapJson = convertLpToTiptap(lp);
      setInitialData(tiptapJson);
      setRefreshKey((k) => k + 1);
      toast.success('Curriculum updated directly from AI Assistant!');
    } catch (err) {
      console.warn('Failed to refresh LP in studio:', err);
    } finally {
      setLoading(false);
    }
  }, [pathId, token, toast]);

  return (
    <div style={{ height: '100vh', width: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'row', background: '#f8fafc' }}>
      <main style={{ flex: 1, height: '100%', overflow: 'hidden', position: 'relative' }}>
        {loading ? (
          <div style={{ display: 'flex', height: '100%', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', background: '#f8fafc', color: '#64748b' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: '#eef2ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Loader2 size={24} className="spin" />
            </div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>Loading Curriculum Studio...</div>
            <div style={{ fontSize: '13px', color: '#94a3b8' }}>Preparing visual section blocks and modules</div>
          </div>
        ) : error ? (
          <div style={{ padding: 48, textAlign: 'center', background: '#f8fafc', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ padding: '28px 36px', background: '#ffffff', borderRadius: '16px', border: '1px solid #fee2e2', boxShadow: '0 8px 24px rgba(239, 68, 68, 0.08)', maxWidth: '460px' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                <AlertCircle size={24} />
              </div>
              <h2 style={{ color: '#dc2626', margin: '0 0 8px 0', fontSize: '18px', fontWeight: 700 }}>Unable to Load Curriculum</h2>
              <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 20px 0', lineHeight: 1.5 }}>{error}</p>
              <button 
                onClick={() => navigate('/learning-paths')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 20px', background: '#4f46e5', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
              >
                <ArrowLeft size={14} /> Back to Learning Paths
              </button>
            </div>
          </div>
        ) : (
          <TiptapLPEditor 
            key={`${pathId || 'new'}-${refreshKey}`}
            initialDraftData={initialData} 
            pathId={pathId} 
            focusAction={focusAction}
            targetId={targetId}
            lpStatus={lpStatus}
            isAiAssistantOpen={showAiAssistant}
            onToggleAiAssistant={handleToggleAiAssistant}
            isOwner={isOwner}
            onPublishSuccess={handleRefreshLp}
          />
        )}
      </main>

      {/* Trainer AI Assistant embedded right in Curriculum Studio (Owner / Admin only) */}
      {isOwner && (
        <TrainerAiAssistantDrawer
          isOpen={showAiAssistant}
          onClose={() => setShowAiAssistant(false)}
          accessToken={token}
          activeLpId={pathId}
          onLpUpgraded={handleRefreshLp}
        />
      )}
    </div>
  );
}
