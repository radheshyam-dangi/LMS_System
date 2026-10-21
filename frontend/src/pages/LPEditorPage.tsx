import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { TiptapLPEditor } from '../components/TiptapLPEditor/TiptapLPEditor';
import { learningPathService } from '../services/learningPathService';
import { convertLpToTiptap } from '../components/TiptapLPEditor/convertLpToTiptap';
import { ArrowLeft, Layers, BookOpen, ShieldCheck, Loader2, AlertCircle } from 'lucide-react';
import './LPEditorPage.css';

export default function LPEditorPage() {
  const { pathId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [initialData, setInitialData] = useState<any>(null);
  const [pathTitle, setPathTitle] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const focusAction = location.state?.action;
  const targetId = location.state?.targetId;

  useEffect(() => {
    if (!pathId) {
      // Creating new LP
      setInitialData(null);
      setLoading(false);
      return;
    }

    // Editing existing LP
    const fetchLp = async () => {
      try {
        const token = localStorage.getItem('skillforge_access_token');
        if (!token) throw new Error('Not authenticated');
        const lp = await learningPathService.fetchPathById(pathId, token);
        setPathTitle(lp.title || lp.name || '');
        const tiptapJson = convertLpToTiptap(lp);
        setInitialData(tiptapJson);
      } catch (err: any) {
        setError(err.message || 'Failed to load learning path');
      } finally {
        setLoading(false);
      }
    };
    fetchLp();
  }, [pathId]);

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', background: '#f8fafc', color: '#64748b' }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: '#eef2ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Loader2 size={24} className="spin" />
        </div>
        <div style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>Loading Curriculum Studio...</div>
        <div style={{ fontSize: '13px', color: '#94a3b8' }}>Preparing visual section blocks and modules</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 48, textAlign: 'center', background: '#f8fafc', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
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
    );
  }

  return (
    <div style={{ height: '100vh', width: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
      <main style={{ flex: 1, height: '100%', overflow: 'hidden' }}>
        <TiptapLPEditor 
          initialDraftData={initialData} 
          pathId={pathId} 
          focusAction={focusAction}
          targetId={targetId}
        />
      </main>
    </div>
  );
}
