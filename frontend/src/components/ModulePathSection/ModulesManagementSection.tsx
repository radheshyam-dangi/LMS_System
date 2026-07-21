import React, { useState, useEffect } from "react";
import { lessonService } from "../../services/lessonService";
import { moduleService } from "../../services/moduleService";
import "./ModulesManagement.css";

interface ModulesProps {
  currentPathId: string;
  currentPathTitle: string;
  userRole: 'Admin' | 'Trainer' | 'Trainee';
  accessToken: string;
  onBack: () => void;
}

export function ModulesManagementSection({
  currentPathId,
  currentPathTitle,
  userRole,
  accessToken,
  onBack,
}: ModulesProps) {
  const isTrainerOrAdmin = userRole === 'Admin' || userRole === 'Trainer';
  const [activeTab, setActiveTab] = useState<'Lessons' | 'Tasks' | 'Resources' | 'Assessments'>('Lessons');
  
  // Dynamic State for Modules and Lessons
  const [modules, setModules] = useState<any[]>([]);
  const [selectedModule, setSelectedModule] = useState<any | null>(null);
  const [lessons, setLessons] = useState<any[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<any | null>(null);
  
  // Creation Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createCategory, setCreateCategory] = useState<'LESSON' | 'ASSIGNMENT'>('LESSON');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonVideoUrl, setLessonVideoUrl] = useState("");
  const [lessonArticleHtml, setLessonArticleHtml] = useState("");

  const [assignmentTitle, setAssignmentTitle] = useState("");
  const [assignmentInstructions, setAssignmentInstructions] = useState("");
  const [assignmentType, setAssignmentType] = useState<'Subjective' | 'MCQ'>('Subjective');
  const [mcqOptions, setMcqOptions] = useState<string[]>(["", "", "", ""]);
  const [mcqCorrectIndex, setMcqCorrectIndex] = useState<number>(0);

  // 1️⃣ Fetch Modules for Current Learning Path
  useEffect(() => {
    async function loadModules() {
      try {
        const pathModules = await moduleService.fetchModulesForPath(currentPathId, accessToken);
        setModules(pathModules);
        if (pathModules && pathModules.length > 0) {
          setSelectedModule(pathModules[0]);
        }
      } catch (err: any) {
        console.error("Failed to fetch modules:", err.message);
      }
    }
    loadModules();
  }, [currentPathId, accessToken]);

  // 2️⃣ Fetch Lessons when Selected Module changes
  useEffect(() => {
    async function loadLessons() {
      if (!selectedModule?.id) return;
      try {
        const moduleLessons = await lessonService.fetchLessonsForModule(selectedModule.id, accessToken);
        setLessons(moduleLessons);
        if (moduleLessons && moduleLessons.length > 0) {
          setSelectedLesson(moduleLessons[0]);
        } else {
          setSelectedLesson(null);
        }
      } catch (err: any) {
        console.error("Failed to fetch lessons:", err.message);
      }
    }
    loadLessons();
  }, [selectedModule, accessToken]);

  // 3️⃣ Handle Creation of Content
  const handleCreateContent = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (createCategory === 'LESSON' && !selectedModule?.id) {
      alert("Please create or select a module first!");
      return;
    }

    if (createCategory === 'ASSIGNMENT' && !selectedLesson?.id) {
      alert("Please select an existing lesson first before adding an assignment!");
      return;
    }

    setIsSubmitting(true);

    try {
      if (createCategory === 'LESSON') {
        const payload = {
          moduleId: selectedModule.id, // ✅ FIXED: Pass valid Module ID, not LearningPath ID
          title: lessonTitle,
          videoUrl: lessonVideoUrl,
          description: lessonArticleHtml,
        };
        await lessonService.createLesson(payload, accessToken);
        alert("Lesson created successfully!");
        
        // Refresh Lessons
        const updated = await lessonService.fetchLessonsForModule(selectedModule.id, accessToken);
        setLessons(updated);
      } else if (createCategory === 'ASSIGNMENT') {
        const payload = {
          lessonId: selectedLesson.id, // ✅ FIXED: Pass active Lesson ID
          title: assignmentTitle,
          instructions: assignmentInstructions,
          assignmentType,
          mcqConfig: assignmentType === 'MCQ' ? { options: mcqOptions, correctIndex: mcqCorrectIndex } : null,
        };
        await lessonService.createAssignment(payload, accessToken);
        alert("Assignment created successfully!");
      }
      setIsCreateModalOpen(false);
      resetCreateForm();
    } catch (err: any) {
      alert(err.message || "Failed to create content.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetCreateForm = () => {
    setLessonTitle("");
    setLessonVideoUrl("");
    setLessonArticleHtml("");
    setAssignmentTitle("");
    setAssignmentInstructions("");
    setAssignmentType("Subjective");
    setMcqOptions(["", "", "", ""]);
  };

  return (
    <div className="module-details-workspace">
      {/* UI Navigation & Forms */}
      <header className="workspace-top-bar">
        <div>
          <h1 className="main-heading">{currentPathTitle}</h1>
          {modules.length > 0 && (
            <select 
              value={selectedModule?.id || ''} 
              onChange={(e) => {
                const mod = modules.find(m => m.id === e.target.value);
                setSelectedModule(mod);
              }}
            >
              {modules.map(m => (
                <option key={m.id} value={m.id}>{m.title}</option>
              ))}
            </select>
          )}
        </div>

        {isTrainerOrAdmin && (
          <button className="btn-primary-purple" onClick={() => setIsCreateModalOpen(true)}>
            + Add Content / Assignment
          </button>
        )}
      </header>

      {/* Render Lessons & Assignment Tabs as before... */}
    </div>
  );
}